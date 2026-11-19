import { eq, and, inArray, gte, lte, desc, asc, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  itemBorrowings,
  type ItemBorrowing,
} from "../db/schema/item-borrowings.js";
import {
  itemBorrowingUnits,
  type ItemBorrowingUnit,
} from "../db/schema/item-borrowing-units.js";
import {
  itemBorrowingSlots,
  type ItemBorrowingSlot,
} from "../db/schema/item-borrowing-slots.js";
import { itemUnits } from "../db/schema/item-units.js";
import { items } from "../db/schema/items.js";
import { users } from "../db/schema/users.js";
import { AppError } from "../utils/app-error.js";
import { isDuplicateKeyError } from "../utils/db-error.js";
import {
  getNowJakartaString,
  formatInputSlotToDbString,
  addOneHourJakarta,
  generateBorrowingCode,
  calculateBookingTimeStatus,
  calculateSlotTimeStatus,
  toApiDateTime,
  isSlotPast,
  OPERATIONAL_START_HOUR,
  OPERATIONAL_END_HOUR,
  TOTAL_OPERATIONAL_SLOTS,
  getDaysInMonth,
  type TimeStatus,
} from "../utils/datetime.js";
import type {
  CreateItemBorrowingInput,
  ItemBorrowingFilterInput,
  ReturnItemBorrowingUnitsInput,
} from "../validators/item-borrowing.validator.js";

export { TimeStatus, calculateBookingTimeStatus, calculateSlotTimeStatus };

