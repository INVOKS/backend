import { Router } from "express";
import * as notificationController from "../controllers/notification.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

// Seluruh endpoint notifikasi mewajibkan login pengguna
router.use(authenticate);

// Mengambil daftar notifikasi milik user
router.get("/", notificationController.list);

// Menandai seluruh notifikasi user sebagai sudah dibaca (ditempatkan sebelum /:id/read)
router.patch("/read-all", notificationController.markReadAll);

// Menandai satu notifikasi sebagai sudah dibaca
router.patch("/:id/read", notificationController.markRead);

export default router;
