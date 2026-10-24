import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";

const app = express();

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((item) => item.trim())
  : null;

// Konfigurasi CORS lengkap untuk Web Browser, Flutter Web, Mobile, dan API clients
app.use(
  cors({
    origin: (origin, callback) => {
      // Izinkan jika tanpa origin (mobile apps, Postman/curl) atau jika wildcard diset
      if (!origin || !allowedOrigins || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} tidak diizinkan oleh CORS`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Requested-With"],
  })
);

app.use(express.json());

// Request logger untuk monitoring lalu lintas request secara real-time
app.use((req, _res, next) => {
  const timestamp = new Date().toTimeString().split(" ")[0] || "";
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
});

// Rute root (/) untuk mengecek server langsung dari browser
app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Selamat datang di INVOKS API!",
    health: "/api/health",
  });
});

// Health check endpoint sesuai dokumentasi INVOKS
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "INVOKS API is running!",
  });
});

app.use("/api/auth", authRoutes);

// Error handler diletakkan paling bawah setelah seluruh rute
app.use(errorHandler);

export default app;
