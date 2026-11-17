import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { buildings, type Building } from "../db/schema/buildings.js";
import { AppError } from "../utils/app-error.js";
import type {
  CreateBuildingInput,
  UpdateBuildingInput,
} from "../validators/building.validator.js";

export async function getAllBuildings(onlyActive: boolean = true): Promise<Building[]> {
  if (onlyActive) {
    return await db.query.buildings.findMany({
      where: eq(buildings.isActive, true),
      orderBy: (table, { asc }) => [asc(table.name)],
    });
  }

  return await db.query.buildings.findMany({
    orderBy: (table, { asc }) => [asc(table.name)],
  });
}

export async function getBuildingById(id: number): Promise<Building> {
  const building = await db.query.buildings.findFirst({
    where: eq(buildings.id, id),
  });

  if (!building) {
    throw new AppError(404, "Gedung tidak ditemukan");
  }

  return building;
}

export async function createBuilding(input: CreateBuildingInput): Promise<Building> {
  const existing = await db.query.buildings.findFirst({
    where: eq(buildings.name, input.name),
  });

  if (existing) {
    throw new AppError(409, `Gedung dengan nama '${input.name}' sudah terdaftar`);
  }

  const [inserted] = await db
    .insert(buildings)
    .values({
      name: input.name,
      code: input.code,
      description: input.description,
      imageUrl: input.imageUrl,
      isActive: true,
    })
    .$returningId();

  if (!inserted?.id) {
    throw new AppError(500, "Gagal membuat data gedung baru");
  }

  return await getBuildingById(inserted.id);
}

export async function updateBuilding(
  id: number,
  input: UpdateBuildingInput
): Promise<Building> {
  await getBuildingById(id);

  const hasFields =
    input.name !== undefined ||
    input.code !== undefined ||
    input.description !== undefined ||
    input.imageUrl !== undefined ||
    input.isActive !== undefined;

  if (!hasFields) {
    throw new AppError(400, "Tidak ada data yang diubah");
  }

  if (input.name) {
    const duplicate = await db.query.buildings.findFirst({
      where: eq(buildings.name, input.name),
    });

    if (duplicate && duplicate.id !== id) {
      throw new AppError(409, `Gedung dengan nama '${input.name}' sudah ada`);
    }
  }

  await db
    .update(buildings)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    })
    .where(eq(buildings.id, id));

  return await getBuildingById(id);
}

export async function setBuildingActiveStatus(
  id: number,
  isActive: boolean
): Promise<Building> {
  await getBuildingById(id);

  await db
    .update(buildings)
    .set({ isActive })
    .where(eq(buildings.id, id));

  return await getBuildingById(id);
}

