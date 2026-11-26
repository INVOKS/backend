import type { Request, Response } from "express";
import * as profileService from "../services/profile.service.js";
import { AppError } from "../utils/app-error.js";
import { sendSuccess } from "../utils/response.js";
import type {
  UpdateProfileInput,
  ChangePasswordInput,
} from "../validators/profile.validator.js";

export async function getProfile(req: Request, res: Response): Promise<void> {
  if (!req.user?.id) {
    throw new AppError(401, "Pengguna belum terautentikasi");
  }

  const profile = await profileService.getProfile(req.user.id);

  sendSuccess(res, {
    statusCode: 200,
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

  sendSuccess(res, {
    statusCode: 200,
    message: "Profil berhasil diperbarui",
    data: profile,
  });
}

export async function updateAvatar(req: Request, res: Response): Promise<void> {
  if (!req.user?.id) {
    throw new AppError(401, "Pengguna belum terautentikasi");
  }

  const profile = await profileService.updateAvatar(req.user.id, req.file);

  sendSuccess(res, {
    statusCode: 200,
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

  sendSuccess(res, {
    statusCode: 200,
    message: "Kata sandi berhasil diubah",
  });
}
