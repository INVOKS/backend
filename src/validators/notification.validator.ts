import { z } from "zod";

export const notificationQuerySchema = z.object({
  isRead: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type NotificationQueryInput = z.infer<typeof notificationQuerySchema>;
