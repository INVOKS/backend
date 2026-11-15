import multer from "multer";
import { AppError } from "../utils/app-error.js";

// Baca batas ukuran upload dari env: default 5 MB jika kosong, bukan angka, atau < 1; maksimal 10 MB (Cloudinary Free limit)
const parsedMb = Number(process.env.MAX_UPLOAD_MB);
export const MAX_UPLOAD_MB =
  !process.env.MAX_UPLOAD_MB || isNaN(parsedMb) || parsedMb < 1
    ? 5
    : Math.min(parsedMb, 10);

const fileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        400,
        "Format file tidak didukung. Hanya file JPG, PNG, dan WebP yang diizinkan"
      )
    );
  }
};

export const uploadRoomImage = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: MAX_UPLOAD_MB * 1024 * 1024,
  },
});
