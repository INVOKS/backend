import { Router } from "express";
import * as auditLogController from "../controllers/audit-log.controller.js";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import { validateQuery } from "../middlewares/validate.middleware.js";
import { getAuditLogsQuerySchema } from "../validators/audit-log.validator.js";

const router = Router();

// Seluruh endpoint audit log hanya untuk admin
router.use(authenticate, requireAdmin);

router.get(
  "/",
  validateQuery(getAuditLogsQuerySchema),
  auditLogController.list
);

router.get("/:id", auditLogController.detail);

export default router;
