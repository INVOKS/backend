import { eq, and, inArray, gte, lte, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import { roomBookings, type RoomBooking } from "../db/schema/room-bookings.js";
import {
  roomBookingSlots,
  type RoomBookingSlot,
} from "../db/schema/room-booking-slots.js";
import { rooms } from "../db/schema/rooms.js";
import { buildings } from "../db/schema/buildings.js";
import { users } from "../db/schema/users.js";
import { AppError } from "../utils/app-error.js";
import {
  getNowJakartaString,
  formatInputSlotToDbString,
  addOneHourJakarta,
  generateBookingCode,
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
  CreateRoomBookingInput,
  RoomBookingFilterInput,
} from "../validators/room-booking.validator.js";

export { TimeStatus, calculateBookingTimeStatus, calculateSlotTimeStatus };

export async function createBooking(
  userId: number,
  input: CreateRoomBookingInput
) {
  const slotRecords = input.slots.map((s) => {
    const startAt = formatInputSlotToDbString(s.startAt);
    const endAt = addOneHourJakarta(startAt);
    return {
      startAtStr: s.startAt,
      startAt,
      endAt,
    };
  });

  let createdBookingId: number;

  await db.transaction(async (tx) => {
    // 1. Lock baris rooms dengan SELECT ... FOR UPDATE
    const [room] = await tx
      .select()
      .from(rooms)
      .where(eq(rooms.id, input.roomId))
      .for("update");

    if (!room) {
      throw new AppError(404, "Ruangan tidak ditemukan");
    }

    if (!room.isActive) {
      throw new AppError(400, "Ruangan sedang tidak aktif atau diarsipkan");
    }

    // Periksa status gedung
    const [building] = await tx
      .select()
      .from(buildings)
      .where(eq(buildings.id, room.buildingId))
      .limit(1);

    if (!building || !building.isActive) {
      throw new AppError(
        400,
        "Gedung tempat ruangan ini berada sedang tidak aktif atau diarsipkan"
      );
    }

    // Booking hanya ditolak jika status 'maintenance'. Status 'borrowed' diizinkan (slot bentrok dicek jadwal).
    if (room.status === "maintenance") {
      throw new AppError(
        400,
        "Ruangan sedang dalam perbaikan/pemeliharaan (maintenance) dan tidak dapat dibooking"
      );
    }

    if (input.participantCount > room.capacityMax) {
      throw new AppError(
        400,
        `Jumlah peserta (${input.participantCount}) melebihi kapasitas maksimal ruangan (${room.capacityMax})`
      );
    }

    // 2. Cek bentrok terhadap slot milik booking berstatus 'booked' di room_id yang sama
    const existingSlots = await tx
      .select({
        startAt: roomBookingSlots.startAt,
        endAt: roomBookingSlots.endAt,
      })
      .from(roomBookingSlots)
      .innerJoin(
        roomBookings,
        eq(roomBookingSlots.roomBookingId, roomBookings.id)
      )
      .where(
        and(
          eq(roomBookingSlots.roomId, input.roomId),
          eq(roomBookings.status, "booked")
        )
      );

    const conflictingSlots: string[] = [];
    for (const reqSlot of slotRecords) {
      const isOverlap = existingSlots.some((ex) => {
        // Interval [start_at, end_at): overlap jika ex.startAt < reqSlot.endAt && ex.endAt > reqSlot.startAt
        return ex.startAt < reqSlot.endAt && ex.endAt > reqSlot.startAt;
      });
      if (isOverlap) {
        conflictingSlots.push(reqSlot.startAtStr);
      }
    }

    if (conflictingSlots.length > 0) {
      throw new AppError(
        409,
        `Beberapa slot waktu yang dipilih sudah terisi: ${conflictingSlots.join(
          ", "
        )}`
      );
    }

    // 3. Simpan header pemesanan dengan penanganan bentrok booking_code (coba ulang hingga 5 kali)
    let bookingId: number | null = null;
    let attempts = 0;
    while (attempts < 5) {
      attempts++;
      const code = generateBookingCode();
      try {
        const [inserted] = await tx
          .insert(roomBookings)
          .values({
            bookingCode: code,
            userId,
            roomId: input.roomId,
            activityName: input.activityName,
            activityDescription: input.activityDescription,
            organizer: input.organizer,
            participantCount: input.participantCount,
            picName: input.picName,
            picPhone: input.picPhone,
            status: "booked",
          })
          .$returningId();

        if (inserted?.id) {
          bookingId = inserted.id;
          break;
        }
      } catch (err: any) {
        const isDuplicateCode =
          err?.code === "ER_DUP_ENTRY" &&
          (String(err?.message || "").includes("booking_code") ||
            String(err?.sqlMessage || "").includes("booking_code"));

        if (isDuplicateCode) {
          continue;
        }
        throw err;
      }
    }

    if (!bookingId) {
      throw new AppError(
        500,
        "Gagal membuat kode booking unik setelah beberapa percobaan. Silakan coba lagi"
      );
    }

    // 4. Simpan semua slot secara atomik
    try {
      await tx.insert(roomBookingSlots).values(
        slotRecords.map((s) => ({
          roomBookingId: bookingId,
          roomId: input.roomId,
          startAt: s.startAt,
          endAt: s.endAt,
        }))
      );
    } catch (err: any) {
      if (err?.code === "ER_DUP_ENTRY") {
        throw new AppError(
          409,
          "Slot waktu yang dipilih sudah dibooking oleh pengguna lain"
        );
      }
      throw err;
    }

    createdBookingId = bookingId;
  });

  // 5. Pembacaan data respons dilakukan DI LUAR blok transaksi
  return await getBookingById(createdBookingId!);
}

export async function getBookingById(id: number) {
  const [booking] = await db
    .select()
    .from(roomBookings)
    .where(eq(roomBookings.id, id))
    .limit(1);

  if (!booking) {
    throw new AppError(404, "Peminjaman ruangan tidak ditemukan");
  }

  const [room] = await db
    .select()
    .from(rooms)
    .where(eq(rooms.id, booking.roomId))
    .limit(1);

  const [building] = room
    ? await db
        .select()
        .from(buildings)
        .where(eq(buildings.id, room.buildingId))
        .limit(1)
    : [null];

  const [user] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
    })
    .from(users)
    .where(eq(users.id, booking.userId))
    .limit(1);

  const slots = await db
    .select()
    .from(roomBookingSlots)
    .where(eq(roomBookingSlots.roomBookingId, booking.id))
    .orderBy(roomBookingSlots.startAt);

  const slotsWithStatus = slots.map((s) => ({
    ...s,
    startAt: toApiDateTime(s.startAt),
    endAt: toApiDateTime(s.endAt),
    timeStatus: calculateSlotTimeStatus(s.startAt, s.endAt),
  }));

  const timeStatus = calculateBookingTimeStatus(slots, booking.status);

  return {
    ...booking,
    timeStatus,
    user: user ?? null,
    room: room
      ? {
          ...room,
          building: building ?? null,
        }
      : null,
    slots: slotsWithStatus,
  };
}

