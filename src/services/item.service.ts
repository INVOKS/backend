import { eq, and, inArray, sql, like } from "drizzle-orm";
import { db } from "../db/index.js";
import { itemCategories, type ItemCategory } from "../db/schema/item-categories.js";
import { items, type Item } from "../db/schema/items.js";
import { itemUnits, type ItemUnit } from "../db/schema/item-units.js";
import { AppError } from "../utils/app-error.js";
import { uploadImage, deleteImage } from "./storage.service.js";
import { recordAuditLog } from "./audit-log.service.js";
import type {
  CreateItemInput,
  UpdateItemInput,
  AddUnitsInput,
  UpdateUnitInput,
  ItemFilterInput,
  UnitItemInput,
} from "../validators/item.validator.js";

export async function getItemCategories(): Promise<ItemCategory[]> {
  return await db
    .select()
    .from(itemCategories)
    .orderBy(itemCategories.name);
}

export interface ItemFilterOptions {
  categoryId?: number | undefined;
  q?: string | undefined;
  onlyActive?: boolean | undefined;
}

export async function getItems(options: ItemFilterOptions = {}) {
  const { categoryId, q, onlyActive = true } = options;
  const conditions = [];

  if (onlyActive) {
    conditions.push(eq(items.isActive, true));
  }

  if (categoryId !== undefined) {
    conditions.push(eq(items.categoryId, categoryId));
  }

  if (q !== undefined && q.trim() !== "") {
    conditions.push(like(items.name, `%${q.trim()}%`));
  }

  const itemList = await db
    .select()
    .from(items)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(items.name);

  if (itemList.length === 0) {
    return [];
  }

  const categoryIds = [...new Set(itemList.map((i) => i.categoryId))];
  const itemIds = itemList.map((i) => i.id);

  // Ambil data kategori terkait tanpa relational query (with:)
  const categoryList = await db
    .select()
    .from(itemCategories)
    .where(inArray(itemCategories.id, categoryIds));

  const categoryMap = new Map(categoryList.map((c) => [c.id, c]));

  // Ambil seluruh unit untuk menghitung totalUnits dan availableUnits
  const allUnits = await db
    .select({
      itemId: itemUnits.itemId,
      isActive: itemUnits.isActive,
      condition: itemUnits.condition,
    })
    .from(itemUnits)
    .where(inArray(itemUnits.itemId, itemIds));

  const totalUnitsMap = new Map<number, number>();
  const availableUnitsMap = new Map<number, number>();

  for (const unit of allUnits) {
    if (unit.isActive) {
      totalUnitsMap.set(unit.itemId, (totalUnitsMap.get(unit.itemId) || 0) + 1);
      if (unit.condition === "good") {
        availableUnitsMap.set(
          unit.itemId,
          (availableUnitsMap.get(unit.itemId) || 0) + 1
        );
      }
    }
  }

  return itemList.map((item) => ({
    ...item,
    category: categoryMap.get(item.categoryId) ?? null,
    totalUnits: totalUnitsMap.get(item.id) || 0,
    availableUnits: availableUnitsMap.get(item.id) || 0,
  }));
}

export async function getItemById(id: number, isAdmin: boolean = false) {
  const conditions = [eq(items.id, id)];

  if (!isAdmin) {
    conditions.push(eq(items.isActive, true));
  }

  const [item] = await db
    .select()
    .from(items)
    .where(and(...conditions))
    .limit(1);

  if (!item) {
    throw new AppError(404, "Barang tidak ditemukan atau tidak aktif");
  }

  const [category] = await db
    .select()
    .from(itemCategories)
    .where(eq(itemCategories.id, item.categoryId))
    .limit(1);

  // Ambil semua unit untuk perhitungan ringkasan stok
  const allUnits = await db
    .select()
    .from(itemUnits)
    .where(eq(itemUnits.itemId, item.id))
    .orderBy(itemUnits.inventoryCode);

  const totalUnits = allUnits.filter((u) => u.isActive).length;
  const availableUnits = allUnits.filter(
    (u) => u.isActive && u.condition === "good"
  ).length;

  // Filter unit yang ditampilkan: user biasa hanya melihat unit aktif dengan condition 'good'
  const units = isAdmin
    ? allUnits
    : allUnits.filter((u) => u.isActive && u.condition === "good");

  return {
    ...item,
    category: category ?? null,
    totalUnits,
    availableUnits,
    units,
  };
}

