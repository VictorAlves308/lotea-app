import { createHash, randomBytes } from 'node:crypto';

/**
 * Refresh tokens are opaque random strings, not JWTs — the JWT self-contained
 * claims (embedded expiry, stateless verification) matter for the
 * short-lived access token, not for the refresh token, which is already
 * looked up against the database on every use to check revocation. Making it
 * a JWT too would just add a second, redundant source of truth for expiry.
 */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Refresh tokens are stored hashed, never raw — a leaked database row can't
 * be replayed as a valid token. SHA-256 (not bcrypt) is correct here: this
 * token already has 256 bits of entropy from `generateOpaqueToken`, so
 * there's no low-entropy-secret brute-force risk to slow down against, and a
 * fast, deterministic hash is what allows an exact-match DB lookup at all
 * (bcrypt's per-call random salt makes it unsuitable for lookup by hash).
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
