import { z } from "zod";

export const getAuditLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  offset: z.coerce.number().int().nonnegative().optional(),
  entityType: z.string().trim().optional(),
  action: z.string().trim().optional(),
  actorUserId: z.coerce.number().int().positive().optional(),
});

export type GetAuditLogsQuery = z.infer<typeof getAuditLogsQuerySchema>;
