import { eq, and, desc, sql, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  notifications,
  type Notification,
} from "../db/schema/notifications.js";
import { reminderLogs } from "../db/schema/reminder-logs.js";
import { itemBorrowings } from "../db/schema/item-borrowings.js";
import { itemBorrowingUnits } from "../db/schema/item-borrowing-units.js";
import { itemBorrowingSlots } from "../db/schema/item-borrowing-slots.js";
import { itemUnits } from "../db/schema/item-units.js";
import { AppError } from "../utils/app-error.js";
import { isDuplicateKeyError } from "../utils/db-error.js";
import {
  getNowJakartaString,
  getTodayJakartaDateString,
  addMinutesJakarta,
  toApiDateTime,
} from "../utils/datetime.js";

export type NotificationType =
  | "room_booking_created"
  | "item_borrowing_created"
  | "item_return_confirmed"
  | "return_due_soon"
  | "return_overdue";

export interface CreateEventNotificationParams {
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  referenceType: "room_booking" | "item_borrowing";
  referenceId: number;
}

export async function createEventNotification(
  params: CreateEventNotificationParams
): Promise<void> {
  try {
    await db.insert(notifications).values({
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      isRead: false,
    });
  } catch (err: unknown) {
    console.error(
      "Gagal mencatat notifikasi kejadian:",
      err instanceof Error ? err.message : err
    );
  }
}

export interface GetUserNotificationsOptions {
  isRead?: boolean | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export async function getUserNotifications(
  userId: number,
  options?: GetUserNotificationsOptions
) {
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;

  // 1. Hitung total unread count khusus milik user ini
  const [unreadRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(eq(notifications.userId, userId), eq(notifications.isRead, false))
    );
  const unreadCount = Number(unreadRes?.count ?? 0);

  // 2. Susun filter untuk list
  const conditions = [eq(notifications.userId, userId)];
  if (options?.isRead !== undefined) {
    conditions.push(eq(notifications.isRead, options.isRead));
  }

  // 3. Hitung total data yang cocok dengan filter
  const [totalRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(...conditions));
  const total = Number(totalRes?.count ?? 0);

  // 4. Ambil data notifikasi dengan paginasi
  const list = await db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit)
    .offset(offset);

