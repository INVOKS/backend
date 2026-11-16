import {
  mysqlTable,
  int,
  datetime,
  timestamp,
  index,
  unique,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { roomBookings } from "./room-bookings.js";
import { rooms } from "./rooms.js";

export const roomBookingSlots = mysqlTable(
  "room_booking_slots",
  {
    id: int("id").autoincrement().primaryKey(),
    roomBookingId: int("room_booking_id")
      .notNull()
      .references(() => roomBookings.id, { onDelete: "cascade" }),
    roomId: int("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "restrict" }),
    startAt: datetime("start_at", { mode: "string" }).notNull(),
    endAt: datetime("end_at", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("room_booking_slots_booking_start_idx").on(
      table.roomBookingId,
      table.startAt
    ),
    unique("room_booking_slots_room_id_start_at_unique").on(
      table.roomId,
      table.startAt
    ),
  ]
);

export const roomBookingSlotsRelations = relations(
  roomBookingSlots,
  ({ one }) => ({
    booking: one(roomBookings, {
      fields: [roomBookingSlots.roomBookingId],
      references: [roomBookings.id],
    }),
    room: one(rooms, {
      fields: [roomBookingSlots.roomId],
      references: [rooms.id],
    }),
  })
);

export type RoomBookingSlot = typeof roomBookingSlots.$inferSelect;
export type NewRoomBookingSlot = typeof roomBookingSlots.$inferInsert;

