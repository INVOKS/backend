import { z } from "zod";
import {
  isSlotPast,
  isValidDateString,
  isValidMonthString,
  getMonthDifferenceFromNowJakarta,
  formatInputSlotToDbString,
} from "../utils/datetime.js";

const slotItemSchema = z.object({
  startAt: z
    .string()
    .trim()
    .superRefine((val, ctx) => {
      if (val.endsWith("Z") || val.includes("Z")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Format startAt tidak boleh menggunakan zona UTC ("Z"). Gunakan waktu Jakarta (WIB). Contoh format yang benar: "2026-11-20T09:00" atau "2026-11-20T09:00:00+07:00"',
        });
        return;
      }

      const offsetMatch = val.match(/([+-]\d{2}:\d{2})$/);
      if (offsetMatch && offsetMatch[1] !== "+07:00") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Offset zona waktu '${offsetMatch[1]}' tidak didukung. Gunakan waktu Jakarta (+07:00) atau tanpa offset. Contoh format yang benar: "2026-11-20T09:00" atau "2026-11-20T09:00:00+07:00"`,
        });
        return;
      }

      const validRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:00(:00)?(\+07:00)?$/;
      if (!validRegex.test(val)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Format startAt tidak valid. Gunakan format "YYYY-MM-DDTHH:mm" atau "YYYY-MM-DDTHH:mm:ss" (menit 00), boleh dengan akhiran "+07:00". Contoh format yang benar: "2026-11-20T09:00" atau "2026-11-20T09:00:00+07:00"',
        });
        return;
      }
    }),
});

export const createRoomBookingSchema = z
  .object({
    roomId: z.coerce.number().int().positive("ID ruangan harus positif"),
    activityName: z.string().trim().min(1, "Nama kegiatan wajib diisi").max(255),
    activityDescription: z.string().trim().optional().nullable(),
    organizer: z.string().trim().min(1, "Penyelenggara wajib diisi").max(150),
    participantCount: z.coerce.number().int().min(1, "Jumlah peserta minimal 1"),
    picName: z.string().trim().min(1, "Nama penanggung jawab wajib diisi").max(100),
    picPhone: z.string().trim().min(1, "Nomor telepon penanggung jawab wajib diisi").max(30),
    slots: z
      .array(slotItemSchema)
      .min(1, "Minimal pilih 1 slot waktu")
      .max(50, "Maksimal 50 slot per pemesanan"),
  })
  .refine(
    (data) => {
      const times = data.slots.map((s) => formatInputSlotToDbString(s.startAt));
      return new Set(times).size === times.length;
    },
    {
      message: "Tidak boleh ada slot waktu duplikat dalam satu permintaan",
      path: ["slots"],
    }
  )
  .refine(
    (data) => {
      for (const slot of data.slots) {
        const hour = parseInt(slot.startAt.slice(11, 13), 10);
        if (isNaN(hour) || hour < 7 || hour > 18) {
          return false;
        }
      }
      return true;
    },
    {
      message: "Jam mulai slot harus antara pukul 07:00 hingga 18:00 WIB",
      path: ["slots"],
    }
  )
  .refine(
    (data) => {
      for (const slot of data.slots) {
        if (isSlotPast(slot.startAt)) {
          return false;
        }
      }
      return true;
    },
    {
      message: "Slot waktu tidak boleh di masa lalu",
      path: ["slots"],
    }
  );

export const roomBookingFilterSchema = z.object({
  roomId: z.coerce.number().int().positive().optional(),
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD")
    .optional(),
  status: z.enum(["booked", "cancelled"]).optional(),
});

export const roomAvailabilityQuerySchema = z
  .object({
    date: z.string().trim().optional(),
    month: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    const hasDate = Boolean(data.date);
    const hasMonth = Boolean(data.month);

    if (hasDate && hasMonth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Harap sertakan tepat satu query parameter: 'date' atau 'month', tidak boleh keduanya",
        path: ["date"],
      });
      return;
    }

    if (!hasDate && !hasMonth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Harap sertakan salah satu query parameter: 'date' (YYYY-MM-DD) atau 'month' (YYYY-MM)",
        path: ["date"],
      });
      return;
    }

    if (hasDate && data.date) {
      if (!isValidDateString(data.date)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Format tanggal tidak valid. Gunakan format YYYY-MM-DD yang benar",
          path: ["date"],
        });
      }
    }

    if (hasMonth && data.month) {
      if (!isValidMonthString(data.month)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Format bulan tidak valid. Gunakan format YYYY-MM yang benar",
          path: ["month"],
        });
        return;
      }

      const diff = getMonthDifferenceFromNowJakarta(data.month);
      if (diff > 12) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Pencarian bulan tidak boleh lebih dari 12 bulan ke depan dari bulan sekarang",
          path: ["month"],
        });
      }
    }
  });

export type CreateRoomBookingInput = z.infer<typeof createRoomBookingSchema>;
export type RoomBookingFilterInput = z.infer<typeof roomBookingFilterSchema>;
export type RoomAvailabilityQueryInput = z.infer<
  typeof roomAvailabilityQuerySchema
>;