export async function createItemBorrowing(
  userId: number,
  input: CreateItemBorrowingInput
) {
  // Normalisasi dan hitung endAt = addOneHourJakarta(startAt) untuk semua slot sebelum transaksi
  const unitsData = input.units.map((u) => {
    return {
      itemUnitId: u.itemUnitId,
      slots: u.slots.map((s) => {
        const startAt = formatInputSlotToDbString(s.startAt);
        const endAt = addOneHourJakarta(startAt);
        return {
          startAtStr: s.startAt,
          startAt,
          endAt,
        };
      }),
    };
  });

  const allItemUnitIds = input.units
    .map((u) => u.itemUnitId)
    .sort((a, b) => a - b);

  let createdBorrowingId: number;

  await db.transaction(async (tx) => {
    // a. PERNYATAAN PERTAMA: Kunci baris unit dengan urutan id ASC untuk mencegah deadlock
    const lockedUnits = await tx
      .select()
      .from(itemUnits)
      .where(inArray(itemUnits.id, allItemUnitIds))
      .orderBy(asc(itemUnits.id))
      .for("update");

    // b. Pastikan jumlah baris yang ditemukan sama dengan jumlah itemUnitIds yang diminta
    if (lockedUnits.length !== allItemUnitIds.length) {
      const foundIds = new Set(lockedUnits.map((u) => u.id));
      const missingIds = allItemUnitIds.filter((id) => !foundIds.has(id));
      throw new AppError(
        404,
        `Unit barang tidak ditemukan (ID: ${missingIds.join(", ")})`
      );
    }

    // c. Ambil data katalog induk (items) untuk item_id terkait
    const itemIds = [...new Set(lockedUnits.map((u) => u.itemId))];
    const itemsList = await tx
      .select()
      .from(items)
      .where(inArray(items.id, itemIds));
    const itemMap = new Map(itemsList.map((i) => [i.id, i]));

    for (const unit of lockedUnits) {
      if (!unit.isActive) {
        throw new AppError(
          400,
          `Unit barang dengan kode inventaris '${unit.inventoryCode}' sedang tidak aktif atau diarsipkan`
        );
      }
      if (unit.condition !== "good") {
        throw new AppError(
          400,
          `Unit barang dengan kode inventaris '${unit.inventoryCode}' sedang dalam kondisi '${unit.condition}' dan tidak dapat dipinjam`
        );
      }
      const parentItem = itemMap.get(unit.itemId);
      if (!parentItem || !parentItem.isActive) {
        throw new AppError(
          400,
          `Barang '${parentItem?.name || "Katalog"}' untuk unit dengan kode inventaris '${unit.inventoryCode}' sedang tidak aktif atau diarsipkan`
        );
      }
    }

    // d. Cek unit OVERDUE: unit masih memiliki peminjaman aktif dengan MAX(end_at) < nowJakarta
    const nowJakarta = getNowJakartaString();
    const activeUnitBorrowings = await tx
      .select({
        itemUnitId: itemBorrowingUnits.itemUnitId,
        itemBorrowingUnitId: itemBorrowingUnits.id,
        endAt: itemBorrowingSlots.endAt,
      })
      .from(itemBorrowingUnits)
      .innerJoin(
        itemBorrowings,
        eq(itemBorrowingUnits.itemBorrowingId, itemBorrowings.id)
      )
      .innerJoin(
        itemBorrowingSlots,
        eq(itemBorrowingSlots.itemBorrowingUnitId, itemBorrowingUnits.id)
      )
      .where(
        and(
          inArray(itemBorrowingUnits.itemUnitId, allItemUnitIds),
          eq(itemBorrowings.status, "booked"),
          isNull(itemBorrowingUnits.returnedAt)
        )
      );

    const unitBorrowingMaxEndAt = new Map<
      number,
      { itemUnitId: number; maxEndAt: string }
    >();
    for (const row of activeUnitBorrowings) {
      const existing = unitBorrowingMaxEndAt.get(row.itemBorrowingUnitId);
      if (!existing || row.endAt > existing.maxEndAt) {
        unitBorrowingMaxEndAt.set(row.itemBorrowingUnitId, {
          itemUnitId: row.itemUnitId,
          maxEndAt: row.endAt,
        });
      }
    }

    const overdueUnitIds = new Set<number>();
    for (const info of unitBorrowingMaxEndAt.values()) {
      if (info.maxEndAt < nowJakarta) {
        overdueUnitIds.add(info.itemUnitId);
      }
    }

    if (overdueUnitIds.size > 0) {
      const overdueCodes = lockedUnits
        .filter((u) => overdueUnitIds.has(u.id))
        .map((u) => `'${u.inventoryCode}'`);
      throw new AppError(
        409,
        `Unit barang ${overdueCodes.join(
          ", "
        )} belum dikembalikan dari peminjaman sebelumnya (terlambat) dan belum dikonfirmasi oleh admin`
      );
    }

    // e. Cek bentrok jadwal: periksa item_borrowing_slots yang berelasi dengan status 'booked' dan returned_at IS NULL
    const existingSlots = await tx
      .select({
        itemUnitId: itemBorrowingSlots.itemUnitId,
        startAt: itemBorrowingSlots.startAt,
        endAt: itemBorrowingSlots.endAt,
      })
      .from(itemBorrowingSlots)
      .innerJoin(
        itemBorrowings,
        eq(itemBorrowingSlots.itemBorrowingId, itemBorrowings.id)
      )
      .innerJoin(
        itemBorrowingUnits,
        eq(itemBorrowingSlots.itemBorrowingUnitId, itemBorrowingUnits.id)
      )
      .where(
        and(
          inArray(itemBorrowingSlots.itemUnitId, allItemUnitIds),
          eq(itemBorrowings.status, "booked"),
          isNull(itemBorrowingUnits.returnedAt)
        )
      );

    const conflictingSlots: string[] = [];
    for (const u of unitsData) {
      const unitObj = lockedUnits.find((lu) => lu.id === u.itemUnitId);
      const invCode = unitObj ? `'${unitObj.inventoryCode}'` : `Unit #${u.itemUnitId}`;
      const uExisting = existingSlots.filter((es) => es.itemUnitId === u.itemUnitId);

      for (const reqSlot of u.slots) {
        const isOverlap = uExisting.some((ex) => {
          return ex.startAt < reqSlot.endAt && ex.endAt > reqSlot.startAt;
        });
        if (isOverlap) {
          conflictingSlots.push(`${invCode} (${reqSlot.startAtStr})`);
        }
      }
    }

    if (conflictingSlots.length > 0) {
      throw new AppError(
        409,
        `Beberapa slot waktu untuk unit barang yang dipilih sudah terisi: ${conflictingSlots.join(
          ", "
        )}`
      );
    }

    // f. Insert header ke item_borrowings dengan retry maksimal 5 kali untuk borrowing_code
    let borrowingId: number | null = null;
    let attempts = 0;
    while (attempts < 5) {
      attempts++;
      const code = generateBorrowingCode();
      try {
        const [inserted] = await tx
          .insert(itemBorrowings)
          .values({
            borrowingCode: code,
            userId,
            activityName: input.activityName,
            picName: input.picName,
            picPhone: input.picPhone,
            status: "booked",
          })
          .$returningId();

        if (inserted?.id) {
          borrowingId = inserted.id;
          break;
        }
      } catch (err: unknown) {
        if (isDuplicateKeyError(err)) {
          continue;
        }
        throw err;
      }
    }

    if (!borrowingId) {
      throw new AppError(
        500,
        "Gagal membuat kode peminjaman unik setelah beberapa percobaan. Silakan coba lagi"
      );
    }

    // g. Insert baris ke item_borrowing_units untuk setiap unit, lalu insert semua baris ke item_borrowing_slots secara atomik
    const slotsToInsert: Array<{
      itemBorrowingId: number;
      itemBorrowingUnitId: number;
      itemUnitId: number;
      startAt: string;
      endAt: string;
    }> = [];

    for (const u of unitsData) {
      const [insertedUnit] = await tx
        .insert(itemBorrowingUnits)
        .values({
          itemBorrowingId: borrowingId,
          itemUnitId: u.itemUnitId,
        })
        .$returningId();

      if (!insertedUnit?.id) {
        throw new AppError(500, "Gagal menyimpan unit peminjaman barang");
      }

      for (const s of u.slots) {
        slotsToInsert.push({
          itemBorrowingId: borrowingId,
          itemBorrowingUnitId: insertedUnit.id,
          itemUnitId: u.itemUnitId,
          startAt: s.startAt,
          endAt: s.endAt,
        });
      }
    }

    try {
      if (slotsToInsert.length > 0) {
        await tx.insert(itemBorrowingSlots).values(slotsToInsert);
      }
    } catch (err: unknown) {
      if (isDuplicateKeyError(err)) {
        throw new AppError(
          409,
          "Slot waktu yang dipilih untuk salah satu unit sudah dipinjam oleh pengguna lain"
        );
      }
      throw err;
    }

    createdBorrowingId = borrowingId;
  });

  // Pembacaan data respons dilakukan DI LUAR blok db.transaction
  return await getItemBorrowingById(createdBorrowingId!);
}

