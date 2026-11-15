import { Router } from "express";
import * as buildingController from "../controllers/building.controller.js";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import {
  createBuildingSchema,
  updateBuildingSchema,
} from "../validators/building.validator.js";

const router = Router();

// Endpoint untuk user & admin (harus login)
router.get("/", authenticate, buildingController.list);
router.get("/:id", authenticate, buildingController.detail);

// Endpoint khusus admin
router.post(
  "/",
  authenticate,
  requireAdmin,
  validateBody(createBuildingSchema),
  buildingController.create
);

router.put(
  "/:id",
  authenticate,
  requireAdmin,
  validateBody(updateBuildingSchema),
  buildingController.update
);

router.patch(
  "/:id/archive",
  authenticate,
  requireAdmin,
  buildingController.archive
);

router.patch(
  "/:id/unarchive",
  authenticate,
  requireAdmin,
  buildingController.unarchive
);

export default router;

