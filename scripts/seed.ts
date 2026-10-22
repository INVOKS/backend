import "dotenv/config";
import bcrypt from "bcrypt";
import { pool } from "../src/db/index.js";

async function seed() {
  try {
    const adminEmail = "admin@invoks.com";
    const [existing]: any = await pool.query(
      "SELECT id, email, role FROM users WHERE email = ?",
      [adminEmail]
    );

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash("Admin123!", saltRounds);

    if (existing && existing.length > 0) {
      await pool.query(
        "UPDATE users SET role = 'admin', password_hash = ?, nama_lengkap = 'Administrator INVOKS' WHERE email = ?",
        [passwordHash, adminEmail]
      );
      console.log(`Akun admin '${adminEmail}' berhasil diperbarui.`);
    } else {
      await pool.query(
        "INSERT INTO users (nama_lengkap, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
        ["Administrator INVOKS", adminEmail, passwordHash]
      );
      console.log(`Akun admin '${adminEmail}' berhasil dibuat.`);
    }
  } catch (error) {
    console.error("Gagal menjalankan seed:", error);
  } finally {
    await pool.end();
  }
}

seed();
