import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { eq, and, desc, gt, isNull, isNotNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { users, type User } from "../db/schema/users.js";
import { passwordResetTokens } from "../db/schema/password-reset-tokens.js";
import { AppError } from "../utils/app-error.js";
import { signToken } from "../utils/jwt.js";
import { sendPasswordResetOtpEmail } from "../utils/mailer.js";
import type {
  RegisterInput,
  LoginInput,
  ForgotPasswordInput,
  VerifyResetOtpInput,
  ResetPasswordInput,
} from "../validators/auth.validator.js";

export type SafeUser = Omit<User, "passwordHash">;

export async function registerUser(input: RegisterInput): Promise<SafeUser> {
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, input.email),
  });

  if (existingUser) {
    throw new AppError(409, "Email sudah terdaftar");
  }

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(input.password, saltRounds);

  const [inserted] = await db
    .insert(users)
    .values({
      fullName: input.fullName,
      email: input.email,
      passwordHash,
      role: "user",
    })
    .$returningId();

  if (!inserted?.id) {
    throw new AppError(500, "Gagal mendaftarkan pengguna");
  }

  const newUser = await db.query.users.findFirst({
    where: eq(users.id, inserted.id),
    columns: {
      passwordHash: false,
    },
  });

  if (!newUser) {
    throw new AppError(500, "Pengguna berhasil dibuat namun gagal memuat data");
  }

  return newUser;
}

export async function loginUser(
  input: LoginInput,
  expectedRole: "user" | "admin" = "user"
): Promise<{ token: string; user: SafeUser }> {
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, input.email),
  });

  if (!existingUser) {
    throw new AppError(401, "Email atau password salah");
  }

  if (existingUser.role !== expectedRole) {
    throw new AppError(401, "Email atau password salah");
  }

  const isPasswordValid = await bcrypt.compare(
    input.password,
    existingUser.passwordHash
  );

  if (!isPasswordValid) {
    throw new AppError(401, "Email atau password salah");
  }

  if (!existingUser.isActive) {
    throw new AppError(403, "Akun Anda dinonaktifkan. Silakan hubungi administrator");
  }

  const token = signToken(
    existingUser.id,
    existingUser.role,
    input.rememberMe
  );

  const { passwordHash: _, ...safeUser } = existingUser;

  return {
    token,
    user: safeUser,
  };
}

export async function getUserById(id: number): Promise<SafeUser> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
    columns: {
      passwordHash: false,
    },
  });

  if (!user) {
    throw new AppError(404, "Pengguna tidak ditemukan");
  }

  return user;
}

export async function forgotPassword(
  input: ForgotPasswordInput
): Promise<{ success: boolean; message: string }> {
  const genericMessage =
    "Jika email terdaftar, kode OTP 6 digit telah dikirim ke email Anda";

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  const user = rows[0];

  // Anti-enumeration: kembalikan pesan sukses jika user tidak ditemukan atau non-aktif
  if (!user || !user.isActive) {
    return { success: true, message: genericMessage };
  }

  // Rate limiting / cooldown: cek token terakhir
  const tokenRows = await db
    .select({
      id: passwordResetTokens.id,
      createdAt: passwordResetTokens.createdAt,
    })
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, user.id))
    .orderBy(desc(passwordResetTokens.createdAt))
    .limit(1);

  const latestToken = tokenRows[0];
  if (latestToken) {
    const elapsedSeconds =
      (Date.now() - new Date(latestToken.createdAt).getTime()) / 1000;
    if (elapsedSeconds < 30) {
      throw new AppError(
        429,
        "Silakan tunggu sebelum meminta kode OTP baru"
      );
    }
  }

  // Invalidasi token lama yang belum digunakan
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(passwordResetTokens.userId, user.id),
        isNull(passwordResetTokens.usedAt)
      )
    );

  // Generate 6-digit OTP
  const otp = crypto.randomInt(100000, 1000000).toString();
  const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 menit

  await db.insert(passwordResetTokens).values({
    userId: user.id,
    otpHash,
    expiresAt,
  });

  // Kirim email OTP
  await sendPasswordResetOtpEmail({
    to: user.email,
    fullName: user.fullName,
    otp,
  });

  return { success: true, message: genericMessage };
}

export async function verifyResetOtp(
  input: VerifyResetOtpInput
): Promise<{ resetToken: string }> {
  const rows = await db
    .select({
      id: users.id,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  const user = rows[0];
  if (!user || !user.isActive) {
    throw new AppError(400, "Email atau kode OTP tidak valid");
  }

  const otpHash = crypto.createHash("sha256").update(input.otp).digest("hex");

  const tokenRows = await db
    .select({
      id: passwordResetTokens.id,
      expiresAt: passwordResetTokens.expiresAt,
    })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.userId, user.id),
        eq(passwordResetTokens.otpHash, otpHash),
        isNull(passwordResetTokens.usedAt),
        isNull(passwordResetTokens.verifiedAt),
        gt(passwordResetTokens.expiresAt, new Date())
      )
    )
    .orderBy(desc(passwordResetTokens.createdAt))
    .limit(1);

  const token = tokenRows[0];
  if (!token) {
    throw new AppError(400, "Kode OTP tidak valid atau sudah kedaluwarsa");
  }

  // Generate 32-byte hex resetToken
  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetTokenHash = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  await db
    .update(passwordResetTokens)
    .set({
      resetTokenHash,
      verifiedAt: new Date(),
    })
    .where(eq(passwordResetTokens.id, token.id));

  return { resetToken };
}

export async function resetPassword(
  input: ResetPasswordInput
): Promise<{ success: boolean; message: string }> {
  const resetTokenHash = crypto
    .createHash("sha256")
    .update(input.resetToken)
    .digest("hex");

  const tokenRows = await db
    .select({
      id: passwordResetTokens.id,
      userId: passwordResetTokens.userId,
    })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.resetTokenHash, resetTokenHash),
        isNotNull(passwordResetTokens.verifiedAt),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date())
      )
    )
    .limit(1);

  const token = tokenRows[0];
  if (!token) {
    throw new AppError(
      400,
      "Token reset kata sandi tidak valid atau sudah kedaluwarsa"
    );
  }

  const newPasswordHash = await bcrypt.hash(input.newPassword, 10);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        passwordHash: newPasswordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, token.userId));

    await tx
      .update(passwordResetTokens)
      .set({
        usedAt: new Date(),
      })
      .where(eq(passwordResetTokens.id, token.id));
  });

  return {
    success: true,
    message: "Kata sandi berhasil direset, silakan masuk dengan kata sandi baru",
  };
}
