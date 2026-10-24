import { mysqlTable, int, varchar, text, timestamp } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { rooms } from "./rooms.js";

export const buildings = mysqlTable("buildings", {
  id: int("id").autoincrement().primaryKey(),
  nama: varchar("nama", { length: 100 }).notNull().unique(), // "BNI", "Dieng", "KP"
  kode: varchar("kode", { length: 20 }),                      // "BNI", "DNG", "KP"
  deskripsi: text("deskripsi"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const buildingsRelations = relations(buildings, ({ many }) => ({
  rooms: many(rooms),
}));

export type Building = typeof buildings.$inferSelect;
export type NewBuilding = typeof buildings.$inferInsert;
