import {
  mysqlTable,
  int,
  varchar,
  text,
  json,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { itemCategories } from "./item-categories.js";
import { itemUnits } from "./item-units.js";

export const items = mysqlTable(
  "items",
  {
    id: int("id").autoincrement().primaryKey(),
    categoryId: int("category_id")
      .notNull()
      .references(() => itemCategories.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    specifications: json("specifications").$type<Record<string, unknown>>(),
    imageUrl: text("image_url").notNull(),
    imagePublicId: varchar("image_public_id", { length: 255 }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("items_category_id_is_active_idx").on(table.categoryId, table.isActive),
  ]
);

export const itemsRelations = relations(items, ({ one, many }) => ({
  category: one(itemCategories, {
    fields: [items.categoryId],
    references: [itemCategories.id],
  }),
  units: many(itemUnits),
}));

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;

