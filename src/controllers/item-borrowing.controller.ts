import type { Request, Response } from "express";
import * as itemBorrowingService from "../services/item-borrowing.service.js";
import { AppError } from "../utils/app-error.js";
import {
  createItemBorrowingSchema,
  itemBorrowingFilterSchema,
  returnItemBorrowingUnitsSchema,
} from "../validators/item-borrowing.validator.js";
import { sendSuccess } from "../utils/response.js";

export async function create(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(401, "Silakan login terlebih dahulu");
  }

  const validated = createItemBorrowingSchema.parse(req.body);
  const data = await itemBorrowingService.createItemBorrowing(userId, validated);

  sendSuccess(res, {
    statusCode: 201,
    message: "Peminjaman barang berhasil diajukan",
    data,
  });
}

export async function myBorrowings(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(401, "Silakan login terlebih dahulu");
  }

  const data = await itemBorrowingService.getMyItemBorrowings(userId);

  sendSuccess(res, {
    message: "Daftar peminjaman barang saya berhasil diambil",
    data,
  });
}

export async function listAll(req: Request, res: Response): Promise<void> {
  const filter = itemBorrowingFilterSchema.parse(req.query);
  const data = await itemBorrowingService.getAllItemBorrowings(filter);

  sendSuccess(res, {
    message: "Daftar semua peminjaman barang berhasil diambil",
    data,
  });
}

export async function detail(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const user = req.user;
  if (!user) {
    throw new AppError(401, "Silakan login terlebih dahulu");
  }

  const data = await itemBorrowingService.getItemBorrowingById(id, {
    userId: user.id,
    role: user.role,
  });

  sendSuccess(res, {
    message: "Detail peminjaman barang berhasil diambil",
    data,
  });
}

export async function confirmReturn(
  req: Request,
  res: Response
): Promise<void> {
  const borrowingId = Number(req.params.id);
  if (isNaN(borrowingId) || borrowingId <= 0 || !Number.isInteger(borrowingId)) {
    throw new AppError(400, "ID peminjaman barang tidak valid");
  }

  const adminUserId = req.user?.id;
  if (!adminUserId) {
    throw new AppError(401, "Silakan login terlebih dahulu");
  }

  const validated = returnItemBorrowingUnitsSchema.parse(req.body);
  const data = await itemBorrowingService.confirmItemBorrowingReturn(
    borrowingId,
    adminUserId,
    validated
  );

  sendSuccess(res, {
    message: "Pengembalian unit barang berhasil dikonfirmasi",
    data,
  });
}
