import { cloudinary } from "../config/cloudinary.js";

export interface UploadResult {
  url: string;
  publicId: string;
}

/**
 * Upload gambar ke Cloudinary menggunakan buffer (memoryStorage).
 * Generic — dapat dipakai untuk rooms, items, dsb.
 *
 * @param buffer    Buffer file dari multer memoryStorage
 * @param mimeType  MIME type file, misal "image/jpeg"
 * @param folder    Folder logis di Cloudinary, misal "invoks/rooms"
 * @returns         URL aman (https) dan public_id dari Cloudinary
 */
export async function uploadImage(
  buffer: Buffer,
  mimeType: string,
  folder: string
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        asset_folder: folder, // Dynamic folders mode
        resource_type: "image",
        format: mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg",
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Upload ke Cloudinary gagal: tidak ada hasil"));
          return;
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id, // Simpan apa adanya, jangan dimodifikasi
        });
      }
    );
    stream.end(buffer);
  });
}

/**
 * Hapus gambar dari Cloudinary berdasarkan public_id.
 * Tidak melempar error — hanya log jika gagal (agar tidak memblokir flow utama).
 *
 * @param publicId  public_id yang disimpan di database
 */
export async function deleteImage(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    // Log tanpa menampilkan konten sensitif (API key/secret tidak ada di err message)
    console.error("Gagal menghapus gambar dari Cloudinary:", (err as Error).message ?? err);
  }
}

