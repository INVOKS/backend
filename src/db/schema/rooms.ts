import {
  mysqlTable,
  int,
  varchar,
  text,
  mysqlEnum,
  timestamp,
  boolean,
  unique,
  index,
  check,
} from "drizzle-orm/mysql-core";
import { relations, sql } from "drizzle-orm";
import { buildings } from "./buildings.js";
import { roomFacilities } from "./room-facilities.js";

export const rooms = mysqlTable(
  "rooms",
  {
    id: int("id").autoincrement().primaryKey(),
    buildingId: int("building_id")
      .notNull()
      .references(() => buildings.id, { onDelete: "restrict" }),
    roomCode: varchar("room_code", { length: 50 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(), // "Ruang 304", "Lab Komputer 402"
    floor: varchar("floor", { length: 50 }).notNull(), // "Basement", "1", "2", "3", "4", "5"
    capacityMin: int("capacity_min").default(1).notNull(), // misal 40
    capacityMax: int("capacity_max").notNull(),            // misal 80
    description: text("description"),
    imageUrl: text("image_url"),
    imagePublicId: varchar("image_public_id", { length: 255 }),
    status: mysqlEnum("status", ["available", "borrowed", "maintenance"])
      .default("available")
      .notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    unique("rooms_building_id_room_code_unique").on(
      table.buildingId,
      table.roomCode
    ),
    index("rooms_building_id_floor_idx").on(table.buildingId, table.floor),
    check("rooms_capacity_min_positive", sql`${table.capacityMin} > 0`),
    check(
      "rooms_capacity_max_gte_min",
      sql`${table.capacityMax} >= ${table.capacityMin}`
    ),
  ]
);

export const roomsRelations = relations(rooms, ({ one, many }) => ({
  building: one(buildings, {
    fields: [rooms.buildingId],
    references: [buildings.id],
  }),
  roomFacilities: many(roomFacilities),
}));

export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;
