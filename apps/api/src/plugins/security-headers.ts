import helmet from '@fastify/helmet';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

/**
 * Adds the standard hardening headers (X-Frame-Options, X-Content-Type-Options,
 * Referrer-Policy, etc.) — in particular X-Frame-Options: DENY, which stops
 * the Swagger UI at /documentation (the only HTML this API ever serves) from
 * being embedded in a hostile iframe (clickjacking).
 *
 * Content-Security-Policy is left off: Swagger UI's default assets rely on
 * inline scripts/styles that helmet's default CSP would block, and this API
 * otherwise never renders HTML for an end user to be tricked into clicking.
 */
const securityHeadersPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(helmet, {
    contentSecurityPolicy: false,
    global: true,
  });
};

export default fp(securityHeadersPlugin, { name: 'security-headers' });