export async function confirmItemBorrowingReturn(
  borrowingId: number,
  adminUserId: number,
  input: ReturnItemBorrowingUnitsInput
) {
  await db.transaction(async (tx) => {
    // a. Kunci baris header peminjaman terlebih dahulu
    const [borrowing] = await tx
      .select()
      .from(itemBorrowings)
      .where(eq(itemBorrowings.id, borrowingId))
      .for("update");

    if (!borrowing) {
      throw new AppError(404, "Data peminjaman barang tidak ditemukan");
    }

    // b. Periksa borrowing.status
    if (borrowing.status === "cancelled") {
      throw new AppError(
        400,
        "Peminjaman yang sudah dibatalkan tidak dapat dikonfirmasi pengembaliannya"
      );
    }
    if (borrowing.status === "completed") {
      throw new AppError(
        400,
        "Seluruh unit pada peminjaman ini sudah dikembalikan"
      );
    }

    // c. Kunci baris item_borrowing_units milik peminjaman ini (urutkan berdasarkan item_unit_id ASC dengan FOR UPDATE)
    const existingBorrowingUnits = await tx
      .select({
        id: itemBorrowingUnits.id,
        itemBorrowingId: itemBorrowingUnits.itemBorrowingId,
        itemUnitId: itemBorrowingUnits.itemUnitId,
        returnedAt: itemBorrowingUnits.returnedAt,
        inventoryCode: itemUnits.inventoryCode,
      })
      .from(itemBorrowingUnits)
      .innerJoin(itemUnits, eq(itemBorrowingUnits.itemUnitId, itemUnits.id))
      .where(eq(itemBorrowingUnits.itemBorrowingId, borrowingId))
      .orderBy(asc(itemBorrowingUnits.itemUnitId))
      .for("update");

    // Kunci baris item_units yang akan dikembalikan (urutkan berdasarkan id ASC dengan FOR UPDATE)
    const returnUnitIdsSorted = input.units
      .map((u) => u.itemUnitId)
      .sort((a, b) => a - b);

    if (returnUnitIdsSorted.length > 0) {
      await tx
        .select()
        .from(itemUnits)
        .where(inArray(itemUnits.id, returnUnitIdsSorted))
        .orderBy(asc(itemUnits.id))
        .for("update");
    }

    // d. Validasi setiap itemUnitId yang dikirim dalam input.units
    const borrowingUnitsMap = new Map(
      existingBorrowingUnits.map((bu) => [bu.itemUnitId, bu])
    );

    for (const returnItem of input.units) {
      const bu = borrowingUnitsMap.get(returnItem.itemUnitId);
      if (!bu) {
        throw new AppError(
          400,
          `Unit barang (ID: ${returnItem.itemUnitId}) tidak termasuk dalam peminjaman ini`
        );
      }
      if (bu.returnedAt !== null) {
        throw new AppError(
          400,
          `Unit barang '${bu.inventoryCode}' sudah dikonfirmasi dikembalikan sebelumnya`
        );
      }
    }

    // e. Gunakan const nowJakarta = getNowJakartaString() (Aturan 14)
    const nowJakarta = getNowJakartaString();

    for (const returnItem of input.units) {
      const bu = borrowingUnitsMap.get(returnItem.itemUnitId)!;

      // Update baris item_borrowing_units yang dikembalikan
      await tx
        .update(itemBorrowingUnits)
        .set({
          returnedAt: nowJakarta,
          returnedByAdminId: adminUserId,
          returnCondition: returnItem.returnCondition,
          returnNotes: returnItem.returnNotes ?? null,
        })
        .where(eq(itemBorrowingUnits.id, bu.id));

      // Sinkronisasi master unit (item_units)
      await tx
        .update(itemUnits)
        .set({
          condition: returnItem.returnCondition,
        })
        .where(eq(itemUnits.id, returnItem.itemUnitId));
    }

    // f. Cek apakah semua unit pada peminjaman borrowingId sekarang sudah memiliki returnedAt !== null
    const returnedSet = new Set(input.units.map((u) => u.itemUnitId));
    const allReturned = existingBorrowingUnits.every(
      (bu) => bu.returnedAt !== null || returnedSet.has(bu.itemUnitId)
    );

    if (allReturned) {
      await tx
        .update(itemBorrowings)
        .set({
          status: "completed",
          completedAt: nowJakarta,
        })
        .where(eq(itemBorrowings.id, borrowingId));
    }
  });

  // Pembacaan data respons dilakukan DI LUAR blok db.transaction
  return await getItemBorrowingById(borrowingId);
}

