import {
  mysqlTable,
  int,
  varchar,
  json,
  timestamp,
  unique,
  index,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { users } from "./users.js";

export const idempotencyRequests = mysqlTable(
  "idempotency_requests",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    operation: varchar("operation", { length: 100 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    requestHash: varchar("request_hash", { length: 64 }).notNull(),
    responseStatus: int("response_status").notNull(),
    responseBody: json("response_body").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("idempotency_user_op_key_uniq").on(
      table.userId,
      table.operation,
      table.idempotencyKey
    ),
    index("idempotency_requests_expires_at_idx").on(table.expiresAt),
  ]
);

export const idempotencyRequestsRelations = relations(
  idempotencyRequests,
  ({ one }) => ({
    user: one(users, {
      fields: [idempotencyRequests.userId],
      references: [users.id],
    }),
  })
);

export type IdempotencyRequest = typeof idempotencyRequests.$inferSelect;
export type NewIdempotencyRequest = typeof idempotencyRequests.$inferInsert;
