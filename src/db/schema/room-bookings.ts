import {
  mysqlTable,
  int,
  varchar,
  text,
  mysqlEnum,
  timestamp,
  index,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { users } from "./users.js";
import { rooms } from "./rooms.js";
import { roomBookingSlots } from "./room-booking-slots.js";

export const roomBookings = mysqlTable(
  "room_bookings",
  {
    id: int("id").autoincrement().primaryKey(),
    bookingCode: varchar("booking_code", { length: 50 }).notNull().unique(),
    userId: int("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    roomId: int("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "restrict" }),
    activityName: varchar("activity_name", { length: 255 }).notNull(),
    activityDescription: text("activity_description"),
    organizer: varchar("organizer", { length: 150 }).notNull(),
    participantCount: int("participant_count").notNull(),
    picName: varchar("pic_name", { length: 100 }).notNull(),
    picPhone: varchar("pic_phone", { length: 30 }).notNull(),
    status: mysqlEnum("status", ["booked", "cancelled"])
      .default("booked")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("room_bookings_room_id_status_idx").on(table.roomId, table.status),
  ]
);

export const roomBookingsRelations = relations(roomBookings, ({ one, many }) => ({
  user: one(users, {
    fields: [roomBookings.userId],
    references: [users.id],
  }),
  room: one(rooms, {
    fields: [roomBookings.roomId],
    references: [rooms.id],
  }),
  slots: many(roomBookingSlots),
}));

export type RoomBooking = typeof roomBookings.$inferSelect;
export type NewRoomBooking = typeof roomBookings.$inferInsert;

