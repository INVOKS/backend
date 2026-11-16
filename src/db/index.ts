import "dotenv/config";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "./schema/index.js";

export const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "invoks_db",
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  timezone: "Z",
});

// Set session time_zone koneksi pool ke UTC (+00:00) agar kolom TIMESTAMP dibaca dan ditulis sebagai UTC murni
pool.on("connection", (connection: any) => {
  connection.query("SET time_zone = '+00:00'");
});

export { schema };

export const db = drizzle({ client: pool, schema, mode: "default" });