export async function getItemBorrowingById(
  id: number,
  requester?: { userId: number; role: string }
) {
  const [borrowing] = await db
    .select()
    .from(itemBorrowings)
    .where(eq(itemBorrowings.id, id))
    .limit(1);

  if (!borrowing) {
    throw new AppError(404, "Peminjaman barang tidak ditemukan");
  }

  if (
    requester &&
    requester.role !== "admin" &&
    borrowing.userId !== requester.userId
  ) {
    throw new AppError(403, "Anda tidak memiliki akses ke data peminjaman ini");
  }

  const [user] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
    })
    .from(users)
    .where(eq(users.id, borrowing.userId))
    .limit(1);

  const borrowingUnitsList = await db
    .select({
      id: itemBorrowingUnits.id,
      itemBorrowingId: itemBorrowingUnits.itemBorrowingId,
      itemUnitId: itemBorrowingUnits.itemUnitId,
      returnedAt: itemBorrowingUnits.returnedAt,
      returnedByAdminId: itemBorrowingUnits.returnedByAdminId,
      returnCondition: itemBorrowingUnits.returnCondition,
      returnNotes: itemBorrowingUnits.returnNotes,
      createdAt: itemBorrowingUnits.createdAt,
      inventoryCode: itemUnits.inventoryCode,
      itemId: itemUnits.itemId,
    })
    .from(itemBorrowingUnits)
    .innerJoin(itemUnits, eq(itemBorrowingUnits.itemUnitId, itemUnits.id))
    .where(eq(itemBorrowingUnits.itemBorrowingId, borrowing.id));

  const itemIds = [...new Set(borrowingUnitsList.map((bu) => bu.itemId))];
  const itemsList =
    itemIds.length > 0
      ? await db
          .select({
            id: items.id,
            name: items.name,
            imageUrl: items.imageUrl,
          })
          .from(items)
          .where(inArray(items.id, itemIds))
      : [];
  const itemMap = new Map(itemsList.map((i) => [i.id, i]));

  const slotsList = await db
    .select()
    .from(itemBorrowingSlots)
    .where(eq(itemBorrowingSlots.itemBorrowingId, borrowing.id))
    .orderBy(asc(itemBorrowingSlots.startAt));

  const slotsByUnit = new Map<number, typeof slotsList>();
  for (const slot of slotsList) {
    const list = slotsByUnit.get(slot.itemBorrowingUnitId) || [];
    list.push(slot);
    slotsByUnit.set(slot.itemBorrowingUnitId, list);
  }

  const nowJakarta = getNowJakartaString();

  const formattedUnits = borrowingUnitsList.map((bu) => {
    const unitSlots = slotsByUnit.get(bu.id) || [];
    const formattedSlots = unitSlots.map((s) => ({
      id: s.id,
      itemBorrowingId: s.itemBorrowingId,
      itemBorrowingUnitId: s.itemBorrowingUnitId,
      itemUnitId: s.itemUnitId,
      startAt: toApiDateTime(s.startAt),
      endAt: toApiDateTime(s.endAt),
      timeStatus: calculateSlotTimeStatus(s.startAt, s.endAt),
      createdAt: s.createdAt.toISOString(),
    }));

    const maxEndAt =
      unitSlots.length > 0
        ? unitSlots.reduce((max, s) => (s.endAt > max ? s.endAt : max), "")
        : "";

    const returnStatus: "returned" | "borrowed" =
      bu.returnedAt !== null ? "returned" : "borrowed";

    const isOverdue =
      borrowing.status === "booked" &&
      bu.returnedAt === null &&
      Boolean(maxEndAt) &&
      maxEndAt < nowJakarta;

    return {
      id: bu.id,
      itemBorrowingId: bu.itemBorrowingId,
      itemUnitId: bu.itemUnitId,
      inventoryCode: bu.inventoryCode,
      returnStatus,
      isOverdue,
      returnedAt: bu.returnedAt ? toApiDateTime(bu.returnedAt) : null,
      returnedByAdminId: bu.returnedByAdminId,
      returnCondition: bu.returnCondition,
      returnNotes: bu.returnNotes,
      createdAt: bu.createdAt.toISOString(),
      item: itemMap.get(bu.itemId) ?? null,
      slots: formattedSlots,
    };
  });

  const timeStatus =
    borrowing.status === "completed"
      ? "completed"
      : calculateBookingTimeStatus(slotsList, borrowing.status as "booked" | "cancelled");

  const hasOverdueUnits = formattedUnits.some((u) => u.isOverdue);

  return {
    id: borrowing.id,
    borrowingCode: borrowing.borrowingCode,
    userId: borrowing.userId,
    activityName: borrowing.activityName,
    picName: borrowing.picName,
    picPhone: borrowing.picPhone,
    status: borrowing.status,
    timeStatus,
    hasOverdueUnits,
    completedAt: borrowing.completedAt
      ? toApiDateTime(borrowing.completedAt)
      : null,
    createdAt: borrowing.createdAt.toISOString(),
    updatedAt: borrowing.updatedAt.toISOString(),
    user: user ?? null,
    units: formattedUnits,
  };
}

