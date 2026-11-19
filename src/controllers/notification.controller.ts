import type { Request, Response } from "express";
import * as notificationService from "../services/notification.service.js";
import { AppError } from "../utils/app-error.js";
import { notificationQuerySchema } from "../validators/notification.validator.js";

export async function list(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(401, "Silakan login terlebih dahulu");
  }

  const query = notificationQuerySchema.parse(req.query);
  const data = await notificationService.getUserNotifications(userId, query);

  res.status(200).json({
    success: true,
    message: "Daftar notifikasi berhasil diambil",
    data,
  });
}

export async function markRead(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(401, "Silakan login terlebih dahulu");
  }

  const id = Number(req.params.id);
  if (isNaN(id) || id <= 0 || !Number.isInteger(id)) {
    throw new AppError(400, "ID notifikasi tidak valid");
  }

  const data = await notificationService.markNotificationAsRead(id, userId);

  res.status(200).json({
    success: true,
    message: "Notifikasi berhasil ditandai sudah dibaca",
    data,
  });
}

export async function markReadAll(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(401, "Silakan login terlebih dahulu");
  }

  const data = await notificationService.markAllNotificationsAsRead(userId);

  res.status(200).json({
    success: true,
    message: "Semua notifikasi berhasil ditandai sudah dibaca",
    data,
  });
}
