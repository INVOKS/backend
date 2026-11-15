import { z } from "zod";

export const createRoomSchema = z
  .object({
    buildingId: z.coerce.number().int().positive("ID gedung harus positif"),
    roomCode: z.string().trim().min(1, "Kode ruangan wajib diisi").max(50),
    name: z.string().trim().min(2, "Nama ruangan minimal 2 karakter").max(100),
    floor: z.string().trim().min(1, "Lantai ruangan wajib diisi").max(50),
    capacityMin: z.coerce.number().int().min(1, "Kapasitas minimal harus lebih besar dari 0").default(1),
    capacityMax: z.coerce.number().int().min(1, "Kapasitas maksimal harus lebih besar dari 0"),
    description: z.string().trim().optional().nullable(),
    status: z.enum(["available", "borrowed", "maintenance"]).default("available"),
  })
  .refine((data) => data.capacityMax >= data.capacityMin, {
    message: "Kapasitas maksimal harus lebih besar atau sama dengan kapasitas minimal",
    path: ["capacityMax"],
  });

export const updateRoomSchema = z
  .object({
    buildingId: z.coerce.number().int().positive().optional(),
    roomCode: z.string().trim().min(1).max(50).optional(),
    name: z.string().trim().min(2).max(100).optional(),
    floor: z.string().trim().min(1).max(50).optional(),
    capacityMin: z.coerce.number().int().min(1).optional(),
    capacityMax: z.coerce.number().int().min(1).optional(),
    description: z.string().trim().optional().nullable(),
    status: z.enum(["available", "borrowed", "maintenance"]).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.capacityMin !== undefined && data.capacityMax !== undefined) {
        return data.capacityMax >= data.capacityMin;
      }
      return true;
    },
    {
      message: "Kapasitas maksimal harus lebih besar atau sama dengan kapasitas minimal",
      path: ["capacityMax"],
    }
  );

export const setRoomFacilitiesSchema = z.object({
  facilities: z
    .array(
      z.object({
        facilityId: z.coerce.number().int().positive("ID fasilitas harus positif"),
        quantity: z.coerce.number().int().min(1, "Jumlah fasilitas minimal 1").default(1),
      })
    )
    .refine(
      (items) => {
        const ids = items.map((item) => item.facilityId);
        return new Set(ids).size === ids.length;
      },
      {
        message: "Tidak boleh ada ID fasilitas duplikat dalam satu ruangan",
        path: ["facilities"],
      }
    ),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type SetRoomFacilitiesInput = z.infer<typeof setRoomFacilitiesSchema>;