export async function getMyBookings(userId: number) {
  const bookingsList = await db
    .select()
    .from(roomBookings)
    .where(eq(roomBookings.userId, userId))
    .orderBy(desc(roomBookings.createdAt));

  if (bookingsList.length === 0) {
    return [];
  }

  return await enrichBookings(bookingsList);
}

export async function getAllBookings(filter: RoomBookingFilterInput = {}) {
  const conditions = [];

  if (filter.roomId !== undefined) {
    conditions.push(eq(roomBookings.roomId, filter.roomId));
  }

  if (filter.status !== undefined) {
    conditions.push(eq(roomBookings.status, filter.status));
  }

  if (filter.date !== undefined && filter.date.trim() !== "") {
    const startOfDay = `${filter.date.trim()} 00:00:00`;
    const endOfDay = `${filter.date.trim()} 23:59:59`;

    const matchingSlots = await db
      .select({ roomBookingId: roomBookingSlots.roomBookingId })
      .from(roomBookingSlots)
      .where(
        and(
          gte(roomBookingSlots.startAt, startOfDay),
          lte(roomBookingSlots.startAt, endOfDay)
        )
      );

    const bookingIds = [...new Set(matchingSlots.map((s) => s.roomBookingId))];
    if (bookingIds.length === 0) {
      return [];
    }
    conditions.push(inArray(roomBookings.id, bookingIds));
  }

  const bookingsList = await db
    .select()
    .from(roomBookings)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(roomBookings.createdAt));

  if (bookingsList.length === 0) {
    return [];
  }

  return await enrichBookings(bookingsList);
}

async function enrichBookings(bookingsList: RoomBooking[]) {
  const bookingIds = bookingsList.map((b) => b.id);
  const roomIds = [...new Set(bookingsList.map((b) => b.roomId))];
  const userIds = [...new Set(bookingsList.map((b) => b.userId))];

  // Batch fetch rooms
  const roomsList =
    roomIds.length > 0
      ? await db.select().from(rooms).where(inArray(rooms.id, roomIds))
      : [];
  const roomMap = new Map(roomsList.map((r) => [r.id, r]));

  // Batch fetch buildings
  const buildingIds = [...new Set(roomsList.map((r) => r.buildingId))];
  const buildingsList =
    buildingIds.length > 0
      ? await db
          .select()
          .from(buildings)
          .where(inArray(buildings.id, buildingIds))
      : [];
  const buildingMap = new Map(buildingsList.map((b) => [b.id, b]));

  // Batch fetch users
  const usersList =
    userIds.length > 0
      ? await db
          .select({
            id: users.id,
            fullName: users.fullName,
            email: users.email,
            phone: users.phone,
          })
          .from(users)
          .where(inArray(users.id, userIds))
      : [];
  const userMap = new Map(usersList.map((u) => [u.id, u]));

  // Batch fetch slots
  const allSlots =
    bookingIds.length > 0
      ? await db
          .select()
          .from(roomBookingSlots)
          .where(inArray(roomBookingSlots.roomBookingId, bookingIds))
          .orderBy(roomBookingSlots.startAt)
      : [];

  const slotsMap = new Map<number, RoomBookingSlot[]>();
  for (const slot of allSlots) {
    const list = slotsMap.get(slot.roomBookingId) || [];
    list.push(slot);
    slotsMap.set(slot.roomBookingId, list);
  }

  return bookingsList.map((b) => {
    const bSlots = slotsMap.get(b.id) || [];
    const slotsWithStatus = bSlots.map((s) => ({
      ...s,
      startAt: toApiDateTime(s.startAt),
      endAt: toApiDateTime(s.endAt),
      timeStatus: calculateSlotTimeStatus(s.startAt, s.endAt),
    }));
    const timeStatus = calculateBookingTimeStatus(bSlots, b.status);
    const room = roomMap.get(b.roomId);
    const building = room ? buildingMap.get(room.buildingId) : null;

    return {
      ...b,
      timeStatus,
      user: userMap.get(b.userId) ?? null,
      room: room
        ? {
            ...room,
            building: building ?? null,
          }
        : null,
      slots: slotsWithStatus,
    };
  });
}

