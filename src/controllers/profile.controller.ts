import type { Request, Response } from "express";
import * as profileService from "../services/profile.service.js";
import { AppError } from "../utils/app-error.js";
import type {
  UpdateProfileInput,
  ChangePasswordInput,
} from "../validators/profile.validator.js";

export async function getProfile(req: Request, res: Response): Promise<void> {
  if (!req.user?.id) {
    throw new AppError(401, "Pengguna belum terautentikasi");
  }

  const profile = await profileService.getProfile(req.user.id);

  res.status(200).json({
    success: true,
    data: profile,
  });
}

export async function updateProfile(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.user?.id) {
    throw new AppError(401, "Pengguna belum terautentikasi");
  }

  const profile = await profileService.updateProfile(
    req.user.id,
    req.body as UpdateProfileInput
  );

  res.status(200).json({
    success: true,
    message: "Profil berhasil diperbarui",
    data: profile,
  });
}

export async function updateAvatar(req: Request, res: Response): Promise<void> {
  if (!req.user?.id) {
    throw new AppError(401, "Pengguna belum terautentikasi");
  }

  const profile = await profileService.updateAvatar(req.user.id, req.file);

  res.status(200).json({
    success: true,
    message: "Foto profil berhasil diperbarui",
    data: profile,
  });
}

export async function changePassword(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.user?.id) {
    throw new AppError(401, "Pengguna belum terautentikasi");
  }

  await profileService.changePassword(
    req.user.id,
    req.body as ChangePasswordInput
  );

  res.status(200).json({
    success: true,
    message: "Kata sandi berhasil diubah",
  });
}
