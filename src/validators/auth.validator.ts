import { z } from "zod";

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .min(3, "Nama lengkap minimal 3 karakter")
      .max(100, "Nama lengkap maksimal 100 karakter"),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Format email tidak valid"),
    password: z
      .string()
      .min(8, "Password minimal 8 karakter")
      .regex(/[A-Z]/, "Password harus memiliki setidaknya satu huruf kapital")
      .regex(/[a-z]/, "Password harus memiliki setidaknya satu huruf kecil")
      .regex(/[0-9]/, "Password harus memiliki setidaknya satu angka")
      .regex(
        /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
        "Password harus memiliki setidaknya satu karakter khusus"
      ),
    confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Konfirmasi password tidak cocok dengan password",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Format email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
  rememberMe: z.boolean().default(false),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Format email tidak valid"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const verifyResetOtpSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Format email tidak valid"),
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Kode OTP harus berupa 6 digit angka"),
});

export type VerifyResetOtpInput = z.infer<typeof verifyResetOtpSchema>;

export const resetPasswordSchema = z
  .object({
    resetToken: z.string().min(32, "Token reset kata sandi tidak valid"),
    newPassword: z
      .string()
      .min(8, "Kata sandi baru minimal 8 karakter")
      .regex(/[A-Z]/, "Kata sandi baru harus memiliki setidaknya satu huruf kapital")
      .regex(/[a-z]/, "Kata sandi baru harus memiliki setidaknya satu huruf kecil")
      .regex(/[0-9]/, "Kata sandi baru harus memiliki setidaknya satu angka")
      .regex(
        /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
        "Kata sandi baru harus memiliki setidaknya satu karakter khusus"
      ),
    confirmPassword: z.string().min(1, "Konfirmasi kata sandi baru wajib diisi"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Konfirmasi kata sandi tidak cocok dengan kata sandi baru",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
