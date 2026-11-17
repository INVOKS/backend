import { Router } from "express";
import * as itemController from "../controllers/item.controller.js";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import { uploadItemImage } from "../middlewares/upload.middleware.js";

const router = Router();

// Endpoint untuk user & admin (harus login)
router.get("/", authenticate, itemController.list);
router.get("/:id", authenticate, itemController.detail);

// Endpoint khusus admin
router.post(
  "/",
  authenticate,
  requireAdmin,
  uploadItemImage.single("image"),
  itemController.create
);

router.put(
  "/:id",
  authenticate,
  requireAdmin,
  uploadItemImage.single("image"),
  itemController.update
);

router.patch("/:id/archive", authenticate, requireAdmin, itemController.archive);
router.patch("/:id/unarchive", authenticate, requireAdmin, itemController.unarchive);

router.post("/:id/units", authenticate, requireAdmin, itemController.addUnits);

export default router;

