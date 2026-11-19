import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  verifyResetOtpSchema,
  resetPasswordSchema,
} from "../validators/auth.validator.js";

const router = Router();

router.post("/register", validateBody(registerSchema), authController.register);
router.post("/login", validateBody(loginSchema), authController.login);
router.post("/admin/login", validateBody(loginSchema), authController.loginAdmin);
router.get("/me", authenticate, authController.me);

router.post(
  "/forgot-password",
  validateBody(forgotPasswordSchema),
  authController.forgotPassword
);
router.post(
  "/verify-reset-otp",
  validateBody(verifyResetOtpSchema),
  authController.verifyResetOtp
);
router.post(
  "/reset-password",
  validateBody(resetPasswordSchema),
  authController.resetPassword
);

export default router;