export async function getMyItemBorrowings(userId: number) {
  return await getBorrowingsList({ userId });
}

export async function getAllItemBorrowings(filters?: ItemBorrowingFilterInput) {
  return await getBorrowingsList(filters);
}

interface InternalBorrowingFilter extends ItemBorrowingFilterInput {
  userId?: number;
}

async function getBorrowingsList(filters?: InternalBorrowingFilter) {
  let targetBorrowingIds: number[] | null = null;

  if (filters?.itemUnitId) {
    const matchingUnits = await db
      .select({ itemBorrowingId: itemBorrowingUnits.itemBorrowingId })
      .from(itemBorrowingUnits)
      .where(eq(itemBorrowingUnits.itemUnitId, filters.itemUnitId));
    const ids = matchingUnits.map((u) => u.itemBorrowingId);
    targetBorrowingIds = ids;
  }

  if (filters?.date) {
    const matchingSlots = await db
      .select({ itemBorrowingId: itemBorrowingSlots.itemBorrowingId })
      .from(itemBorrowingSlots)
      .where(
        and(
          gte(itemBorrowingSlots.startAt, `${filters.date} 00:00:00`),
          lte(itemBorrowingSlots.startAt, `${filters.date} 23:59:59`)
        )
      );
    const ids = matchingSlots.map((s) => s.itemBorrowingId);
    if (targetBorrowingIds === null) {
      targetBorrowingIds = ids;
    } else {
      const setDateIds = new Set(ids);
      targetBorrowingIds = targetBorrowingIds.filter((id) => setDateIds.has(id));
    }
  }

  if (targetBorrowingIds !== null && targetBorrowingIds.length === 0) {
    return [];
  }

  const conditions = [];
  if (targetBorrowingIds !== null) {
    conditions.push(inArray(itemBorrowings.id, targetBorrowingIds));
  }
  if (filters?.userId) {
    conditions.push(eq(itemBorrowings.userId, filters.userId));
  }
  if (filters?.status) {
    conditions.push(eq(itemBorrowings.status, filters.status));
  }

  const borrowingsList = await db
    .select()
    .from(itemBorrowings)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(itemBorrowings.createdAt));

  if (borrowingsList.length === 0) {
    return [];
  }

  const borrowingIds = borrowingsList.map((b) => b.id);
  const userIds = [...new Set(borrowingsList.map((b) => b.userId))];

  // 1. Ambil data users
  const usersList = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
    })
    .from(users)
    .where(inArray(users.id, userIds));
  const userMap = new Map(usersList.map((u) => [u.id, u]));

  // 2. Ambil data units untuk semua peminjaman ini
  const allBorrowingUnits = await db
    .select({
      id: itemBorrowingUnits.id,
      itemBorrowingId: itemBorrowingUnits.itemBorrowingId,
      itemUnitId: itemBorrowingUnits.itemUnitId,
      returnedAt: itemBorrowingUnits.returnedAt,
      returnedByAdminId: itemBorrowingUnits.returnedByAdminId,
      returnCondition: itemBorrowingUnits.returnCondition,
      returnNotes: itemBorrowingUnits.returnNotes,
      createdAt: itemBorrowingUnits.createdAt,
      inventoryCode: itemUnits.inventoryCode,
      itemId: itemUnits.itemId,
    })
    .from(itemBorrowingUnits)
    .innerJoin(itemUnits, eq(itemBorrowingUnits.itemUnitId, itemUnits.id))
    .where(inArray(itemBorrowingUnits.itemBorrowingId, borrowingIds));

  // 3. Ambil data katalog barang induk
  const itemIds = [...new Set(allBorrowingUnits.map((u) => u.itemId))];
  const itemsList =
    itemIds.length > 0
      ? await db
          .select({
            id: items.id,
            name: items.name,
            imageUrl: items.imageUrl,
          })
          .from(items)
          .where(inArray(items.id, itemIds))
      : [];
  const itemMap = new Map(itemsList.map((i) => [i.id, i]));

  // 4. Ambil semua slots
  const allSlots = await db
    .select()
    .from(itemBorrowingSlots)
    .where(inArray(itemBorrowingSlots.itemBorrowingId, borrowingIds))
    .orderBy(asc(itemBorrowingSlots.startAt));

  const slotsByBorrowingUnit = new Map<number, typeof allSlots>();
  const slotsByBorrowing = new Map<number, typeof allSlots>();

  for (const slot of allSlots) {
    const unitList = slotsByBorrowingUnit.get(slot.itemBorrowingUnitId) || [];
    unitList.push(slot);
    slotsByBorrowingUnit.set(slot.itemBorrowingUnitId, unitList);

    const bList = slotsByBorrowing.get(slot.itemBorrowingId) || [];
    bList.push(slot);
    slotsByBorrowing.set(slot.itemBorrowingId, bList);
  }

  const unitsByBorrowing = new Map<number, typeof allBorrowingUnits>();
  for (const u of allBorrowingUnits) {
    const list = unitsByBorrowing.get(u.itemBorrowingId) || [];
    list.push(u);
    unitsByBorrowing.set(u.itemBorrowingId, list);
  }

  const nowJakarta = getNowJakartaString();

  return borrowingsList.map((b) => {
    const bUnits = unitsByBorrowing.get(b.id) || [];
    const bAllSlots = slotsByBorrowing.get(b.id) || [];

    const formattedUnits = bUnits.map((bu) => {
      const uSlots = slotsByBorrowingUnit.get(bu.id) || [];
      const formattedSlots = uSlots.map((s) => ({
        id: s.id,
        itemBorrowingId: s.itemBorrowingId,
        itemBorrowingUnitId: s.itemBorrowingUnitId,
        itemUnitId: s.itemUnitId,
        startAt: toApiDateTime(s.startAt),
        endAt: toApiDateTime(s.endAt),
        timeStatus: calculateSlotTimeStatus(s.startAt, s.endAt),
        createdAt: s.createdAt.toISOString(),
      }));

      const maxEndAt =
        uSlots.length > 0
          ? uSlots.reduce((max, s) => (s.endAt > max ? s.endAt : max), "")
          : "";

      const returnStatus: "returned" | "borrowed" =
        bu.returnedAt !== null ? "returned" : "borrowed";

      const isOverdue =
        b.status === "booked" &&
        bu.returnedAt === null &&
        Boolean(maxEndAt) &&
        maxEndAt < nowJakarta;

      return {
        id: bu.id,
        itemBorrowingId: bu.itemBorrowingId,
        itemUnitId: bu.itemUnitId,
        inventoryCode: bu.inventoryCode,
        returnStatus,
        isOverdue,
        returnedAt: bu.returnedAt ? toApiDateTime(bu.returnedAt) : null,
        returnedByAdminId: bu.returnedByAdminId,
        returnCondition: bu.returnCondition,
        returnNotes: bu.returnNotes,
        createdAt: bu.createdAt.toISOString(),
        item: itemMap.get(bu.itemId) ?? null,
        slots: formattedSlots,
      };
    });

    const timeStatus =
      b.status === "completed"
        ? "completed"
        : calculateBookingTimeStatus(bAllSlots, b.status as "booked" | "cancelled");

    const hasOverdueUnits = formattedUnits.some((u) => u.isOverdue);

    return {
      id: b.id,
      borrowingCode: b.borrowingCode,
      userId: b.userId,
      activityName: b.activityName,
      picName: b.picName,
      picPhone: b.picPhone,
      status: b.status,
      timeStatus,
      hasOverdueUnits,
      completedAt: b.completedAt ? toApiDateTime(b.completedAt) : null,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
      user: userMap.get(b.userId) ?? null,
      units: formattedUnits,
    };
  });
}

