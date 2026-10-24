import {
  mysqlTable,
  int,
  varchar,
  text,
  mysqlEnum,
  timestamp,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { buildings } from "./buildings.js";
import { roomFacilities } from "./room-facilities.js";

export const rooms = mysqlTable("rooms", {
  id: int("id").autoincrement().primaryKey(),
  gedungId: int("gedung_id")
    .notNull()
    .references(() => buildings.id, { onDelete: "cascade" }),
  nama: varchar("nama", { length: 100 }).notNull(), // "Ruang 304", "Lab Komputer 402"
  lantai: varchar("lantai", { length: 50 }).notNull(), // "Basement", "1", "2", "3", "4", "5"
  kapasitasMin: int("kapasitas_min").default(1).notNull(), // misal 40
  kapasitasMax: int("kapasitas_max").notNull(),            // misal 80
  deskripsi: text("deskripsi"),
  foto: text("foto"),
  status: mysqlEnum("status", ["tersedia", "dipinjam", "perbaikan"])
    .default("tersedia")
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const roomsRelations = relations(rooms, ({ one, many }) => ({
  building: one(buildings, {
    fields: [rooms.gedungId],
    references: [buildings.id],
  }),
  roomFacilities: many(roomFacilities),
}));

export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;
