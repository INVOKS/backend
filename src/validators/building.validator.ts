import { z } from "zod";

export const createBuildingSchema = z.object({
  name: z.string().trim().min(2, "Nama gedung minimal 2 karakter").max(100),
  code: z.string().trim().max(20).optional(),
  description: z.string().trim().optional(),
  imageUrl: z.string().url("Format URL gambar tidak valid").optional().nullable(),
});

export const updateBuildingSchema = createBuildingSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateBuildingInput = z.infer<typeof createBuildingSchema>;
export type UpdateBuildingInput = z.infer<typeof updateBuildingSchema>;

