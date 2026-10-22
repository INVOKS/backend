import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/app-error.js";
import { verifyToken } from "../utils/jwt.js";

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AppError(401, "Akses ditolak: token tidak ditemukan");
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    throw new AppError(401, "Akses ditolak: token tidak ditemukan");
  }

  const decoded = verifyToken(token);
  req.user = decoded;
  next();
}
