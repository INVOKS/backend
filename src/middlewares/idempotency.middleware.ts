import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { eq, and, gt } from "drizzle-orm";
import { db } from "../db/index.js";
import { idempotencyRequests } from "../db/schema/idempotency-requests.js";
import { AppError } from "../utils/app-error.js";
import { sendError } from "../utils/response.js";

/**
 * Middleware idempotency opsional.
 * Jika header `Idempotency-Key` dikirim:
 * 1. Menghitung SHA-256 dari payload `req.body`.
 * 2. Cek apakah operasi dengan key yang sama sudah pernah berhasil diproses:
 *    - Jika payload berbeda: tolak 409 Conflict.
 *    - Jika payload sama: kembalikan langsung respon yang tersimpan tanpa mengeksekusi ulang.
 * 3. Jika belum pernah, intercept respon 2xx dan simpan respon ke database (berlaku 24 jam).
 *
 * Jika header `Idempotency-Key` TIDAK dikirim, request langsung dilanjutkan seperti biasa.
 */
export function idempotency(operation: string) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const rawKey = req.header("Idempotency-Key");

    // Jika header tidak disediakan, lanjutkan tanpa idempotency
    if (!rawKey) {
      next();
      return;
    }

    const key = rawKey.trim();
    if (!key || key.length > 128) {
      throw new AppError(
        400,
        "Idempotency-Key tidak valid (harus berupa string 1–128 karakter)"
      );
    }

    if (!req.user?.id) {
      throw new AppError(401, "Pengguna belum terautentikasi");
    }

    const payloadString = JSON.stringify(req.body ?? {});
    const requestHash = crypto
      .createHash("sha256")
      .update(payloadString)
      .digest("hex");

    // Cek apakah key sudah pernah digunakan untuk user & operasi ini
    const existingRows = await db
      .select({
        id: idempotencyRequests.id,
        requestHash: idempotencyRequests.requestHash,
        responseStatus: idempotencyRequests.responseStatus,
        responseBody: idempotencyRequests.responseBody,
        expiresAt: idempotencyRequests.expiresAt,
      })
      .from(idempotencyRequests)
      .where(
        and(
          eq(idempotencyRequests.userId, req.user.id),
          eq(idempotencyRequests.operation, operation),
          eq(idempotencyRequests.idempotencyKey, key),
          gt(idempotencyRequests.expiresAt, new Date())
        )
      )
      .limit(1);

    const existing = existingRows[0];
    if (existing) {
      if (existing.requestHash !== requestHash) {
        sendError(res, {
          statusCode: 409,
          message:
            "Idempotency-Key sudah digunakan dengan payload permintaan yang berbeda",
        });
        return;
      }

      // Replay respons tersimpan
      res.status(existing.responseStatus).json(existing.responseBody);
      return;
    }

    // Intercept res.json untuk menyimpan respons sukses (2xx)
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      const statusCode = res.statusCode;

      if (statusCode >= 200 && statusCode < 300) {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 jam
        db.insert(idempotencyRequests)
          .values({
            userId: req.user!.id,
            operation,
            idempotencyKey: key,
            requestHash,
            responseStatus: statusCode,
            responseBody: body,
            expiresAt,
          })
          .catch((err) => {
            console.error(
              "Gagal menyimpan catatan idempotency:",
              (err as Error).message ?? err
            );
          });
      }

      return originalJson(body);
    };

    next();
  };
}