async function checkUnitOverdue(unitId: number): Promise<boolean> {
  const nowJakarta = getNowJakartaString();
  const activeBorrowings = await db
    .select({
      itemBorrowingUnitId: itemBorrowingUnits.id,
      endAt: itemBorrowingSlots.endAt,
    })
    .from(itemBorrowingUnits)
    .innerJoin(
      itemBorrowings,
      eq(itemBorrowingUnits.itemBorrowingId, itemBorrowings.id)
    )
    .innerJoin(
      itemBorrowingSlots,
      eq(itemBorrowingSlots.itemBorrowingUnitId, itemBorrowingUnits.id)
    )
    .where(
      and(
        eq(itemBorrowingUnits.itemUnitId, unitId),
        eq(itemBorrowings.status, "booked"),
        isNull(itemBorrowingUnits.returnedAt)
      )
    );

  const maxEndAtMap = new Map<number, string>();
  for (const ab of activeBorrowings) {
    const cur = maxEndAtMap.get(ab.itemBorrowingUnitId);
    if (!cur || ab.endAt > cur) {
      maxEndAtMap.set(ab.itemBorrowingUnitId, ab.endAt);
    }
  }

  for (const maxEndAt of maxEndAtMap.values()) {
    if (maxEndAt < nowJakarta) {
      return true;
    }
  }
  return false;
}

