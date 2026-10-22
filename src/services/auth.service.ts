import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users, type User } from "../db/schema/users.js";
import { AppError } from "../utils/app-error.js";
import { signToken } from "../utils/jwt.js";
import type { RegisterInput, LoginInput } from "../validators/auth.validator.js";

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
      namaLengkap: input.namaLengkap,
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

  const token = signToken(
    existingUser.id,
    existingUser.role,
    input.ingatSaya
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
