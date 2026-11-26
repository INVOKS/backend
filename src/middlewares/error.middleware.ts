import type { Request, Response, NextFunction } from "express";
import multer from "multer";
import { AppError } from "../utils/app-error.js";
import { ZodError } from "zod";
import { MAX_UPLOAD_MB } from "./upload.middleware.js";
import { sendError } from "../utils/response.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof multer.MulterError) {
    let message = "Terjadi kesalahan pada upload file";
    if (err.code === "LIMIT_FILE_SIZE") {
      message = `Ukuran file terlalu besar. Maksimal ${MAX_UPLOAD_MB} MB`;
    }
    sendError(res, {
      statusCode: 400,
      message,
    });
    return;
  }

  // Tangani error dari Cloudinary (misalnya file terlalu besar atau terlalu banyak pixel)
  if (
    err instanceof Error &&
    !(err instanceof AppError) &&
    !(err instanceof ZodError) &&
    (err.message.includes("File size too large") ||
      err.message.includes("too many pixels") ||
      err.message.includes("Invalid image file") ||
      (err.constructor.name === "Error" && err.message.startsWith("Upload ke Cloudinary gagal")))
  ) {
    sendError(res, {
      statusCode: 400,
      message: "File gambar tidak valid atau terlalu besar untuk diproses",
    });
    return;
  }

  if (err instanceof AppError) {
    sendError(res, {
      statusCode: err.statusCode,
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
    sendError(res, {
      statusCode: 400,
      message: "Validasi data gagal",
      errors: formattedErrors,
    });
    return;
  }

  console.error("Unhandled Error:", err);
  sendError(res, {
    statusCode: 500,
    message: "Terjadi kesalahan internal pada server",
  });
}
