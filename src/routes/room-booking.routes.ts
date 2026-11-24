import { Router } from "express";
import * as roomBookingController from "../controllers/room-booking.controller.js";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { idempotency } from "../middlewares/idempotency.middleware.js";
import { createRoomBookingSchema } from "../validators/room-booking.validator.js";

const router = Router();

// Endpoint user login untuk membuat booking ruangan
router.post(
  "/",
  authenticate,
  idempotency("CREATE_ROOM_BOOKING"),
  validateBody(createRoomBookingSchema),
  roomBookingController.create
);

// Endpoint user login untuk melihat booking milik sendiri
router.get("/me", authenticate, roomBookingController.myBookings);

// Endpoint admin untuk melihat semua booking ruangan
router.get("/", authenticate, requireAdmin, roomBookingController.listAll);

// Endpoint detail booking (hanya pemilik atau admin)
router.get("/:id", authenticate, roomBookingController.detail);

export default router;

