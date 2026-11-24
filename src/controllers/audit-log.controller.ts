import type { Request, Response } from "express";
import * as auditLogService from "../services/audit-log.service.js";
import { AppError } from "../utils/app-error.js";
import { getAuditLogsQuerySchema } from "../validators/audit-log.validator.js";

export async function list(req: Request, res: Response): Promise<void> {
  const query = getAuditLogsQuerySchema.parse(req.query);
  const result = await auditLogService.getAuditLogs(query);

  res.status(200).json({
    success: true,
    data: result.data,
    meta: result.meta,
  });
}

export async function detail(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  if (isNaN(id) || id <= 0 || !Number.isInteger(id)) {
    throw new AppError(400, "ID audit log tidak valid");
  }

  const log = await auditLogService.getAuditLogById(id);

  res.status(200).json({
    success: true,
    data: log,
  });
}
