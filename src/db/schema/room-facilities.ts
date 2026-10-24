import { mysqlTable, int, timestamp } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { rooms } from "./rooms.js";
import { facilities } from "./facilities.js";

export const roomFacilities = mysqlTable("room_facilities", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("room_id")
    .notNull()
    .references(() => rooms.id, { onDelete: "cascade" }),
  facilityId: int("facility_id")
    .notNull()
    .references(() => facilities.id, { onDelete: "cascade" }),
  jumlah: int("jumlah").default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
