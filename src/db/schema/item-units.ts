import {
  mysqlTable,
  int,
  varchar,
  mysqlEnum,
  boolean,
  text,
  timestamp,
  index,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { items } from "./items.js";

export const itemUnits = mysqlTable(
  "item_units",
  {
    id: int("id").autoincrement().primaryKey(),
    itemId: int("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "restrict" }),
    inventoryCode: varchar("inventory_code", { length: 50 }).notNull().unique(),
    condition: mysqlEnum("condition", ["good", "damaged", "maintenance"])
      .default("good")
      .notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("item_units_item_id_idx").on(table.itemId),
  ]
);

export const itemUnitsRelations = relations(itemUnits, ({ one }) => ({
  item: one(items, {
    fields: [itemUnits.itemId],
    references: [items.id],
  }),
}));

export type ItemUnit = typeof itemUnits.$inferSelect;
export type NewItemUnit = typeof itemUnits.$inferInsert;

