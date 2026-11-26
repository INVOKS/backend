import type { Request, Response, NextFunction } from "express";
import { type ZodType, ZodError } from "zod";
import { sendError } from "../utils/response.js";

export function validateBody<T>(schema: ZodType<T>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync(req.body);
      req.body = parsed;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors: Record<string, string> = {};
        for (const issue of error.issues) {
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
      next(error);
    }
  };
}

export function validateQuery<T>(schema: ZodType<T>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync(req.query);
      // Di Express 5, req.query adalah getter pada prototype.
      // Gunakan Object.defineProperty agar tidak melempar TypeError saat reassign.
      Object.defineProperty(req, "query", {
        value: parsed,
        writable: true,
        enumerable: true,
        configurable: true,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors: Record<string, string> = {};
        for (const issue of error.issues) {
          const path = issue.path.join(".");
          if (path && !formattedErrors[path]) {
            formattedErrors[path] = issue.message;
          }
        }
        sendError(res, {
          statusCode: 400,
          message: "Validasi parameter kueri gagal",
          errors: formattedErrors,
        });
        return;
      }
      next(error);
    }
  };
}
