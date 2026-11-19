import {
  mysqlTable,
  int,
  varchar,
  text,
  timestamp,
  index,
  unique,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { notifications } from "./notifications.js";

export const reminderLogs = mysqlTable(
  "reminder_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    notificationId: int("notification_id")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),
    channel: varchar("channel", { length: 30 }).default("in_app").notNull(),
    deduplicationKey: varchar("deduplication_key", { length: 150 }).notNull(),
    status: varchar("status", { length: 30 }).default("sent").notNull(),
    attemptCount: int("attempt_count").default(1).notNull(),
    sentAt: timestamp("sent_at"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("reminder_logs_dedup_key_unique").on(table.deduplicationKey),
    index("reminder_logs_notification_id_idx").on(table.notificationId),
  ]
);

export const reminderLogsRelations = relations(reminderLogs, ({ one }) => ({
  notification: one(notifications, {
    fields: [reminderLogs.notificationId],
    references: [notifications.id],
  }),
}));

export type ReminderLog = typeof reminderLogs.$inferSelect;
export type NewReminderLog = typeof reminderLogs.$inferInsert;
