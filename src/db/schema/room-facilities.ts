import { mysqlTable, int, timestamp, unique, check } from "drizzle-orm/mysql-core";
import { relations, sql } from "drizzle-orm";
import { rooms } from "./rooms.js";
import { facilities } from "./facilities.js";

export const roomFacilities = mysqlTable(
  "room_facilities",
  {
    id: int("id").autoincrement().primaryKey(),
    roomId: int("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    facilityId: int("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    quantity: int("quantity").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("room_facilities_room_id_facility_id_unique").on(
      table.roomId,
      table.facilityId
    ),
    check("room_facilities_quantity_positive", sql`${table.quantity} > 0`),
  ]
);

export const roomFacilitiesRelations = relations(roomFacilities, ({ one }) => ({
  room: one(rooms, {
    fields: [roomFacilities.roomId],
    references: [rooms.id],
  }),
  facility: one(facilities, {
    fields: [roomFacilities.facilityId],
    references: [facilities.id],
  }),
}));

export type RoomFacility = typeof roomFacilities.$inferSelect;
export type NewRoomFacility = typeof roomFacilities.$inferInsert;
