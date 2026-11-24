import { z } from "zod";

export const updateSystemSettingSchema = z.object({
  settingValue: z.record(z.string(), z.any(), {
    message: "settingValue harus berupa objek JSON yang valid",
  }),
  description: z.string().trim().max(1000).optional(),
});

export type UpdateSystemSettingInput = z.infer<
  typeof updateSystemSettingSchema
>;
