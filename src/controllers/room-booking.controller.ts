import type { Request, Response } from "express";
import * as roomBookingService from "../services/room-booking.service.js";
import { AppError } from "../utils/app-error.js";
import {
  createRoomBookingSchema,
  roomBookingFilterSchema,
  roomAvailabilityQuerySchema,
} from "../validators/room-booking.validator.js";
import { sendSuccess } from "../utils/response.js";

export async function create(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(401, "Silakan login terlebih dahulu");
  }

  const validated = createRoomBookingSchema.parse(req.body);
  const data = await roomBookingService.createBooking(userId, validated);

  sendSuccess(res, {
    statusCode: 201,
    message: "Peminjaman ruangan berhasil diajukan",
    data,
  });
}

export async function myBookings(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(401, "Silakan login terlebih dahulu");
  }

  const data = await roomBookingService.getMyBookings(userId);

  sendSuccess(res, {
    message: "Daftar peminjaman saya berhasil diambil",
    data,
  });
}

export async function listAll(req: Request, res: Response): Promise<void> {
  const filter = roomBookingFilterSchema.parse(req.query);
  const data = await roomBookingService.getAllBookings(filter);

  sendSuccess(res, {
    message: "Daftar semua peminjaman ruangan berhasil diambil",
    data,
  });
}

export async function detail(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const user = req.user;
  if (!user) {
    throw new AppError(401, "Silakan login terlebih dahulu");
  }

  const booking = await roomBookingService.getBookingById(id);

  if (user.role !== "admin" && booking.userId !== user.id) {
    throw new AppError(403, "Anda tidak memiliki akses ke data peminjaman ini");
  }

  sendSuccess(res, {
    message: "Detail peminjaman ruangan berhasil diambil",
    data: booking,
  });
}

export async function availability(req: Request, res: Response): Promise<void> {
  const roomId = Number(req.params.id);
  const isAdmin = req.user?.role === "admin";
  const query = roomAvailabilityQuerySchema.parse(req.query);

  let data;
  if (query.date) {
    data = await roomBookingService.getRoomAvailabilityByDate(
      roomId,
      query.date,
      !isAdmin
    );
  } else if (query.month) {
    data = await roomBookingService.getRoomAvailabilityByMonth(
      roomId,
      query.month,
      !isAdmin
    );
  }

  sendSuccess(res, {
    message: "Data ketersediaan ruangan berhasil diambil",
    data,
  });
}
