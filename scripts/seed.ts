import "dotenv/config";
import bcrypt from "bcrypt";
import { pool } from "../src/db/index.js";

async function seed() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || "admin@invoks.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "Admin123!";
    const adminName = process.env.ADMIN_NAME || "Administrator INVOKS";

    const [existing]: any = await pool.query(
      "SELECT id, email, role FROM users WHERE email = ?",
      [adminEmail]
    );

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(adminPassword, saltRounds);

    if (existing && existing.length > 0) {
      console.log(`Akun admin '${adminEmail}' sudah ada (dilewati).`);
    } else {
      await pool.query(
        "INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
        [adminName, adminEmail, passwordHash]
      );
      console.log(`Akun admin '${adminEmail}' berhasil dibuat.`);
    }

    // 2. Seed Master Gedung (KP, BNI, Dieng) - Aman dijalankan berulang
    const initialBuildings = [
      { name: "KP", code: "KP", description: "Gedung Kuliah Bersama / KP" },
      { name: "BNI", code: "BNI", description: "Gedung BNI" },
      { name: "Dieng", code: "DNG", description: "Gedung Dieng" },
    ];

    for (const b of initialBuildings) {
      const [bExisting]: any = await pool.query(
        "SELECT id FROM buildings WHERE name = ?",
        [b.name]
      );

      if (!bExisting || bExisting.length === 0) {
        await pool.query(
          "INSERT INTO buildings (name, code, description, is_active) VALUES (?, ?, ?, true)",
          [b.name, b.code, b.description]
        );
        console.log(`Gedung '${b.name}' berhasil dibuat.`);
      } else {
        console.log(`Gedung '${b.name}' sudah ada (dilewati).`);
      }
    }

    // 3. Seed Master Kategori Barang (Elektronik, Furnitur) - Aman dijalankan berulang
    const initialCategories = [
      { name: "Elektronik", slug: "elektronik" },
      { name: "Furnitur", slug: "furnitur" },
    ];

    for (const c of initialCategories) {
      const [cExisting]: any = await pool.query(
        "SELECT id FROM item_categories WHERE slug = ? OR name = ?",
        [c.slug, c.name]
      );

      if (!cExisting || cExisting.length === 0) {
        await pool.query(
          "INSERT INTO item_categories (name, slug) VALUES (?, ?)",
          [c.name, c.slug]
        );
        console.log(`Kategori '${c.name}' berhasil dibuat.`);
      } else {
        console.log(`Kategori '${c.name}' sudah ada (dilewati).`);
      }
    }
  } catch (error) {
    console.error("Gagal menjalankan seed:", error);
  } finally {
    await pool.end();
  }
}

seed();
