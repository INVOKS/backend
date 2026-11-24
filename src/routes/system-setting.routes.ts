import { Router } from "express";
import * as systemSettingController from "../controllers/system-setting.controller.js";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { updateSystemSettingSchema } from "../validators/system-setting.validator.js";

const router = Router();

// Semua endpoint system settings memerlukan login
router.use(authenticate);

// Siapa saja yang terautentikasi dapat membaca pengaturan sistem
router.get("/", systemSettingController.list);
router.get("/:key", systemSettingController.detail);

// Hanya admin yang dapat mengubah pengaturan sistem
router.put(
  "/:key",
  requireAdmin,
  validateBody(updateSystemSettingSchema),
  systemSettingController.update
);

export default router;
