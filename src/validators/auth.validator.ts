import { z } from "zod";

export const registerSchema = z
  .object({
    namaLengkap: z
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
    konfirmasiPassword: z.string().min(1, "Konfirmasi password wajib diisi"),
  })
  .refine((data) => data.password === data.konfirmasiPassword, {
    message: "Konfirmasi password tidak cocok dengan password",
    path: ["konfirmasiPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Format email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
  ingatSaya: z.boolean().default(false),
});

export type LoginInput = z.infer<typeof loginSchema>;
