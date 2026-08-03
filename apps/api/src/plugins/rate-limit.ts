import rateLimit from '@fastify/rate-limit';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { rateLimitConfig } from '../shared/lib/rate-limit-config';
import { verifyAccessToken } from '../shared/lib/jwt';

/**
 * Keys by authenticated user when possible, falling back to IP otherwise.
 * Plain IP keying alone lets a single stolen/leaked access token bypass its
 * bucket just by hammering the API from different IPs; keying by the
 * verified token's userId closes that gap for every authenticated route,
 * while unauthenticated routes (login/register — no token exists yet) still
 * get the IP-based brute-force protection they need. Decoded here directly
 * (rather than reading `request.userId`) because this runs on `onRequest`,
 * before the `authenticate` preHandler populates it — see authenticate.ts.
 */
function rateLimitKeyGenerator(request: FastifyRequest): string {
  const header = request.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const { userId } = verifyAccessToken(header.slice('Bearer '.length));
      return `user:${userId}`;
    } catch {
      // Invalid/expired token — fall through to IP keying below.
    }
  }
  return `ip:${request.ip}`;
}

/**
 * A generous global default (every route not given a tighter override
 * inherits this), plus much stricter per-route overrides on the endpoints
 * that actually need them — auth (brute-force target) and catalog search
 * (fires on every keystroke, cheap per-call but easy to hammer). See
 * auth.routes.ts / products.routes.ts for the overrides, applied via each
 * route's `config: { rateLimit: {...} }`.
 */
const rateLimitPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(rateLimit, {
    ...rateLimitConfig(300, '1 minute'),
    keyGenerator: rateLimitKeyGenerator,
    // Body included so a 429 still carries the shared ApiErrorBody shape
    // (see error-handler.ts) instead of @fastify/rate-limit's own default body.
    errorResponseBuilder: () => ({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests — try again shortly.',
      },
    }),
  });
};

export default fp(rateLimitPlugin, { name: 'rate-limit' });
