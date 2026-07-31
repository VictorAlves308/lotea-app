import { searchCatalogInputSchema } from '@lotea/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { rateLimitConfig } from '../../shared/lib/rate-limit-config';
import * as controller from './catalog.controller';
import {
  catalogProductParamsSchema,
  catalogProductResponseSchema,
  catalogSuggestionListResponseSchema,
} from './catalog.schemas';

/** Every route here requires auth. See app.ts. */
const catalogRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get(
    '/catalog/search',
    {
      schema: {
        tags: ['catalog'],
        querystring: searchCatalogInputSchema,
        response: { 200: catalogSuggestionListResponseSchema },
      },
      // Same budget as /products/search — meant to fire on every keystroke
      // of an autocomplete box, but still bounded.
      config: { rateLimit: rateLimitConfig(60, '1 minute') },
    },
    controller.searchCatalogHandler,
  );

  fastify.get(
    '/catalog/:id',
    {
      schema: {
        tags: ['catalog'],
        params: catalogProductParamsSchema,
        response: { 200: catalogProductResponseSchema },
      },
    },
    controller.getCatalogProductHandler,
  );
};

export default catalogRoutes;
