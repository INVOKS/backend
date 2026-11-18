import {
  mysqlTable,
  int,
  datetime,
  timestamp,
  index,
  unique,
  foreignKey,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { itemBorrowings } from "./item-borrowings.js";
import { itemBorrowingUnits } from "./item-borrowing-units.js";
import { itemUnits } from "./item-units.js";

export const itemBorrowingSlots = mysqlTable(
  "item_borrowing_slots",
  {
    id: int("id").autoincrement().primaryKey(),
    itemBorrowingId: int("item_borrowing_id")
      .notNull()
      .references(() => itemBorrowings.id, { onDelete: "cascade" }),
    itemBorrowingUnitId: int("item_borrowing_unit_id").notNull(),
    itemUnitId: int("item_unit_id")
      .notNull()
      .references(() => itemUnits.id, { onDelete: "restrict" }),
    startAt: datetime("start_at", { mode: "string" }).notNull(),
    endAt: datetime("end_at", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("item_borrowing_slots_unit_start_unique").on(
      table.itemUnitId,
      table.startAt
    ),
    index("item_borrowing_slots_borrowing_start_idx").on(
      table.itemBorrowingId,
      table.startAt
    ),
    index("item_borrowing_slots_borrowing_unit_start_idx").on(
      table.itemBorrowingUnitId,
      table.startAt
    ),
    foreignKey({
      name: "item_borrowing_slots_borrowing_unit_id_fk",
      columns: [table.itemBorrowingUnitId],
      foreignColumns: [itemBorrowingUnits.id],
    }).onDelete("cascade"),
  ]
);

export const itemBorrowingSlotsRelations = relations(
  itemBorrowingSlots,
  ({ one }) => ({
    borrowing: one(itemBorrowings, {
      fields: [itemBorrowingSlots.itemBorrowingId],
      references: [itemBorrowings.id],
    }),
    borrowingUnit: one(itemBorrowingUnits, {
      fields: [itemBorrowingSlots.itemBorrowingUnitId],
      references: [itemBorrowingUnits.id],
    }),
    unit: one(itemUnits, {
      fields: [itemBorrowingSlots.itemUnitId],
      references: [itemUnits.id],
    }),
  })
);

export type ItemBorrowingSlot = typeof itemBorrowingSlots.$inferSelect;
export type NewItemBorrowingSlot = typeof itemBorrowingSlots.$inferInsert;
