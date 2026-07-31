import { authTokensSchema, currentUserSchema } from '@lotea/shared';
import { z } from 'zod';

/** register/login both return the user plus a fresh token pair. */
export const authResponseSchema = z.object({
  user: currentUserSchema,
  tokens: authTokensSchema,
});

export const tokensResponseSchema = authTokensSchema;
export const meResponseSchema = currentUserSchema;