export async function getItemUnitAvailabilityByDate(
  itemUnitId: number,
  dateStr: string,
  onlyActive: boolean = true
) {
  const [unit] = await db
    .select()
    .from(itemUnits)
    .where(eq(itemUnits.id, itemUnitId))
    .limit(1);

  if (!unit) {
    throw new AppError(404, "Unit barang tidak ditemukan");
  }

  const [item] = await db
    .select()
    .from(items)
    .where(eq(items.id, unit.itemId))
    .limit(1);

  if (onlyActive) {
    if (!unit.isActive || !item || !item.isActive) {
      throw new AppError(404, "Unit barang tidak ditemukan atau tidak aktif");
    }
  }

  const isOverdue = await checkUnitOverdue(itemUnitId);
  const bookable =
    unit.isActive &&
    Boolean(item?.isActive) &&
    unit.condition === "good" &&
    !isOverdue;

  // SATU query rentang waktu per request pada item_borrowing_slots
  const bookedSlots = await db
    .select({
      startAt: itemBorrowingSlots.startAt,
      endAt: itemBorrowingSlots.endAt,
    })
    .from(itemBorrowingSlots)
    .innerJoin(
      itemBorrowings,
      eq(itemBorrowingSlots.itemBorrowingId, itemBorrowings.id)
    )
    .innerJoin(
      itemBorrowingUnits,
      eq(itemBorrowingSlots.itemBorrowingUnitId, itemBorrowingUnits.id)
    )
    .where(
      and(
        eq(itemBorrowingSlots.itemUnitId, itemUnitId),
        eq(itemBorrowings.status, "booked"),
        isNull(itemBorrowingUnits.returnedAt),
        gte(itemBorrowingSlots.startAt, `${dateStr} 00:00:00`),
        lte(itemBorrowingSlots.startAt, `${dateStr} 23:59:59`)
      )
    );

  const bookedStartAtSet = new Set(bookedSlots.map((b) => b.startAt));

  const slots = [];
  for (let h = OPERATIONAL_START_HOUR; h < OPERATIONAL_END_HOUR; h++) {
    const slotStartDb = `${dateStr} ${String(h).padStart(2, "0")}:00:00`;
    const slotEndDb = `${dateStr} ${String(h + 1).padStart(2, "0")}:00:00`;

    const isBooked = bookedStartAtSet.has(slotStartDb);
    const isPast = isSlotPast(slotStartDb);

    let status: "booked" | "past" | "available";
    if (isBooked) {
      status = "booked";
    } else if (isPast) {
      status = "past";
    } else {
      status = "available";
    }

    slots.push({
      startAt: toApiDateTime(slotStartDb),
      endAt: toApiDateTime(slotEndDb),
      status,
    });
  }

  return {
    itemUnitId: unit.id,
    inventoryCode: unit.inventoryCode,
    date: dateStr,
    bookable,
    slots,
  };
}

