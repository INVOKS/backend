import {
  mysqlTable,
  int,
  varchar,
  mysqlEnum,
  datetime,
  timestamp,
  index,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { users } from "./users.js";
import { itemBorrowingUnits } from "./item-borrowing-units.js";
import { itemBorrowingSlots } from "./item-borrowing-slots.js";

export const itemBorrowings = mysqlTable(
  "item_borrowings",
  {
    id: int("id").autoincrement().primaryKey(),
    borrowingCode: varchar("borrowing_code", { length: 30 }).notNull().unique(),
    userId: int("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    activityName: varchar("activity_name", { length: 255 }).notNull(),
    picName: varchar("pic_name", { length: 100 }).notNull(),
    picPhone: varchar("pic_phone", { length: 30 }).notNull(),
    status: mysqlEnum("status", ["booked", "completed", "cancelled"])
      .default("booked")
      .notNull(),
    completedAt: datetime("completed_at", { mode: "string" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("item_borrowings_user_id_idx").on(table.userId),
    index("item_borrowings_status_idx").on(table.status),
  ]
);

export const itemBorrowingsRelations = relations(itemBorrowings, ({ one, many }) => ({
  user: one(users, {
    fields: [itemBorrowings.userId],
    references: [users.id],
  }),
  units: many(itemBorrowingUnits),
  slots: many(itemBorrowingSlots),
}));

export type ItemBorrowing = typeof itemBorrowings.$inferSelect;
export type NewItemBorrowing = typeof itemBorrowings.$inferInsert;