export async function createItem(
  input: CreateItemInput,
  file: Express.Multer.File
) {
  // 1. Verifikasi kategori ada
  const [category] = await db
    .select()
    .from(itemCategories)
    .where(eq(itemCategories.id, input.categoryId))
    .limit(1);

  if (!category) {
    throw new AppError(404, "Kategori barang tidak ditemukan");
  }

  // 2. Cek bentrok kode inventaris sebelum upload
  const lowerCodes = input.units.map((u: UnitItemInput) => u.inventoryCode.trim().toLowerCase());
  const existingUnits = await db
    .select({ inventoryCode: itemUnits.inventoryCode })
    .from(itemUnits)
    .where(inArray(sql`LOWER(${itemUnits.inventoryCode})`, lowerCodes));

  if (existingUnits.length > 0) {
    const conflicts = existingUnits.map((u) => u.inventoryCode);
    throw new AppError(
      409,
      `Kode inventaris sudah digunakan: ${conflicts.join(", ")}`
    );
  }

  // 3. Upload foto ke Cloudinary di folder 'invoks/items'
  const { url: imageUrl, publicId: imagePublicId } = await uploadImage(
    file.buffer,
    file.mimetype,
    "invoks/items"
  );

  let newItemId: number;
  try {
    await db.transaction(async (tx) => {
      const [insertedItem] = await tx
        .insert(items)
        .values({
          categoryId: input.categoryId,
          name: input.name,
          description: input.description ?? null,
          specifications: (input.specifications as Record<string, unknown> | null | undefined) ?? null,
          imageUrl,
          imagePublicId,
          isActive: true,
        })
        .$returningId();

      if (!insertedItem?.id) {
        throw new AppError(500, "Gagal menambahkan barang baru");
      }

      newItemId = insertedItem.id;

      await tx.insert(itemUnits).values(
        input.units.map((u: UnitItemInput) => ({
          itemId: newItemId,
          inventoryCode: u.inventoryCode.trim(),
          condition: u.condition || "good",
          isActive: true,
          notes: u.notes,
        }))
      );
    });
  } catch (err: any) {
    // Hapus foto jika transaksi insert DB gagal
    await deleteImage(imagePublicId);
    if (err?.code === "ER_DUP_ENTRY") {
      throw new AppError(409, "Kode inventaris sudah digunakan");
    }
    throw err;
  }

  // 4. Pembacaan respons dilakukan DI LUAR blok transaksi
  return await getItemById(newItemId!, true);
}

