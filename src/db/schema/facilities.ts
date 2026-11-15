import { mysqlTable, int, varchar, text, timestamp } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { roomFacilities } from "./room-facilities.js";

export const facilities = mysqlTable("facilities", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  icon: varchar("icon", { length: 50 }),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const facilitiesRelations = relations(facilities, ({ many }) => ({
  roomFacilities: many(roomFacilities),
}));

export type Facility = typeof facilities.$inferSelect;
export type NewFacility = typeof facilities.$inferInsert;
