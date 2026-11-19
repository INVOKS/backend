import {
  mysqlTable,
  int,
  varchar,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { users } from "./users.js";
import { reminderLogs } from "./reminder-logs.js";

export const notifications = mysqlTable(
  "notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 50 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    referenceType: varchar("reference_type", { length: 50 }).notNull(),
    referenceId: int("reference_id").notNull(),
    isRead: boolean("is_read").default(false).notNull(),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("notifications_user_id_is_read_created_at_idx").on(
      table.userId,
      table.isRead,
      table.createdAt
    ),
    index("notifications_reference_type_reference_id_idx").on(
      table.referenceType,
      table.referenceId
    ),
  ]
);

export const notificationsRelations = relations(notifications, ({ one, many }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  reminderLogs: many(reminderLogs),
}));

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
