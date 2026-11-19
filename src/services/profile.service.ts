import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users, type User } from "../db/schema/users.js";
import { buildings } from "../db/schema/buildings.js";
import { AppError } from "../utils/app-error.js";
import { uploadImage } from "./storage.service.js";
import type {
  UpdateProfileInput,
  ChangePasswordInput,
} from "../validators/profile.validator.js";

export interface UserProfileResponse {
  id: number;
  role: "user" | "admin";
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  gender: "male" | "female" | null;
  dateOfBirth: string | null;
  department: string | null;
  userType: string | null;
  academicId: string | null;
  phone: string | null;
  profileImageUrl: string | null;
  buildingId: number | null;
  building: {
    id: number;
    name: string;
  } | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function formatUserProfile(
  user: User,
  building: { id: number; name: string } | null
): UserProfileResponse {
  const parts = (user.fullName || "").trim().split(/\s+/);
  const firstName = parts[0] || "";
  const lastName = parts.slice(1).join(" ") || "";

  return {
    id: user.id,
    role: user.role,
    fullName: user.fullName,
    firstName,
    lastName,
    email: user.email,
    gender: (user.gender as "male" | "female" | null) ?? null,
    dateOfBirth: user.dateOfBirth ?? null,
    department: user.department ?? null,
    userType: user.userType ?? null,
    academicId: user.academicId ?? null,
    phone: user.phone ?? null,
    profileImageUrl: user.profileImageUrl ?? null,
    buildingId: user.buildingId ?? null,
    building: building && building.id ? { id: building.id, name: building.name } : null,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function getProfile(userId: number): Promise<UserProfileResponse> {
  const rows = await db
    .select({
      user: users,
      building: {
        id: buildings.id,
        name: buildings.name,
      },
    })
    .from(users)
    .leftJoin(buildings, eq(users.buildingId, buildings.id))
    .where(eq(users.id, userId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new AppError(404, "Pengguna tidak ditemukan");
  }

  return formatUserProfile(
    row.user,
    row.building?.id ? { id: row.building.id, name: row.building.name } : null
  );
}

export async function updateProfile(
  userId: number,
  input: UpdateProfileInput
): Promise<UserProfileResponse> {
  // 1. Verifikasi user ada
  const existingRows = await db
    .select({ user: users })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!existingRows[0]) {
    throw new AppError(404, "Pengguna tidak ditemukan");
  }

  // 2. Validasi buildingId jika disediakan
  if (input.buildingId !== undefined && input.buildingId !== null) {
    const buildingRows = await db
      .select({ id: buildings.id })
      .from(buildings)
      .where(eq(buildings.id, input.buildingId))
      .limit(1);

    if (!buildingRows[0]) {
      throw new AppError(400, "Gedung tidak ditemukan");
    }
  }

  // 3. Tentukan fullName
  let determinedFullName = input.fullName;
  if (!determinedFullName) {
    if (input.firstName !== undefined || input.lastName !== undefined) {
      const combined = [input.firstName, input.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (combined.length > 0) {
        determinedFullName = combined;
      }
    }
  }

  // 4. Bangun data update
  const updateData: Partial<typeof users.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (determinedFullName !== undefined) {
    updateData.fullName = determinedFullName;
  }
  if (input.phone !== undefined) {
    updateData.phone = input.phone;
  }
  if (input.gender !== undefined) {
    updateData.gender = input.gender;
  }
  if (input.dateOfBirth !== undefined) {
    updateData.dateOfBirth = input.dateOfBirth;
  }
  if (input.department !== undefined) {
    updateData.department = input.department;
  }
  if (input.userType !== undefined) {
    updateData.userType = input.userType;
  }
  if (input.academicId !== undefined) {
    updateData.academicId = input.academicId;
  }
  if (input.buildingId !== undefined) {
    updateData.buildingId = input.buildingId;
  }

  await db.update(users).set(updateData).where(eq(users.id, userId));

  return getProfile(userId);
}

export async function updateAvatar(
  userId: number,
  file?: Express.Multer.File
): Promise<UserProfileResponse> {
  if (!file) {
    throw new AppError(400, "File gambar profil wajib diunggah");
  }

  // Upload ke Cloudinary folder 'invoks/avatars'
  const uploadResult = await uploadImage(
    file.buffer,
    file.mimetype,
    "invoks/avatars"
  );

  await db
    .update(users)
    .set({
      profileImageUrl: uploadResult.url,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  return getProfile(userId);
}

export async function changePassword(
  userId: number,
  input: ChangePasswordInput
): Promise<void> {
  const rows = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = rows[0];
  if (!user) {
    throw new AppError(404, "Pengguna tidak ditemukan");
  }

  const isPasswordValid = await bcrypt.compare(
    input.currentPassword,
    user.passwordHash
  );

  if (!isPasswordValid) {
    throw new AppError(400, "Kata sandi saat ini tidak sesuai");
  }

  const newPasswordHash = await bcrypt.hash(input.newPassword, 10);

  await db
    .update(users)
    .set({
      passwordHash: newPasswordHash,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}
