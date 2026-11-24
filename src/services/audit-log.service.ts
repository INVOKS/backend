import { eq, desc, and, count } from "drizzle-orm";
import { db } from "../db/index.js";
import { auditLogs } from "../db/schema/audit-logs.js";
import { users } from "../db/schema/users.js";
import { AppError } from "../utils/app-error.js";

/**
 * Helper untuk memastikan nilai kolom JSON dari MariaDB diparsing secara aman
 * baik jika dikembalikan sebagai objek maupun string JSON mentah.
 */
export function safeParseJson(value: unknown): any {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "object") {
    return value;
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

export interface RecordAuditLogParams {
  actorUserId?: number | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeData?: any;
  afterData?: any;
}

/**
 * Helper fail-safe untuk mencatat log aktivitas admin / pengguna.
 * Jika pencatatan log gagal, error ditangkap dan tidak menggagalkan transaksi utama.
 */
export async function recordAuditLog(
  params: RecordAuditLogParams
): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actorUserId: params.actorUserId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: String(params.entityId),
      beforeData: params.beforeData ?? null,
      afterData: params.afterData ?? null,
    });
  } catch (error) {
    // Fail-safe: log kegagalan ke console tanpa menampilkan data sensitif
    console.error("Gagal mencatat audit log:", (error as Error).message ?? error);
  }
}

export interface GetAuditLogsParams {
  page?: number | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
  entityType?: string | undefined;
  action?: string | undefined;
  actorUserId?: number | undefined;
}

export async function getAuditLogs(params: GetAuditLogsParams) {
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
  const offset = params.offset ?? ((params.page ?? 1) - 1) * limit;

  const conditions = [];

  if (params.entityType) {
    conditions.push(eq(auditLogs.entityType, params.entityType));
  }
  if (params.action) {
    conditions.push(eq(auditLogs.action, params.action));
  }
  if (params.actorUserId) {
    conditions.push(eq(auditLogs.actorUserId, params.actorUserId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // 1. Query total record untuk pagination
  const [totalRes] = await db
    .select({ total: count() })
    .from(auditLogs)
    .where(whereClause);

  const total = Number(totalRes?.total ?? 0);

  // 2. Query log dengan aktor (Aturan 11: leftJoin tanpa with:)
  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      beforeData: auditLogs.beforeData,
      afterData: auditLogs.afterData,
      createdAt: auditLogs.createdAt,
      actor: {
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
      },
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorUserId, users.id))
    .where(whereClause)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  const data = rows.map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    beforeData: safeParseJson(row.beforeData),
    afterData: safeParseJson(row.afterData),
    createdAt: row.createdAt,
    actor: row.actor?.id ? row.actor : null,
  }));

  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages,
    },
  };
}

export async function getAuditLogById(id: number) {
  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      beforeData: auditLogs.beforeData,
      afterData: auditLogs.afterData,
      createdAt: auditLogs.createdAt,
      actor: {
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
      },
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorUserId, users.id))
    .where(eq(auditLogs.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new AppError(404, "Audit log tidak ditemukan");
  }

  return {
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    beforeData: safeParseJson(row.beforeData),
    afterData: safeParseJson(row.afterData),
    createdAt: row.createdAt,
    actor: row.actor?.id ? row.actor : null,
  };
}
