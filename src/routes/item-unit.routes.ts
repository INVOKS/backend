import { Router } from "express";
import * as itemController from "../controllers/item.controller.js";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";

const router = Router();

// Endpoint khusus admin untuk mengubah status/kondisi/catatan unit
router.put("/:id", authenticate, requireAdmin, itemController.updateUnit);

export default router;

