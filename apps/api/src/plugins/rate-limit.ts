import rateLimit from '@fastify/rate-limit';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { rateLimitConfig } from '../shared/lib/rate-limit-config';

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
