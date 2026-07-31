import { z } from 'zod';

import { idSchema } from './common.schema';

/**
 * Password rules live here once, shared by register and any future
 * change-password flow. Deliberately simple (length only) — this is a
 * small-business tool, not a high-security target; the goal is "long enough
 * to resist casual guessing," not a composition-rule gauntlet that pushes
 * users toward "Senha123!" patterns.
 */
export const passwordSchema = z.string().min(8).max(72);

export const registerInputSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerInputSchema>;

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const refreshInputSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof refreshInputSchema>;

/** Same shape as refreshInputSchema today, kept as its own type since logout's contract may diverge later. */
export const logoutInputSchema = z.object({
  refreshToken: z.string().min(1),
});
export type LogoutInput = z.infer<typeof logoutInputSchema>;

/** What every successful auth action (register/login/refresh) returns. */
export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  /** Access token lifetime in seconds, so the client knows when to refresh. */
  expiresIn: z.number().int().positive(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

/** The public shape of the authenticated user — never passwordHash. */
export const currentUserSchema = z.object({
  id: idSchema,
  name: z.string(),
  email: z.string().email(),
});
export type CurrentUser = z.infer<typeof currentUserSchema>;
