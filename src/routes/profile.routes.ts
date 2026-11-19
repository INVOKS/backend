import { Router } from "express";
import * as profileController from "../controllers/profile.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { uploadAvatarImage } from "../middlewares/upload.middleware.js";
import {
  updateProfileSchema,
  changePasswordSchema,
} from "../validators/profile.validator.js";

const router = Router();

// Semua endpoint profil memerlukan autentikasi
router.use(authenticate);

router.get("/", profileController.getProfile);
router.patch(
  "/",
  validateBody(updateProfileSchema),
  profileController.updateProfile
);
router.patch(
  "/avatar",
  (req, res, next) => {
    uploadAvatarImage.single("avatar")(req, res, (err) => {
      if (err) return next(err);
      if (!req.file) {
        // Fallback jika frontend mengirim field "image"
        uploadAvatarImage.single("image")(req, res, (err2) => {
          if (err2) return next(err2);
          next();
        });
        return;
      }
      next();
    });
  },
  profileController.updateAvatar
);
router.patch(
  "/password",
  validateBody(changePasswordSchema),
  profileController.changePassword
);

export default router;
