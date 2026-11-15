import { Router } from "express";
import * as facilityController from "../controllers/facility.controller.js";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import {
  createFacilitySchema,
  updateFacilitySchema,
} from "../validators/facility.validator.js";

const router = Router();

// Endpoint untuk user & admin (harus login)
router.get("/", authenticate, facilityController.list);
router.get("/:id", authenticate, facilityController.detail);

// Endpoint khusus admin
router.post(
  "/",
  authenticate,
  requireAdmin,
  validateBody(createFacilitySchema),
  facilityController.create
);

router.put(
  "/:id",
  authenticate,
  requireAdmin,
  validateBody(updateFacilitySchema),
  facilityController.update
);

router.delete("/:id", authenticate, requireAdmin, facilityController.remove);

export default router;