  return {
    notifications: list.map((n) => ({
      id: n.id,
      userId: n.userId,
      type: n.type,
      title: n.title,
      message: n.message,
      referenceType: n.referenceType,
      referenceId: n.referenceId,
      isRead: n.isRead,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount,
    pagination: {
      total,
      limit,
      offset,
    },
  };
}

export async function markNotificationAsRead(id: number, userId: number) {
  const [existing] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, id))
    .limit(1);

  if (!existing || existing.userId !== userId) {
    throw new AppError(404, "Notifikasi tidak ditemukan");
  }

  if (existing.isRead) {
    return {
      id: existing.id,
      userId: existing.userId,
      type: existing.type,
      title: existing.title,
      message: existing.message,
      referenceType: existing.referenceType,
      referenceId: existing.referenceId,
      isRead: existing.isRead,
      readAt: existing.readAt ? existing.readAt.toISOString() : null,
      createdAt: existing.createdAt.toISOString(),
    };
  }

  const readAtDate = new Date();
  await db
    .update(notifications)
    .set({
      isRead: true,
      readAt: readAtDate,
    })
    .where(eq(notifications.id, id));

  return {
    id: existing.id,
    userId: existing.userId,
    type: existing.type,
    title: existing.title,
    message: existing.message,
    referenceType: existing.referenceType,
    referenceId: existing.referenceId,
    isRead: true,
    readAt: readAtDate.toISOString(),
    createdAt: existing.createdAt.toISOString(),
  };
}

export async function markAllNotificationsAsRead(userId: number) {
  const readAtDate = new Date();
  await db
    .update(notifications)
    .set({
      isRead: true,
      readAt: readAtDate,
    })
    .where(
      and(eq(notifications.userId, userId), eq(notifications.isRead, false))
    );

  return {
    success: true,
  };
}

export async function runReminderJob(): Promise<void> {
  const reminderDueSoonMinutes =
    Number(process.env.REMINDER_DUE_SOON_MINUTES) || 30;

  const nowJakarta = getNowJakartaString();
  const todayJakarta = getTodayJakartaDateString();
  const dueSoonWindowJakarta = addMinutesJakarta(
    nowJakarta,
    reminderDueSoonMinutes
  );

  // Cari unit barang pada peminjaman berstatus 'booked' yang belum dikembalikan (returnedAt IS NULL)
  const activeUnreturnedUnits = await db
    .select({
      borrowingId: itemBorrowingUnits.itemBorrowingId,
      userId: itemBorrowings.userId,
      borrowingCode: itemBorrowings.borrowingCode,
      itemUnitId: itemBorrowingUnits.itemUnitId,
      inventoryCode: itemUnits.inventoryCode,
      endAt: itemBorrowingSlots.endAt,
    })
    .from(itemBorrowingUnits)
    .innerJoin(
      itemBorrowings,
      eq(itemBorrowingUnits.itemBorrowingId, itemBorrowings.id)
    )
    .innerJoin(itemUnits, eq(itemBorrowingUnits.itemUnitId, itemUnits.id))
    .innerJoin(
      itemBorrowingSlots,
      eq(itemBorrowingSlots.itemBorrowingUnitId, itemBorrowingUnits.id)
    )
    .where(
      and(
        eq(itemBorrowings.status, "booked"),
        isNull(itemBorrowingUnits.returnedAt)
      )
    );

  if (activeUnreturnedUnits.length === 0) {
    return;
  }

  // Kelompokkan per borrowingId untuk mencari batas akhir slot dan daftar unit yang belum kembali
  interface CandidateInfo {
    borrowingId: number;
    userId: number;
    borrowingCode: string;
    maxEndAt: string;
    unreturnedCodes: Set<string>;
  }

  const candidateMap = new Map<number, CandidateInfo>();
  for (const row of activeUnreturnedUnits) {
    const existing = candidateMap.get(row.borrowingId);
    if (!existing) {
      candidateMap.set(row.borrowingId, {
        borrowingId: row.borrowingId,
        userId: row.userId,
        borrowingCode: row.borrowingCode,
        maxEndAt: row.endAt,
        unreturnedCodes: new Set([row.inventoryCode]),
      });
    } else {
      if (row.endAt > existing.maxEndAt) {
        existing.maxEndAt = row.endAt;
      }
      existing.unreturnedCodes.add(row.inventoryCode);
    }
  }

  // Evaluasi tiap kandidat peminjaman
  for (const c of candidateMap.values()) {
    const codesList = Array.from(c.unreturnedCodes).join(", ");
    let dedupKey: string | null = null;
    let type: NotificationType | null = null;
    let title: string = "";
    let message: string = "";

    if (c.maxEndAt > nowJakarta && c.maxEndAt <= dueSoonWindowJakarta) {
      // Kasus A: return_due_soon (30 menit sebelum batas akhir)
      type = "return_due_soon";
      dedupKey = `return_due_soon:item_borrowing:${c.borrowingId}`;
      title = "Pengingat Batas Waktu Pengembalian Barang";
      message = `Peminjaman barang ${c.borrowingCode} (${codesList}) akan berakhir pada ${toApiDateTime(
        c.maxEndAt
      )}. Harap segera bersiap mengembalikan barang ke petugas.`;
    } else if (c.maxEndAt < nowJakarta) {
      // Kasus B: return_overdue (melewati batas waktu, maks 1x per hari)
      type = "return_overdue";
      dedupKey = `return_overdue:item_borrowing:${c.borrowingId}:${todayJakarta}`;
      title = "Peminjaman Barang Melewati Batas Waktu (Overdue)";
      message = `Peminjaman barang ${c.borrowingCode} (${codesList}) telah melewati batas waktu (${toApiDateTime(
        c.maxEndAt
      )}) dan belum dikonfirmasi kembali oleh admin. Harap segera melakukan pengembalian.`;
    }

    if (!dedupKey || !type) {
      continue;
    }

    try {
      await db.transaction(async (tx) => {
        // Periksa apakah reminder sudah pernah dicatat di reminder_logs
        const [existingLog] = await tx
          .select({ id: reminderLogs.id })
          .from(reminderLogs)
          .where(eq(reminderLogs.deduplicationKey, dedupKey!))
          .limit(1);

        if (existingLog) {
          return;
        }

        // Catat notifikasi
        const [insertedNotif] = await tx
          .insert(notifications)
          .values({
            userId: c.userId,
            type: type!,
            title,
            message,
            referenceType: "item_borrowing",
            referenceId: c.borrowingId,
            isRead: false,
          })
          .$returningId();

        if (!insertedNotif?.id) {
          return;
        }

        // Catat log pengiriman agar tidak duplikat
        await tx.insert(reminderLogs).values({
          notificationId: insertedNotif.id,
          channel: "in_app",
          deduplicationKey: dedupKey!,
          status: "sent",
          sentAt: new Date(),
        });
      });
    } catch (err: unknown) {
      if (isDuplicateKeyError(err)) {
        // Terjadi race condition pada unique key dedup, aman dilewati
        continue;
      }
      console.error(
        `[runReminderJob] Gagal memproses reminder untuk peminjaman #${c.borrowingId}:`,
        err instanceof Error ? err.message : err
      );
    }
  }
}