export async function updateItem(
  id: number,
  input: UpdateItemInput,
  file?: Express.Multer.File,
  adminUserId?: number
) {
  const currentItem = await getItemById(id, true);

  const hasItemFields =
    input.categoryId !== undefined ||
    input.name !== undefined ||
    input.description !== undefined ||
    input.specifications !== undefined ||
    file !== undefined;

  if (!hasItemFields) {
    throw new AppError(400, "Tidak ada data yang diubah");
  }

  if (input.categoryId !== undefined) {
    const [category] = await db
      .select()
      .from(itemCategories)
      .where(eq(itemCategories.id, input.categoryId))
      .limit(1);

    if (!category) {
      throw new AppError(404, "Kategori barang tidak ditemukan");
    }
  }

  let newImageUrl: string | undefined;
  let newImagePublicId: string | undefined;

  if (file) {
    const result = await uploadImage(file.buffer, file.mimetype, "invoks/items");
    newImageUrl = result.url;
    newImagePublicId = result.publicId;
  }

  const updateData: Record<string, unknown> = {};
  if (input.categoryId !== undefined) updateData.categoryId = input.categoryId;
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.specifications !== undefined) updateData.specifications = input.specifications as any;
  if (newImageUrl !== undefined) updateData.imageUrl = newImageUrl;
  if (newImagePublicId !== undefined) updateData.imagePublicId = newImagePublicId;

  if (Object.keys(updateData).length > 0) {
    try {
      await db
        .update(items)
        .set(updateData)
        .where(eq(items.id, id));
    } catch (err) {
      if (newImagePublicId) {
        await deleteImage(newImagePublicId);
      }
      throw err;
    }
  }

  // Hapus foto lama dari Cloudinary SETELAH DB update berhasil
  if (
    newImagePublicId &&
    currentItem.imagePublicId &&
    currentItem.imagePublicId !== newImagePublicId
  ) {
    await deleteImage(currentItem.imagePublicId);
  }

  const updatedItem = await getItemById(id, true);

  void recordAuditLog({
    actorUserId: adminUserId ?? null,
    action: "UPDATE",
    entityType: "item",
    entityId: String(id),
    beforeData: { name: currentItem.name, categoryId: currentItem.categoryId },
    afterData: { name: updatedItem.name, categoryId: updatedItem.categoryId },
  });

  return updatedItem;
}

export async function setItemActiveStatus(
  id: number,
  isActive: boolean,
  adminUserId?: number
) {
  const before = await getItemById(id, true);
  await db.update(items).set({ isActive }).where(eq(items.id, id));
  const after = await getItemById(id, true);

  void recordAuditLog({
    actorUserId: adminUserId ?? null,
    action: isActive ? "UNARCHIVE" : "ARCHIVE",
    entityType: "item",
    entityId: String(id),
    beforeData: { isActive: before.isActive },
    afterData: { isActive: after.isActive },
  });

  return after;
}

export async function addUnitsToItem(itemId: number, input: AddUnitsInput) {
  const item = await getItemById(itemId, true);

  if (!item.isActive) {
    throw new AppError(400, "Barang sedang diarsip, aktifkan dulu sebelum menambah unit");
  }

  const lowerCodes = input.units.map((u: UnitItemInput) => u.inventoryCode.trim().toLowerCase());
  const existingUnits = await db
    .select({ inventoryCode: itemUnits.inventoryCode })
    .from(itemUnits)
    .where(inArray(sql`LOWER(${itemUnits.inventoryCode})`, lowerCodes));

  if (existingUnits.length > 0) {
    const conflicts = existingUnits.map((u) => u.inventoryCode);
    throw new AppError(
      409,
      `Kode inventaris sudah digunakan: ${conflicts.join(", ")}`
    );
  }

  try {
    await db.transaction(async (tx) => {
      await tx.insert(itemUnits).values(
        input.units.map((u: UnitItemInput) => ({
          itemId,
          inventoryCode: u.inventoryCode.trim(),
          condition: u.condition || "good",
          isActive: true,
          notes: u.notes,
        }))
      );
    });
  } catch (err: any) {
    if (err?.code === "ER_DUP_ENTRY") {
      throw new AppError(409, "Kode inventaris sudah digunakan");
    }
    throw err;
  }

  return await getItemById(itemId, true);
}

export async function updateItemUnit(unitId: number, input: UpdateUnitInput) {
  const [unit] = await db
    .select()
    .from(itemUnits)
    .where(eq(itemUnits.id, unitId))
    .limit(1);

  if (!unit) {
    throw new AppError(404, "Unit barang tidak ditemukan");
  }

  const hasFields =
    input.condition !== undefined ||
    input.isActive !== undefined ||
    input.notes !== undefined;

  if (!hasFields) {
    throw new AppError(400, "Tidak ada data yang diubah");
  }

  await db
    .update(itemUnits)
    .set({
      ...(input.condition !== undefined ? { condition: input.condition } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    })
    .where(eq(itemUnits.id, unitId));

  const [updated] = await db
    .select()
    .from(itemUnits)
    .where(eq(itemUnits.id, unitId))
    .limit(1);

  return updated!;
}
