import { Router } from "express";
import * as itemController from "../controllers/item.controller.js";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";

const router = Router();

// Endpoint untuk mengecek ketersediaan unit barang (harus login)
router.get("/:id/availability", authenticate, itemController.getUnitAvailability);

// Endpoint khusus admin untuk mengubah status/kondisi/catatan unit
router.put("/:id", authenticate, requireAdmin, itemController.updateUnit);

export default router;

