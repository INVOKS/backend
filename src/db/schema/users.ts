import {
  mysqlTable,
  int,
  varchar,
  mysqlEnum,
  text,
  date,
  timestamp,
  boolean,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  gender: mysqlEnum("gender", ["female", "male"]),
  dateOfBirth: date("date_of_birth", { mode: "string" }),
  department: varchar("department", { length: 100 }),
  userType: varchar("user_type", { length: 50 }),
  academicId: varchar("academic_id", { length: 50 }),
  phone: varchar("phone", { length: 20 }),
  profileImageUrl: text("profile_image_url"),
  buildingId: int("building_id"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
