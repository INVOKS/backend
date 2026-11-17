import { mysqlTable, int, varchar, timestamp } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { items } from "./items.js";

export const itemCategories = mysqlTable("item_categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const itemCategoriesRelations = relations(itemCategories, ({ many }) => ({
  items: many(items),
}));

export type ItemCategory = typeof itemCategories.$inferSelect;
export type NewItemCategory = typeof itemCategories.$inferInsert;

