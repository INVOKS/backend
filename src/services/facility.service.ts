import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { facilities, type Facility } from "../db/schema/facilities.js";
import { roomFacilities } from "../db/schema/room-facilities.js";
import { AppError } from "../utils/app-error.js";
import type {
  CreateFacilityInput,
  UpdateFacilityInput,
} from "../validators/facility.validator.js";

export async function getAllFacilities(): Promise<Facility[]> {
  return await db.query.facilities.findMany({
    orderBy: (table, { asc }) => [asc(table.name)],
  });
}

export async function getFacilityById(id: number): Promise<Facility> {
  const facility = await db.query.facilities.findFirst({
    where: eq(facilities.id, id),
  });

  if (!facility) {
    throw new AppError(404, "Fasilitas tidak ditemukan");
  }

  return facility;
}

export async function createFacility(input: CreateFacilityInput): Promise<Facility> {
  const existing = await db.query.facilities.findFirst({
    where: eq(facilities.name, input.name),
  });

  if (existing) {
    throw new AppError(409, `Fasilitas '${input.name}' sudah terdaftar`);
  }

  const [inserted] = await db
    .insert(facilities)
    .values({
      name: input.name,
      icon: input.icon,
      description: input.description,
    })
    .$returningId();

  if (!inserted?.id) {
    throw new AppError(500, "Gagal membuat fasilitas baru");
  }

  return await getFacilityById(inserted.id);
}

export async function updateFacility(
  id: number,
  input: UpdateFacilityInput
): Promise<Facility> {
  await getFacilityById(id);

  if (input.name) {
    const duplicate = await db.query.facilities.findFirst({
      where: eq(facilities.name, input.name),
    });

    if (duplicate && duplicate.id !== id) {
      throw new AppError(409, `Fasilitas dengan nama '${input.name}' sudah ada`);
    }
  }

  await db
    .update(facilities)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    })
    .where(eq(facilities.id, id));

  return await getFacilityById(id);
}

export async function deleteFacility(id: number): Promise<void> {
  await getFacilityById(id);

  const used = await db.query.roomFacilities.findFirst({
    where: eq(roomFacilities.facilityId, id),
  });

  if (used) {
    throw new AppError(
      400,
      "Fasilitas tidak dapat dihapus karena masih digunakan di salah satu ruangan"
    );
  }

  await db.delete(facilities).where(eq(facilities.id, id));
}

