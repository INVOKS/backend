import { Router } from "express";
import * as itemController from "../controllers/item.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

// Endpoint user login untuk melihat daftar kategori barang
router.get("/", authenticate, itemController.listCategories);

export default router;

