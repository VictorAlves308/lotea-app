import { z } from 'zod';

import { fullAuditFieldsSchema, idSchema } from './common.schema';

/**
 * A User is the tenant boundary — every business record belongs to exactly
 * one User. No password/auth fields yet: this schema captures tenant
 * identity only, ahead of the auth feature. See DATABASE.md.
 */
export const userSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(120),
  email: z.string().email(),
  ...fullAuditFieldsSchema.shape,
});
export type User = z.infer<typeof userSchema>;
