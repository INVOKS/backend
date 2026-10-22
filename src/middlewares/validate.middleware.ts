import type { Request, Response, NextFunction } from "express";
import { type ZodType, ZodError } from "zod";

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
        res.status(400).json({
          success: false,
          message: "Validasi data gagal",
          errors: formattedErrors,
        });
        return;
      }
      next(error);
    }
  };
}
