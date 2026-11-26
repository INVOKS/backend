import type { Request, Response } from "express";
import * as authService from "../services/auth.service.js";
import { AppError } from "../utils/app-error.js";
import { sendSuccess } from "../utils/response.js";
import type { RegisterInput, LoginInput } from "../validators/auth.validator.js";

export async function register(req: Request, res: Response): Promise<void> {
  const user = await authService.registerUser(req.body as RegisterInput);

  sendSuccess(res, {
    statusCode: 201,
    message: "Registrasi pengguna berhasil",
    data: { user },
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { token, user } = await authService.loginUser(
    req.body as LoginInput,
    "user"
  );

  sendSuccess(res, {
    statusCode: 200,
    message: "Login berhasil",
    data: { token, user },
  });
}

export async function loginAdmin(req: Request, res: Response): Promise<void> {
  const { token, user } = await authService.loginUser(
    req.body as LoginInput,
    "admin"
  );

  sendSuccess(res, {
    statusCode: 200,
    message: "Login admin berhasil",
    data: { token, user },
  });
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user?.id) {
    throw new AppError(401, "Pengguna belum terautentikasi");
  }

  const user = await authService.getUserById(req.user.id);

  sendSuccess(res, {
    statusCode: 200,
    message: "Data profil berhasil diambil",
    data: { user },
  });
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const result = await authService.forgotPassword(req.body);
  sendSuccess(res, {
    statusCode: 200,
    message: result.message,
  });
}

export async function verifyResetOtp(req: Request, res: Response): Promise<void> {
  const result = await authService.verifyResetOtp(req.body);
  sendSuccess(res, {
    statusCode: 200,
    message: "Kode OTP berhasil diverifikasi",
    data: result,
  });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const result = await authService.resetPassword(req.body);
  sendSuccess(res, {
    statusCode: 200,
    message: result.message,
  });
}
