import { z } from "zod";
export const syntheticInputSchema = z.strictObject({
  operation: z.literal("echo"),
  message: z.string().trim().min(1).max(256),
});
export const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9_-]{8,80}$/);
export const runIdSchema = z.uuid();
export const syntheticResultSchema = z.strictObject({
  fixture: z.literal("infrastructure-only"),
  operation: z.literal("echo"),
  message: z.string().min(1).max(256),
});
export const runSchema = z.strictObject({
  id: runIdSchema,
  status: z.enum(["queued", "running", "completed", "failed"]),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  attempts: z.number().int().nonnegative(),
  result: syntheticResultSchema.nullable(),
  error: z.strictObject({ code: z.string(), details: z.string() }).nullable(),
});
export type SyntheticInput = z.infer<typeof syntheticInputSchema>;
export type SyntheticResult = z.infer<typeof syntheticResultSchema>;
