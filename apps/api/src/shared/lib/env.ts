import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  // No defaults for either secret — a forgotten env var must fail loudly on
  // boot, never silently fall back to a well-known committed value. Separate
  // secrets for access vs. refresh tokens so a leaked access-token secret
  // alone can't be used to forge refresh tokens.
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60),
  JWT_REFRESH_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(30 * 24 * 60 * 60),
  // Comma-separated list of allowed browser origins for CORS. Empty/unset is
  // valid and means "no browser origin is allowed" — fine for a mobile-only
  // API, since React Native's fetch doesn't enforce or send CORS preflight
  // the way a browser does. See plugins/cors.ts.
  CORS_ALLOWED_ORIGINS: z.string().default(''),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables — see above for details.');
  }
  return result.data;
}

// Fails fast on boot if a required variable is missing or malformed — see ARCHITECTURE.md §10.
export const env = loadEnv();
