import { env } from './env';

/**
 * The real, production limit everywhere except under test — where the suite
 * legitimately registers/logs in dozens of times within the same window
 * (once per test needing its own tenant) and would otherwise trip the same
 * brute-force protection meant for actual abuse. Keeps the production
 * numbers genuinely reviewable here rather than hidden behind an env check
 * at every call site.
 */
export function rateLimitConfig(max: number, timeWindow: string) {
  return { max: env.NODE_ENV === 'test' ? 1_000_000 : max, timeWindow };
}