export async function getItemUnitAvailabilityByMonth(
  itemUnitId: number,
  monthStr: string,
  onlyActive: boolean = true
) {
  const [unit] = await db
    .select()
    .from(itemUnits)
    .where(eq(itemUnits.id, itemUnitId))
    .limit(1);

  if (!unit) {
    throw new AppError(404, "Unit barang tidak ditemukan");
  }

  const [item] = await db
    .select()
    .from(items)
    .where(eq(items.id, unit.itemId))
    .limit(1);

  if (onlyActive) {
    if (!unit.isActive || !item || !item.isActive) {
      throw new AppError(404, "Unit barang tidak ditemukan atau tidak aktif");
    }
  }

  const isOverdue = await checkUnitOverdue(itemUnitId);
  const bookable =
    unit.isActive &&
    Boolean(item?.isActive) &&
    unit.condition === "good" &&
    !isOverdue;

  const parts = monthStr.split("-").map(Number);
  const year = parts[0] ?? 2026;
  const month = parts[1] ?? 1;
  const daysInMonth = getDaysInMonth(year, month);
  const lastDayStr = String(daysInMonth).padStart(2, "0");

  // SATU query rentang waktu per request pada item_borrowing_slots
  const bookedSlots = await db
    .select({
      startAt: itemBorrowingSlots.startAt,
      endAt: itemBorrowingSlots.endAt,
    })
    .from(itemBorrowingSlots)
    .innerJoin(
      itemBorrowings,
      eq(itemBorrowingSlots.itemBorrowingId, itemBorrowings.id)
    )
    .innerJoin(
      itemBorrowingUnits,
      eq(itemBorrowingSlots.itemBorrowingUnitId, itemBorrowingUnits.id)
    )
    .where(
      and(
        eq(itemBorrowingSlots.itemUnitId, itemUnitId),
        eq(itemBorrowings.status, "booked"),
        isNull(itemBorrowingUnits.returnedAt),
        gte(itemBorrowingSlots.startAt, `${monthStr}-01 00:00:00`),
        lte(itemBorrowingSlots.startAt, `${monthStr}-${lastDayStr} 23:59:59`)
      )
    );

  const bookedStartAtSet = new Set(bookedSlots.map((b) => b.startAt));

  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${monthStr}-${String(d).padStart(2, "0")}`;

    let bookedCount = 0;
    let availableCount = 0;

    for (let h = OPERATIONAL_START_HOUR; h < OPERATIONAL_END_HOUR; h++) {
      const slotStartDb = `${dateStr} ${String(h).padStart(2, "0")}:00:00`;
      const isBooked = bookedStartAtSet.has(slotStartDb);
      const isPast = isSlotPast(slotStartDb);

      if (isBooked) {
        bookedCount++;
      } else if (!isPast) {
        availableCount++;
      }
    }

    const lastSlotStartDb = `${dateStr} ${String(
      OPERATIONAL_END_HOUR - 1
    ).padStart(2, "0")}:00:00`;
    const isDayPast = isSlotPast(lastSlotStartDb);

    let status: "past" | "full" | "limited" | "open";
    if (isDayPast) {
      status = "past";
      availableCount = 0;
    } else if (availableCount === 0) {
      status = "full";
    } else if (bookedCount > 0) {
      status = "limited";
    } else {
      status = "open";
    }

    days.push({
      date: dateStr,
      totalSlots: TOTAL_OPERATIONAL_SLOTS,
      bookedCount,
      availableCount,
      status,
    });
  }

  return {
    itemUnitId: unit.id,
    inventoryCode: unit.inventoryCode,
    month: monthStr,
    bookable,
    days,
  };
}
