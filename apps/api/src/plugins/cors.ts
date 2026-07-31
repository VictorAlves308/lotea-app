import cors from '@fastify/cors';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { env } from '../shared/lib/env';

/**
 * CORS only governs *browser* requests — React Native's fetch doesn't send
 * preflight requests or enforce CORS the way a browser does, so a mobile-only
 * client never needs an allowed origin here at all. `CORS_ALLOWED_ORIGINS`
 * (comma-separated) is empty by default, which means "no browser origin is
 * allowed" — secure-by-default, since there's no admin/web client yet to
 * name. Add real origins there once one exists; never fall back to `true`
 * (reflect-any-origin), which would defeat the point of an allowlist.
 */
const corsPlugin: FastifyPluginAsync = async (fastify) => {
  const allowedOrigins = env.CORS_ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  await fastify.register(cors, {
    origin: allowedOrigins,
    // @fastify/cors defaults `methods` to 'GET,HEAD,POST' — every PATCH route
    // (product/customer/lot edits) would silently fail preflight for a
    // browser client otherwise. Every verb this API actually uses; add to
    // this list if a future route needs PUT/DELETE.
    methods: ['GET', 'HEAD', 'POST', 'PATCH'],
  });
};

export default fp(corsPlugin, { name: 'cors' });
