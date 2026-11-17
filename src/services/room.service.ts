import { eq, and, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { rooms, type Room } from "../db/schema/rooms.js";
import { buildings } from "../db/schema/buildings.js";
import { facilities } from "../db/schema/facilities.js";
import { roomFacilities } from "../db/schema/room-facilities.js";
import { AppError } from "../utils/app-error.js";
import { uploadImage, deleteImage } from "./storage.service.js";
import type {
  CreateRoomInput,
  UpdateRoomInput,
  SetRoomFacilitiesInput,
} from "../validators/room.validator.js";

export interface RoomFilterOptions {
  buildingId?: number | undefined;
  floor?: string | undefined;
  onlyActive?: boolean | undefined;
}

export async function getRooms(options: RoomFilterOptions = {}) {
  const { buildingId, floor, onlyActive = true } = options;

  const conditions = [];

  if (onlyActive) {
    conditions.push(eq(rooms.isActive, true));
    // Ruangan di gedung yang tidak aktif tidak boleh tampil ke user non-admin
    const activeBuildings = db
      .select({ id: buildings.id })
      .from(buildings)
      .where(eq(buildings.isActive, true));
    conditions.push(inArray(rooms.buildingId, activeBuildings));
  }

  if (buildingId !== undefined) {
    conditions.push(eq(rooms.buildingId, buildingId));
  }

  if (floor !== undefined && floor.trim() !== "") {
    conditions.push(eq(rooms.floor, floor.trim()));
  }

  const roomList = await db
    .select()
    .from(rooms)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(rooms.name);

  if (roomList.length === 0) {
    return [];
  }

  const buildingIds = [...new Set(roomList.map((r) => r.buildingId))];
  const roomIds = roomList.map((r) => r.id);

  // Ambil data gedung terkait tanpa lateral join
  const buildingList = await db
    .select({
      id: buildings.id,
      name: buildings.name,
      code: buildings.code,
      isActive: buildings.isActive,
    })
    .from(buildings)
    .where(inArray(buildings.id, buildingIds));

  const buildingMap = new Map(buildingList.map((b) => [b.id, b]));

  // Ambil relasi fasilitas ruangan terkait
  const rfList = await db
    .select()
    .from(roomFacilities)
    .where(inArray(roomFacilities.roomId, roomIds));

  const facilityIds = [...new Set(rfList.map((rf) => rf.facilityId))];
  const facilityList =
    facilityIds.length > 0
      ? await db
          .select()
          .from(facilities)
          .where(inArray(facilities.id, facilityIds))
      : [];

  const facilityMap = new Map(facilityList.map((f) => [f.id, f]));

  const rfMap = new Map<
    number,
    Array<
      (typeof rfList)[0] & {
        facility: (typeof facilityList)[0] | null;
      }
    >
  >();

  for (const rf of rfList) {
    const list = rfMap.get(rf.roomId) || [];
    list.push({
      ...rf,
      facility: facilityMap.get(rf.facilityId) ?? null,
    });
    rfMap.set(rf.roomId, list);
  }

  return roomList.map((room) => ({
    ...room,
    building: buildingMap.get(room.buildingId) ?? null,
    roomFacilities: rfMap.get(room.id) || [],
  }));
}

export async function getRoomById(id: number, onlyActive: boolean = false) {
  const conditions = [eq(rooms.id, id)];

  if (onlyActive) {
    conditions.push(eq(rooms.isActive, true));
    // Ruangan di gedung yang tidak aktif tidak boleh tampil ke user non-admin
    const activeBuildings = db
      .select({ id: buildings.id })
      .from(buildings)
      .where(eq(buildings.isActive, true));
    conditions.push(inArray(rooms.buildingId, activeBuildings));
  }

  const [room] = await db
    .select()
    .from(rooms)
    .where(and(...conditions))
    .limit(1);

  if (!room) {
    throw new AppError(404, "Ruangan tidak ditemukan atau tidak aktif");
  }

  const [building] = await db
    .select()
    .from(buildings)
    .where(eq(buildings.id, room.buildingId))
    .limit(1);

  const rfList = await db
    .select()
    .from(roomFacilities)
    .where(eq(roomFacilities.roomId, room.id));

  const facilityIds = [...new Set(rfList.map((rf) => rf.facilityId))];
  const facilityList =
    facilityIds.length > 0
      ? await db
          .select()
          .from(facilities)
          .where(inArray(facilities.id, facilityIds))
      : [];

  const facilityMap = new Map(facilityList.map((f) => [f.id, f]));

  const roomFacilitiesData = rfList.map((rf) => ({
    ...rf,
    facility: facilityMap.get(rf.facilityId) ?? null,
  }));

  return {
    ...room,
    building: building ?? null,
    roomFacilities: roomFacilitiesData,
  };
}

export async function createRoom(
  input: CreateRoomInput,
  file: Express.Multer.File
): Promise<Room> {
  const building = await db.query.buildings.findFirst({
    where: eq(buildings.id, input.buildingId),
  });

  if (!building) {
    throw new AppError(404, "Gedung yang dipilih tidak ditemukan");
  }

  const existing = await db.query.rooms.findFirst({
    where: and(
      eq(rooms.buildingId, input.buildingId),
      eq(rooms.roomCode, input.roomCode)
    ),
  });

  if (existing) {
    throw new AppError(
      409,
      `Ruangan dengan kode '${input.roomCode}' sudah ada di gedung ${building.name}`
    );
  }

  // Upload foto ke Cloudinary setelah validasi data berhasil
  const { url: imageUrl, publicId: imagePublicId } = await uploadImage(
    file.buffer,
    file.mimetype,
    "invoks/rooms"
  );

  let newRoomId: number;
  try {
    const [inserted] = await db
      .insert(rooms)
      .values({
        buildingId: input.buildingId,
        roomCode: input.roomCode,
        name: input.name,
        floor: input.floor,
        capacityMin: input.capacityMin,
        capacityMax: input.capacityMax,
        description: input.description,
        imageUrl,
        imagePublicId,
        status: input.status || "available",
        isActive: true,
      })
      .$returningId();

    if (!inserted?.id) {
      throw new AppError(500, "Gagal menambahkan ruangan baru");
    }

    newRoomId = inserted.id;
  } catch (err) {
    // Hanya hapus foto jika operasi insert DB itu sendiri yang gagal
    await deleteImage(imagePublicId);
    throw err;
  }

  return await getRoomById(newRoomId);
}

export async function updateRoom(
  id: number,
  input: UpdateRoomInput,
  file?: Express.Multer.File
): Promise<Room> {
  const currentRoom = await getRoomById(id);

  const hasFields =
    input.buildingId !== undefined ||
    input.roomCode !== undefined ||
    input.name !== undefined ||
    input.floor !== undefined ||
    input.capacityMin !== undefined ||
    input.capacityMax !== undefined ||
    input.description !== undefined ||
    input.status !== undefined ||
    input.isActive !== undefined ||
    file !== undefined;

  if (!hasFields) {
    throw new AppError(400, "Tidak ada data yang diubah");
  }

  const targetBuildingId = input.buildingId ?? currentRoom.buildingId;
  const targetRoomCode = input.roomCode ?? currentRoom.roomCode;

  if (input.buildingId !== undefined || input.roomCode !== undefined) {
    const duplicate = await db.query.rooms.findFirst({
      where: and(
        eq(rooms.buildingId, targetBuildingId),
        eq(rooms.roomCode, targetRoomCode)
      ),
    });

    if (duplicate && duplicate.id !== id) {
      throw new AppError(
        409,
        `Ruangan dengan kode '${targetRoomCode}' sudah ada di gedung tersebut`
      );
    }
  }

  let newImageUrl: string | undefined;
  let newImagePublicId: string | undefined;

  if (file) {
    // Upload foto baru dulu
    const result = await uploadImage(file.buffer, file.mimetype, "invoks/rooms");
    newImageUrl = result.url;
    newImagePublicId = result.publicId;
  }

  try {
    await db
      .update(rooms)
      .set({
        ...(input.buildingId !== undefined ? { buildingId: input.buildingId } : {}),
        ...(input.roomCode !== undefined ? { roomCode: input.roomCode } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.floor !== undefined ? { floor: input.floor } : {}),
        ...(input.capacityMin !== undefined ? { capacityMin: input.capacityMin } : {}),
        ...(input.capacityMax !== undefined ? { capacityMax: input.capacityMax } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(newImageUrl !== undefined ? { imageUrl: newImageUrl } : {}),
        ...(newImagePublicId !== undefined ? { imagePublicId: newImagePublicId } : {}),
      })
      .where(eq(rooms.id, id));
  } catch (err) {
    // Jika DB update gagal setelah upload, hapus foto baru agar tidak jadi yatim
    if (newImagePublicId) {
      await deleteImage(newImagePublicId);
    }
    throw err;
  }

  // Hapus foto lama dari Cloudinary SETELAH DB update berhasil
  if (newImagePublicId && currentRoom.imagePublicId && currentRoom.imagePublicId !== newImagePublicId) {
    await deleteImage(currentRoom.imagePublicId);
  }

  return await getRoomById(id);
}

export async function setRoomActiveStatus(
  id: number,
  isActive: boolean
): Promise<Room> {
  await getRoomById(id);

  await db.update(rooms).set({ isActive }).where(eq(rooms.id, id));

  return await getRoomById(id);
}

export async function setRoomFacilities(
  roomId: number,
  input: SetRoomFacilitiesInput
) {
  await getRoomById(roomId);

  // Validasi seluruh facility ID yang dikirim
  for (const item of input.facilities) {
    const facility = await db.query.facilities.findFirst({
      where: eq(facilities.id, item.facilityId),
    });

    if (!facility) {
      throw new AppError(
        404,
        `Fasilitas dengan ID ${item.facilityId} tidak ditemukan`
      );
    }
  }

  // Gunakan transaksi untuk mengganti relasi fasilitas
  await db.transaction(async (tx) => {
    await tx
      .delete(roomFacilities)
      .where(eq(roomFacilities.roomId, roomId));

    if (input.facilities.length > 0) {
      await tx.insert(roomFacilities).values(
        input.facilities.map((f) => ({
          roomId,
          facilityId: f.facilityId,
          quantity: f.quantity,
        }))
      );
    }
  });

  return await getRoomById(roomId);
}
