import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/app-error.js";
import { ZodError } from "zod";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  if (err instanceof ZodError) {
    const formattedErrors: Record<string, string> = {};
    for (const issue of err.issues) {
      const path = issue.path.join(".");
      if (path && !formattedErrors[path]) {
        formattedErrors[path] = issue.message;
      }
    }
    res.status(400).json({
      success: false,
      message: "Validasi data gagal",
      errors: formattedErrors,
    });
    return;
  }

  console.error("Unhandled Error:", err);
  res.status(500).json({
    success: false,
    message: "Terjadi kesalahan internal pada server",
  });
}
