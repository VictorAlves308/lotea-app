import {
  loginInputSchema,
  logoutInputSchema,
  refreshInputSchema,
  registerInputSchema,
} from '@lotea/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { rateLimitConfig } from '../../shared/lib/rate-limit-config';
import * as controller from './auth.controller';
import { authResponseSchema, meResponseSchema, tokensResponseSchema } from './auth.schemas';

// Auth endpoints are the highest-value brute-force target in the whole API —
// each gets its own, tighter-than-default rate limit. See app.ts for the
// global default and plugins/rate-limit wiring.
const authRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    '/auth/register',
    {
      schema: {
        tags: ['auth'],
        body: registerInputSchema,
        response: { 201: authResponseSchema },
      },
      config: { rateLimit: rateLimitConfig(5, '15 minutes') },
    },
    controller.registerHandler,
  );

  fastify.post(
    '/auth/login',
    {
      schema: {
        tags: ['auth'],
        body: loginInputSchema,
        response: { 200: authResponseSchema },
      },
      config: { rateLimit: rateLimitConfig(10, '15 minutes') },
    },
    controller.loginHandler,
  );

  fastify.post(
    '/auth/refresh',
    {
      schema: {
        tags: ['auth'],
        body: refreshInputSchema,
        response: { 200: tokensResponseSchema },
      },
      config: { rateLimit: rateLimitConfig(20, '15 minutes') },
    },
    controller.refreshHandler,
  );

  fastify.post(
    '/auth/logout',
    {
      schema: {
        tags: ['auth'],
        body: logoutInputSchema,
        response: { 204: z.void() },
      },
      config: { rateLimit: rateLimitConfig(20, '15 minutes') },
    },
    controller.logoutHandler,
  );

  fastify.get(
    '/auth/me',
    {
      preHandler: fastify.authenticate,
      schema: {
        tags: ['auth'],
        response: { 200: meResponseSchema },
      },
    },
    controller.meHandler,
  );
};

export default authRoutes;
