import type { Request, Response } from "express";
import * as authService from "../services/auth.service.js";
import { AppError } from "../utils/app-error.js";
import type { RegisterInput, LoginInput } from "../validators/auth.validator.js";

export async function register(req: Request, res: Response): Promise<void> {
  const user = await authService.registerUser(req.body as RegisterInput);

  res.status(201).json({
    success: true,
    message: "Registrasi pengguna berhasil",
    data: { user },
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { token, user } = await authService.loginUser(
    req.body as LoginInput,
    "user"
  );

  res.status(200).json({
    success: true,
    message: "Login berhasil",
    data: { token, user },
  });
}

export async function loginAdmin(req: Request, res: Response): Promise<void> {
  const { token, user } = await authService.loginUser(
    req.body as LoginInput,
    "admin"
  );

  res.status(200).json({
    success: true,
    message: "Login admin berhasil",
    data: { token, user },
  });
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user?.id) {
    throw new AppError(401, "Pengguna belum terautentikasi");
  }

  const user = await authService.getUserById(req.user.id);

  res.status(200).json({
    success: true,
    message: "Data profil berhasil diambil",
    data: { user },
  });
}
