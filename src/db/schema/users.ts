import {
  mysqlTable,
  int,
  varchar,
  mysqlEnum,
  text,
  date,
  timestamp,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  namaLengkap: varchar("nama_lengkap", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  gender: mysqlEnum("gender", ["perempuan", "laki_laki"]),
  tanggalLahir: date("tanggal_lahir", { mode: "string" }),
  jurusan: varchar("jurusan", { length: 100 }),
  jenisPengguna: varchar("jenis_pengguna", { length: 50 }),
  nimNidn: varchar("nim_nidn", { length: 50 }),
  noTelp: varchar("no_telp", { length: 20 }),
  foto: text("foto"),
  gedungId: int("gedung_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
