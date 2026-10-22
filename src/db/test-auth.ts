import app from "../app.js";
import { pool } from "./index.js";
import type { Server } from "http";

async function runTests() {
  const PORT = 5099;
  const server: Server = app.listen(PORT);
  const BASE_URL = `http://localhost:${PORT}/api/auth`;

  try {
    console.log("=== MEMULAI TEST AUTH ENDPOINTS ===");

    // Bersihkan data user uji coba jika ada sebelumnya
    await pool.query("DELETE FROM users WHERE email = 'budi.santoso@test.com'");

    // 1. Test Register Sukses
    console.log("\n[Test 1] Register Sukses (POST /api/auth/register)");
    const resReg = await fetch(`${BASE_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        namaLengkap: "Budi Santoso",
        email: "budi.santoso@test.com",
        password: "Budi@Password123",
        konfirmasiPassword: "Budi@Password123",
      }),
    });
    const dataReg = await resReg.json();
    console.log("Status:", resReg.status);
    console.log("Response:", JSON.stringify(dataReg, null, 2));

    // Cek password hash di DB
    const [rows]: any = await pool.query(
      "SELECT id, role, email, password_hash FROM users WHERE email = 'budi.santoso@test.com'"
    );
    console.log("DB check:", rows[0]);
    console.log(
      "Password hash berawalan $2b$:",
      rows[0]?.password_hash?.startsWith("$2b$")
    );

    // 2. Test Register Email Duplikat (409)
    console.log("\n[Test 2] Register Email Duplikat (Harus 409)");
    const resDup = await fetch(`${BASE_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        namaLengkap: "Budi Santoso Duplicate",
        email: "budi.santoso@test.com",
        password: "Budi@Password123",
        konfirmasiPassword: "Budi@Password123",
      }),
    });
    console.log("Status:", resDup.status);
    console.log("Response:", await resDup.json());

    // 3. Test Register Password Lemah & Konfirmasi Tidak Cocok (400)
    console.log("\n[Test 3] Password Lemah & Konfirmasi Salah (Harus 400)");
    const resWeak = await fetch(`${BASE_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        namaLengkap: "Bu",
        email: "bukan-email",
        password: "lemah",
        konfirmasiPassword: "beda",
      }),
    });
    console.log("Status:", resWeak.status);
    console.log("Response:", await resWeak.json());

    // 4. Test Login Sukses (User)
    console.log("\n[Test 4] Login Sukses (POST /api/auth/login)");
    const resLogin = await fetch(`${BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "budi.santoso@test.com",
        password: "Budi@Password123",
        ingatSaya: true,
      }),
    });
    const dataLogin: any = await resLogin.json();
    console.log("Status:", resLogin.status);
    console.log("Token didapat:", !!dataLogin.data?.token);
    console.log("User data:", dataLogin.data?.user);
    const userToken = dataLogin.data?.token;

    // 5. Test Login Password Salah (401)
    console.log("\n[Test 5] Login Password Salah (Harus 401)");
    const resWrongPass = await fetch(`${BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "budi.santoso@test.com",
        password: "WrongPassword@123",
      }),
    });
    console.log("Status:", resWrongPass.status);
    console.log("Response:", await resWrongPass.json());

    // 6. Test GET /api/auth/me tanpa token (401)
    console.log("\n[Test 6] GET /me Tanpa Token (Harus 401)");
    const resMeNoToken = await fetch(`${BASE_URL}/me`);
    console.log("Status:", resMeNoToken.status);
    console.log("Response:", await resMeNoToken.json());

    // 7. Test GET /api/auth/me dengan token valid (200)
    console.log("\n[Test 7] GET /me Dengan Token Valid (Harus 200)");
    const resMe = await fetch(`${BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    console.log("Status:", resMe.status);
    console.log("Response:", await resMe.json());

    // 8. Test Login Admin dengan akun User (Harus 401)
    console.log(
      "\n[Test 8] Login Admin dengan akun role 'user' (Harus 401)"
    );
    const resAdminLoginUser = await fetch(`${BASE_URL}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "budi.santoso@test.com",
        password: "Budi@Password123",
      }),
    });
    console.log("Status:", resAdminLoginUser.status);
    console.log("Response:", await resAdminLoginUser.json());

    // 9. Test Login Admin setelah role diubah jadi admin di DB (200)
    console.log(
      "\n[Test 9] Ubah role jadi 'admin' di DB, lalu login admin (Harus 200)"
    );
    await pool.query(
      "UPDATE users SET role = 'admin' WHERE email = 'budi.santoso@test.com'"
    );
    const resAdminLogin = await fetch(`${BASE_URL}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "budi.santoso@test.com",
        password: "Budi@Password123",
      }),
    });
    console.log("Status:", resAdminLogin.status);
    const dataAdminLogin: any = await resAdminLogin.json();
    console.log("Response:", dataAdminLogin);

    console.log("\n=== SEMUA 9 TEST BERHASIL DIJALANKAN ===");
  } catch (error) {
    console.error("Test Gagal:", error);
  } finally {
    server.close();
    await pool.end();
  }
}

runTests();