export async function getRoomAvailabilityByDate(
  roomId: number,
  dateStr: string,
  onlyActive: boolean = true
) {
  const [room] = await db
    .select()
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .limit(1);

  if (!room) {
    throw new AppError(404, "Ruangan tidak ditemukan");
  }

  const [building] = await db
    .select()
    .from(buildings)
    .where(eq(buildings.id, room.buildingId))
    .limit(1);

  if (onlyActive) {
    if (!room.isActive || !building || !building.isActive) {
      throw new AppError(404, "Ruangan tidak ditemukan atau tidak aktif");
    }
  }

  const bookable =
    room.isActive && Boolean(building?.isActive) && room.status !== "maintenance";

  // SATU query rentang waktu per request pada room_booking_slots join room_bookings berstatus 'booked'
  const bookedSlots = await db
    .select({
      startAt: roomBookingSlots.startAt,
      endAt: roomBookingSlots.endAt,
    })
    .from(roomBookingSlots)
    .innerJoin(
      roomBookings,
      eq(roomBookingSlots.roomBookingId, roomBookings.id)
    )
    .where(
      and(
        eq(roomBookingSlots.roomId, roomId),
        eq(roomBookings.status, "booked"),
        gte(roomBookingSlots.startAt, `${dateStr} 00:00:00`),
        lte(roomBookingSlots.startAt, `${dateStr} 23:59:59`)
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
    // Prioritas: "booked" lebih tinggi dari "past"
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
    roomId: room.id,
    date: dateStr,
    bookable,
    slots,
  };
}

export async function getRoomAvailabilityByMonth(
  roomId: number,
  monthStr: string,
  onlyActive: boolean = true
) {
  const [room] = await db
    .select()
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .limit(1);

  if (!room) {
    throw new AppError(404, "Ruangan tidak ditemukan");
  }

  const [building] = await db
    .select()
    .from(buildings)
    .where(eq(buildings.id, room.buildingId))
    .limit(1);

  if (onlyActive) {
    if (!room.isActive || !building || !building.isActive) {
      throw new AppError(404, "Ruangan tidak ditemukan atau tidak aktif");
    }
  }

  const bookable =
    room.isActive && Boolean(building?.isActive) && room.status !== "maintenance";

  const parts = monthStr.split("-").map(Number);
  const year = parts[0] ?? 2026;
  const month = parts[1] ?? 1;
  const daysInMonth = getDaysInMonth(year, month);
  const lastDayStr = String(daysInMonth).padStart(2, "0");

  // SATU query rentang waktu per request pada room_booking_slots join room_bookings berstatus 'booked'
  const bookedSlots = await db
    .select({
      startAt: roomBookingSlots.startAt,
      endAt: roomBookingSlots.endAt,
    })
    .from(roomBookingSlots)
    .innerJoin(
      roomBookings,
      eq(roomBookingSlots.roomBookingId, roomBookings.id)
    )
    .where(
      and(
        eq(roomBookingSlots.roomId, roomId),
        eq(roomBookings.status, "booked"),
        gte(roomBookingSlots.startAt, `${monthStr}-01 00:00:00`),
        lte(roomBookingSlots.startAt, `${monthStr}-${lastDayStr} 23:59:59`)
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

    // Status per tanggal:
    // - "past": semua slot hari itu sudah lewat (tanggal sebelum hari ini, atau hari ini setelah slot terakhir lewat), terlepas dari ada booking atau tidak
    // Slot operasional terakhir mulai jam 18:00 (OPERATIONAL_END_HOUR - 1).
    const lastSlotStartDb = `${dateStr} ${String(OPERATIONAL_END_HOUR - 1).padStart(2, "0")}:00:00`;
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
    roomId: room.id,
    month: monthStr,
    bookable,
    days,
  };
}
