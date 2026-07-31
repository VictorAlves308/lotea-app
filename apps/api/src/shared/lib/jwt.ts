import jwt from 'jsonwebtoken';

import { env } from './env';

export interface AccessTokenClaims {
  userId: string;
}

/**
 * The access token is a stateless, self-contained JWT — verified without a
 * database lookup on every request, which is the whole performance point of
 * using one here (unlike the refresh token, which is always DB-checked for
 * revocation; see tokens.ts). The tradeoff this accepts: an access token
 * can't be revoked before it naturally expires (JWT_ACCESS_TTL_SECONDS,
 * 15 minutes by default) — standard, deliberate, and why the TTL is short.
 */
export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL_SECONDS,
  });
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (typeof payload !== 'object' || payload === null || typeof payload.sub !== 'string') {
    throw new Error('Invalid access token payload');
  }
  return { userId: payload.sub };
}
