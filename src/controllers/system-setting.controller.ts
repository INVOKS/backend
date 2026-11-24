import type { Request, Response } from "express";
import * as systemSettingService from "../services/system-setting.service.js";
import { AppError } from "../utils/app-error.js";
import type { UpdateSystemSettingInput } from "../validators/system-setting.validator.js";

export async function list(_req: Request, res: Response): Promise<void> {
  const settings = await systemSettingService.getAllSystemSettings();

  res.status(200).json({
    success: true,
    data: settings,
  });
}

export async function detail(req: Request, res: Response): Promise<void> {
  const key = req.params.key as string;
  const setting = await systemSettingService.getSystemSettingByKey(key);

  res.status(200).json({
    success: true,
    data: setting,
  });
}

export async function update(req: Request, res: Response): Promise<void> {
  if (!req.user?.id) {
    throw new AppError(401, "Pengguna belum terautentikasi");
  }

  const key = req.params.key as string;
  const updated = await systemSettingService.updateSystemSetting(
    key,
    req.user.id,
    req.body as UpdateSystemSettingInput
  );

  res.status(200).json({
    success: true,
    message: `Pengaturan sistem '${key}' berhasil diperbarui`,
    data: updated,
  });
}
