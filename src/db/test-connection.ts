import { pool } from "./index.js";

async function testConnection() {
  try {
    const [rows] = await pool.query(
      "SELECT DATABASE() AS database_name, VERSION() AS mysql_version"
    );
    console.log("MySQL connected successfully!");
    console.log(rows);

    const [tables] = await pool.query("SHOW TABLES");
    console.log("Daftar tabel:");
    console.log(tables);

    const [columns] = await pool.query("DESCRIBE users");
    console.log("Struktur tabel users:");
    console.table(columns);
  } catch (error) {
    console.error("MySQL connection failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

testConnection();