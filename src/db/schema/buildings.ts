import { mysqlTable, int, varchar, text, timestamp, boolean } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { rooms } from "./rooms.js";

export const buildings = mysqlTable("buildings", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(), // "BNI", "Dieng", "KP"
  code: varchar("code", { length: 20 }),                      // "BNI", "DNG", "KP"
  description: text("description"),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const buildingsRelations = relations(buildings, ({ many }) => ({
  rooms: many(rooms),
}));

export type Building = typeof buildings.$inferSelect;
export type NewBuilding = typeof buildings.$inferInsert;
