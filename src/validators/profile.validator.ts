import { z } from "zod";

export const updateProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Nama lengkap tidak boleh kosong")
    .max(255, "Nama lengkap maksimal 255 karakter")
    .optional(),
  firstName: z
    .string()
    .trim()
    .max(100, "Nama depan maksimal 100 karakter")
    .optional(),
  lastName: z
    .string()
    .trim()
    .max(100, "Nama belakang maksimal 100 karakter")
    .optional(),
  phone: z
    .string()
    .trim()
    .max(30, "Nomor telepon maksimal 30 karakter")
    .optional()
    .nullable(),
  gender: z.enum(["male", "female"]).optional().nullable(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal lahir harus YYYY-MM-DD")
    .optional()
    .nullable(),
  department: z
    .string()
    .trim()
    .max(100, "Departemen/program studi maksimal 100 karakter")
    .optional()
    .nullable(),
  userType: z
    .enum(["student", "lecturer", "staff", "general"])
    .optional()
    .nullable(),
  academicId: z
    .string()
    .trim()
    .max(50, "NIM/NIP/NIK maksimal 50 karakter")
    .optional()
    .nullable(),
  buildingId: z.coerce.number().int().positive().optional().nullable(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Kata sandi saat ini wajib diisi"),
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

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
