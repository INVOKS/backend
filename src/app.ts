import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";

const app = express();

// Konfigurasi CORS lengkap untuk Web Browser, Flutter Web, Mobile, dan API clients
app.use(
  cors({
    origin: (_origin, callback) => callback(null, true),
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
