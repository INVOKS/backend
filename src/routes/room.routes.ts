import { Router } from "express";
import * as roomController from "../controllers/room.controller.js";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { uploadRoomImage } from "../middlewares/upload.middleware.js";
import { setRoomFacilitiesSchema } from "../validators/room.validator.js";

const router = Router();

// Endpoint untuk user & admin (harus login)
router.get("/", authenticate, roomController.list);
router.get("/:id", authenticate, roomController.detail);

// Endpoint khusus admin
router.post(
  "/",
  authenticate,
  requireAdmin,
  uploadRoomImage.single("image"),
  roomController.create
);

router.put(
  "/:id",
  authenticate,
  requireAdmin,
  uploadRoomImage.single("image"),
  roomController.update
);

router.patch("/:id/archive", authenticate, requireAdmin, roomController.archive);
router.patch(
  "/:id/unarchive",
  authenticate,
  requireAdmin,
  roomController.unarchive
);

router.put(
  "/:id/facilities",
  authenticate,
  requireAdmin,
  validateBody(setRoomFacilitiesSchema),
  roomController.setFacilities
);

export default router;

