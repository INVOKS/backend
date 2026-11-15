import { z } from "zod";

export const createFacilitySchema = z.object({
  name: z.string().trim().min(2, "Nama fasilitas minimal 2 karakter").max(100),
  icon: z.string().trim().max(50).optional().nullable(),
  description: z.string().trim().optional().nullable(),
});

export const updateFacilitySchema = createFacilitySchema.partial();

export type CreateFacilityInput = z.infer<typeof createFacilitySchema>;
export type UpdateFacilityInput = z.infer<typeof updateFacilitySchema>;

