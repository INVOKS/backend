import jwt from "jsonwebtoken";
import { AppError } from "./app-error.js";

const JWT_SECRET: string = process.env.JWT_SECRET || "default_fallback_secret";

export interface DecodedToken {
  id: number;
  role: "user" | "admin";
}

export function signToken(
  userId: number,
  role: "user" | "admin",
  ingatSaya: boolean = false
): string {
  const expiresIn = ingatSaya ? "30d" : "1d";

  return jwt.sign({ role }, JWT_SECRET, {
    subject: String(userId),
    expiresIn,
  });
}

export function verifyToken(token: string): DecodedToken {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;

    if (!decoded.sub) {
      throw new AppError(401, "Token tidak valid");
    }

    const role = decoded["role"];
    if (role !== "user" && role !== "admin") {
      throw new AppError(401, "Token tidak valid: role tidak dikenal");
    }

    return {
      id: Number(decoded.sub),
      role,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(401, "Token tidak valid atau kedaluwarsa");
  }
}
