import type { Response } from "express";

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SuccessResponseOptions<T = any> {
  statusCode?: number;
  message?: string;
  data?: T;
  meta?: PaginationMeta | Record<string, any>;
}

export interface ErrorResponseOptions {
  statusCode?: number;
  message: string;
  errors?: Record<string, string> | any;
}

/**
 * Helper terpusat untuk mengirim respons sukses berformat standar.
 * Format standar: { success: true, message?, data?, meta? }
 */
export function sendSuccess<T = any>(
  res: Response,
  options: SuccessResponseOptions<T> = {}
): void {
  const statusCode = options.statusCode ?? 200;
  const payload: Record<string, any> = {
    success: true,
  };

  if (options.message !== undefined) {
    payload.message = options.message;
  }

  if (options.data !== undefined) {
    payload.data = options.data;
  }

  if (options.meta !== undefined) {
    payload.meta = options.meta;
  }

  res.status(statusCode).json(payload);
}

/**
 * Helper terpusat untuk mengirim respons error berformat standar.
 * Format standar: { success: false, message, errors? }
 */
export function sendError(
  res: Response,
  options: ErrorResponseOptions
): void {
  const statusCode = options.statusCode ?? 500;
  const payload: Record<string, any> = {
    success: false,
    message: options.message,
  };

  if (options.errors !== undefined) {
    payload.errors = options.errors;
  }

  res.status(statusCode).json(payload);
}
