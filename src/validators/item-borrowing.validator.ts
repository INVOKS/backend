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

const borrowingUnitItemSchema = z
  .object({
    itemUnitId: z.coerce.number().int().positive("ID unit barang harus positif"),
    slots: z
      .array(slotItemSchema)
      .min(1, "Minimal pilih 1 slot waktu per unit")
      .max(50, "Maksimal 50 slot per unit"),
  })
  .refine(
    (unit) => {
      const times = unit.slots.map((s) => formatInputSlotToDbString(s.startAt));
      return new Set(times).size === times.length;
    },
    {
      message: "Tidak boleh ada slot waktu duplikat dalam satu unit",
      path: ["slots"],
    }
  )
  .refine(
    (unit) => {
      for (const slot of unit.slots) {
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
    (unit) => {
      for (const slot of unit.slots) {
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

export const createItemBorrowingSchema = z
  .object({
    activityName: z
      .string()
      .trim()
      .min(1, "Nama kegiatan wajib diisi")
      .max(255, "Nama kegiatan maksimal 255 karakter"),
    picName: z
      .string()
      .trim()
      .min(1, "Nama penanggung jawab wajib diisi")
      .max(100, "Nama penanggung jawab maksimal 100 karakter"),
    picPhone: z
      .string()
      .trim()
      .min(1, "Nomor telepon penanggung jawab wajib diisi")
      .max(30, "Nomor telepon penanggung jawab maksimal 30 karakter"),
    units: z
      .array(borrowingUnitItemSchema)
      .min(1, "Minimal pilih 1 unit barang")
      .max(20, "Maksimal 20 unit barang per peminjaman"),
  })
  .refine(
    (data) => {
      const ids = data.units.map((u) => u.itemUnitId);
      return new Set(ids).size === ids.length;
    },
    {
      message: "Tidak boleh ada unit barang duplikat dalam satu permintaan peminjaman",
      path: ["units"],
    }
  );

export const itemBorrowingFilterSchema = z.object({
  status: z.enum(["booked", "completed", "cancelled"]).optional(),
  itemUnitId: z.coerce.number().int().positive().optional(),
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD")
    .optional(),
});

export const itemUnitAvailabilityQuerySchema = z
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

export const returnUnitItemSchema = z.object({
  itemUnitId: z.coerce.number().int().positive("ID unit barang harus positif"),
  returnCondition: z.enum(["good", "damaged", "maintenance"]).default("good"),
  returnNotes: z
    .string()
    .trim()
    .max(1000, "Catatan pengembalian maksimal 1000 karakter")
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
});

export const returnItemBorrowingUnitsSchema = z
  .object({
    units: z
      .array(returnUnitItemSchema)
      .min(1, "Minimal pilih 1 unit barang untuk dikembalikan")
      .max(20, "Maksimal 20 unit barang per permintaan pengembalian"),
  })
  .refine(
    (data) => {
      const ids = data.units.map((u) => u.itemUnitId);
      return new Set(ids).size === ids.length;
    },
    {
      message: "Tidak boleh ada unit barang duplikat dalam satu permintaan pengembalian",
      path: ["units"],
    }
  );

export type CreateItemBorrowingInput = z.infer<typeof createItemBorrowingSchema>;
export type ItemBorrowingFilterInput = z.infer<typeof itemBorrowingFilterSchema>;
export type ItemUnitAvailabilityQueryInput = z.infer<
  typeof itemUnitAvailabilityQuerySchema
>;
export type ReturnItemBorrowingUnitsInput = z.infer<
  typeof returnItemBorrowingUnitsSchema
>;
