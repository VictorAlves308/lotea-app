import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import * as controller from './dashboard.controller';
import { dashboardQuerySchema, dashboardResponseSchema } from './dashboard.schemas';

/**
 * One consolidated endpoint, not "dezenas de endpoints" — see DATABASE.md,
 * "Financial dashboard". Every route here requires auth. See app.ts.
 */
const dashboardRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get(
    '/dashboard/financial',
    {
      schema: {
        tags: ['dashboard'],
        querystring: dashboardQuerySchema,
        response: { 200: dashboardResponseSchema },
      },
    },
    controller.getFinancialDashboardHandler,
  );
};

export default dashboardRoutes;
