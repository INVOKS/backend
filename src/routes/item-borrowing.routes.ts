import { Router } from "express";
import * as itemBorrowingController from "../controllers/item-borrowing.controller.js";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { createItemBorrowingSchema } from "../validators/item-borrowing.validator.js";

const router = Router();

// Endpoint user login untuk membuat peminjaman barang
router.post(
  "/",
  authenticate,
  validateBody(createItemBorrowingSchema),
  itemBorrowingController.create
);

// Endpoint user login untuk melihat peminjaman barang milik sendiri
router.get("/me", authenticate, itemBorrowingController.myBorrowings);

// Endpoint admin untuk melihat semua peminjaman barang
router.get("/", authenticate, requireAdmin, itemBorrowingController.listAll);

// Endpoint detail peminjaman barang (hanya pemilik atau admin)
router.get("/:id", authenticate, itemBorrowingController.detail);

export default router;
