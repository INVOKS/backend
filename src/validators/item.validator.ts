import { z } from "zod";

export const unitItemSchema = z.object({
  inventoryCode: z
    .string()
    .trim()
    .min(1, "Kode inventaris wajib diisi")
    .max(50, "Kode inventaris maksimal 50 karakter"),
  condition: z.enum(["good", "damaged", "maintenance"]).default("good"),
  notes: z.string().trim().optional().nullable(),
});

export type UnitItemInput = z.infer<typeof unitItemSchema>;

const descriptionSchema = z
  .preprocess((val) => {
    if (typeof val === "string") {
      const trimmed = val.trim();
      return trimmed === "" ? null : trimmed;
    }
    return val;
  }, z.string().trim().nullable().optional());

const specificationsSchema = z
  .preprocess((val) => {
    if (val === undefined) return undefined;
    if (val === null) return null;
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed === "") return null;
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          return "__NOT_AN_OBJECT__";
        }
        return parsed;
      } catch {
        return "__INVALID_JSON__";
      }
    }
    if (typeof val !== "object" || Array.isArray(val)) {
      return "__NOT_AN_OBJECT__";
    }
    return val;
  }, z.unknown().superRefine((val, ctx) => {
    if (val === "__INVALID_JSON__") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Format spesifikasi harus berupa JSON yang valid",
      });
      return;
    }
    if (val === "__NOT_AN_OBJECT__") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Format spesifikasi harus berupa objek JSON (bukan array atau nilai primitif)",
      });
      return;
    }
  }))
  .optional()
  .nullable();

const unitsArraySchema = z
  .preprocess((val) => {
    if (typeof val === "string") {
      try {
        return JSON.parse(val);
      } catch {
        return "__INVALID_JSON__";
      }
    }
    return val;
  }, z.unknown())
  .superRefine((val, ctx) => {
    if (val === "__INVALID_JSON__") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Format field 'units' harus berupa JSON array yang valid",
      });
      return;
    }
    if (!Array.isArray(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Format field 'units' harus berupa array",
      });
      return;
    }
  })
  .pipe(
    z
      .array(unitItemSchema)
      .min(1, "Minimal sertakan 1 unit fisik untuk barang")
      .max(100, "Maksimal 100 unit fisik per permintaan")
      .refine(
        (items) => {
          const lowerCodes = items.map((i) => i.inventoryCode.toLowerCase());
          return new Set(lowerCodes).size === lowerCodes.length;
        },
        {
          message: "Terdapat kode inventaris duplikat dalam permintaan unit",
          path: [],
        }
      )
  );

export const createItemSchema = z.object({
  categoryId: z.coerce.number().int().positive("ID kategori harus positif"),
  name: z.string().trim().min(1, "Nama barang wajib diisi").max(255),
  description: descriptionSchema,
  specifications: specificationsSchema,
  units: unitsArraySchema,
});

export const updateItemSchema = z.object({
  categoryId: z.coerce.number().int().positive("ID kategori harus positif").optional(),
  name: z.string().trim().min(1, "Nama barang tidak boleh kosong").max(255).optional(),
  description: descriptionSchema,
  specifications: specificationsSchema,
});

export const addUnitsSchema = z.object({
  units: unitsArraySchema,
});

export const updateUnitSchema = z.object({
  condition: z.enum(["good", "damaged", "maintenance"]).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().trim().optional().nullable(),
});

export const itemFilterSchema = z.object({
  categoryId: z.coerce.number().int().positive().optional(),
  q: z.string().trim().optional(),
  includeInactive: z.string().optional(),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type AddUnitsInput = z.infer<typeof addUnitsSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
export type ItemFilterInput = z.infer<typeof itemFilterSchema>;
