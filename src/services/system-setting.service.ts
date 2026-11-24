import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { systemSettings } from "../db/schema/system-settings.js";
import { users } from "../db/schema/users.js";
import { AppError } from "../utils/app-error.js";
import { recordAuditLog } from "./audit-log.service.js";

export const DEFAULT_SYSTEM_SETTINGS: Array<{
  settingKey: string;
  settingValue: Record<string, any>;
  description: string;
}> = [
  {
    settingKey: "operational_hours",
    settingValue: {
      startHour: 7,
      endHour: 19,
      slotDurationMinutes: 60,
      timezone: "Asia/Jakarta",
    },
    description: "Jam operasional peminjaman ruangan dan barang (07:00–19:00 WIB)",
  },
  {
    settingKey: "booking_limits",
    settingValue: {
      maxSlotsPerBooking: 50,
      maxAdvanceMonths: 12,
      maxUnitsPerItemBorrowing: 20,
    },
    description: "Batas pemesanan slot dan jumlah unit barang per peminjaman",
  },
  {
    settingKey: "reminder_policy",
    settingValue: {
      dueSoonMinutes: 30,
      jobIntervalMinutes: 15,
    },
    description: "Kebijakan pengingat otomatis peminjaman barang",
  },
];

/**
 * Memastikan nilai awal pengaturan sistem telah terisi di database (idempoten).
 * Dipanggil saat server dinyalakan atau seed.
 */
export async function ensureDefaultSystemSettings(): Promise<void> {
  for (const item of DEFAULT_SYSTEM_SETTINGS) {
    const existing = await db
      .select({ settingKey: systemSettings.settingKey })
      .from(systemSettings)
      .where(eq(systemSettings.settingKey, item.settingKey))
      .limit(1);

    if (!existing[0]) {
      await db.insert(systemSettings).values({
        settingKey: item.settingKey,
        settingValue: item.settingValue,
        description: item.description,
      });
    }
  }
}

export async function getAllSystemSettings() {
  const rows = await db
    .select({
      settingKey: systemSettings.settingKey,
      settingValue: systemSettings.settingValue,
      description: systemSettings.description,
      updatedAt: systemSettings.updatedAt,
      updater: {
        id: users.id,
        fullName: users.fullName,
        email: users.email,
      },
    })
    .from(systemSettings)
    .leftJoin(users, eq(systemSettings.updatedBy, users.id));

  return rows.map((r) => ({
    settingKey: r.settingKey,
    settingValue: r.settingValue,
    description: r.description,
    updatedAt: r.updatedAt,
    updater: r.updater?.id ? r.updater : null,
  }));
}

export async function getSystemSettingByKey(key: string) {
  const rows = await db
    .select({
      settingKey: systemSettings.settingKey,
      settingValue: systemSettings.settingValue,
      description: systemSettings.description,
      updatedAt: systemSettings.updatedAt,
      updater: {
        id: users.id,
        fullName: users.fullName,
        email: users.email,
      },
    })
    .from(systemSettings)
    .leftJoin(users, eq(systemSettings.updatedBy, users.id))
    .where(eq(systemSettings.settingKey, key))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new AppError(404, `Pengaturan sistem '${key}' tidak ditemukan`);
  }

  return {
    settingKey: row.settingKey,
    settingValue: row.settingValue,
    description: row.description,
    updatedAt: row.updatedAt,
    updater: row.updater?.id ? row.updater : null,
  };
}

export interface UpdateSystemSettingInput {
  settingValue: Record<string, any>;
  description?: string | undefined;
}

export async function updateSystemSetting(
  key: string,
  updaterUserId: number,
  input: UpdateSystemSettingInput
) {
  const existing = await getSystemSettingByKey(key);

  const updateData: Partial<typeof systemSettings.$inferInsert> = {
    settingValue: input.settingValue,
    updatedBy: updaterUserId,
    updatedAt: new Date(),
  };

  if (input.description !== undefined) {
    updateData.description = input.description;
  }

  await db
    .update(systemSettings)
    .set(updateData)
    .where(eq(systemSettings.settingKey, key));

  // Catat audit log perubahan pengaturan sistem
  await recordAuditLog({
    actorUserId: updaterUserId,
    action: "UPDATE_SETTING",
    entityType: "system_setting",
    entityId: key,
    beforeData: {
      settingValue: existing.settingValue,
      description: existing.description,
    },
    afterData: {
      settingValue: input.settingValue,
      description: input.description ?? existing.description,
    },
  });

  return getSystemSettingByKey(key);
}
