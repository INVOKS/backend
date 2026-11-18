import {
  mysqlTable,
  int,
  text,
  mysqlEnum,
  datetime,
  timestamp,
  index,
  unique,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { users } from "./users.js";
import { itemUnits } from "./item-units.js";
import { itemBorrowings } from "./item-borrowings.js";
import { itemBorrowingSlots } from "./item-borrowing-slots.js";

export const itemBorrowingUnits = mysqlTable(
  "item_borrowing_units",
  {
    id: int("id").autoincrement().primaryKey(),
    itemBorrowingId: int("item_borrowing_id")
      .notNull()
      .references(() => itemBorrowings.id, { onDelete: "cascade" }),
    itemUnitId: int("item_unit_id")
      .notNull()
      .references(() => itemUnits.id, { onDelete: "restrict" }),
    returnedAt: datetime("returned_at", { mode: "string" }),
    returnedByAdminId: int("returned_by_admin_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    returnCondition: mysqlEnum("return_condition", [
      "good",
      "damaged",
      "maintenance",
    ]),
    returnNotes: text("return_notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("item_borrowing_units_item_borrowing_id_item_unit_id_unique").on(
      table.itemBorrowingId,
      table.itemUnitId
    ),
    index("item_borrowing_units_item_unit_id_returned_at_idx").on(
      table.itemUnitId,
      table.returnedAt
    ),
  ]
);

export const itemBorrowingUnitsRelations = relations(
  itemBorrowingUnits,
  ({ one, many }) => ({
    borrowing: one(itemBorrowings, {
      fields: [itemBorrowingUnits.itemBorrowingId],
      references: [itemBorrowings.id],
    }),
    unit: one(itemUnits, {
      fields: [itemBorrowingUnits.itemUnitId],
      references: [itemUnits.id],
    }),
    returnedByAdmin: one(users, {
      fields: [itemBorrowingUnits.returnedByAdminId],
      references: [users.id],
    }),
    slots: many(itemBorrowingSlots),
  })
);

export type ItemBorrowingUnit = typeof itemBorrowingUnits.$inferSelect;
export type NewItemBorrowingUnit = typeof itemBorrowingUnits.$inferInsert;
