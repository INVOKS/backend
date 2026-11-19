import nodemailer from "nodemailer";
import { AppError } from "./app-error.js";

export function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const from =
    process.env.SMTP_FROM || `"INVOKS Vokasi UB" <${user || "noreply@invoks.id"}>`;

  if (
    !host ||
    !user ||
    !pass ||
    user === "emailkamu@gmail.com" ||
    pass === "16_karakter_app_password"
  ) {
    return null;
  }

  return { host, port, secure, user, pass, from };
}

export async function sendPasswordResetOtpEmail({
  to,
  fullName,
  otp,
}: {
  to: string;
  fullName: string;
  otp: string;
}): Promise<void> {
  const config = getSmtpConfig();
  if (!config) {
    throw new AppError(500, "Konfigurasi SMTP email belum diatur pada server");
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  const htmlContent = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Kata Sandi - INVOKS</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f4f6f8;
      margin: 0;
      padding: 24px;
      color: #1e293b;
    }
    .card {
      max-width: 520px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
    }
    .logo-text {
      font-size: 24px;
      font-weight: 800;
      color: #1e40af;
      letter-spacing: -0.5px;
    }
    .sub-title {
      font-size: 13px;
      color: #64748b;
      margin-top: 4px;
    }
    .greeting {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 12px;
    }
    .description {
      font-size: 14px;
      line-height: 1.6;
      color: #475569;
      margin-bottom: 24px;
    }
    .otp-container {
      background: #eff6ff;
      border: 2px dashed #93c5fd;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      margin-bottom: 24px;
    }
    .otp-code {
      font-family: 'Courier New', Courier, monospace;
      font-size: 36px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #1d4ed8;
      margin: 0;
    }
    .warning {
      font-size: 13px;
      color: #64748b;
      background: #f8fafc;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 24px;
      line-height: 1.5;
    }
    .footer {
      font-size: 12px;
      color: #94a3b8;
      text-align: center;
      border-top: 1px solid #f1f5f9;
      padding-top: 16px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo-text">INVOKS</div>
      <div class="sub-title">Fakultas Vokasi Universitas Brawijaya</div>
    </div>
    <div class="greeting">Halo, ${fullName}</div>
    <div class="description">
      Kami menerima permintaan untuk mereset kata sandi akun INVOKS Anda. Gunakan kode OTP 6 digit berikut untuk memverifikasi permintaan Anda:
    </div>
    <div class="otp-container">
      <div class="otp-code">${otp}</div>
    </div>
    <div class="warning">
      ⚠️ <strong>Penting:</strong> Kode ini hanya berlaku selama <strong>15 menit</strong>. Jangan pernah membagikan kode ini kepada siapapun demi keamanan akun Anda. Jika Anda tidak merasa melakukan permintaan ini, silakan abaikan email ini.
    </div>
    <div class="footer">
      Email ini dikirim otomatis oleh Sistem Peminjaman Ruangan & Barang INVOKS Vokasi UB.
    </div>
  </div>
</body>
</html>
  `;

  await transporter.sendMail({
    from: config.from,
    to,
    subject: "Kode Verifikasi Reset Kata Sandi - INVOKS Vokasi UB",
    text: `Halo ${fullName},\n\nKode OTP reset kata sandi Anda adalah: ${otp}\n\nKode ini berlaku selama 15 menit. Jangan bagikan kepada siapa pun.\nJika Anda tidak meminta ini, abaikan email ini.\n\nSalam,\nTim INVOKS Vokasi UB`,
    html: htmlContent,
  });
}
