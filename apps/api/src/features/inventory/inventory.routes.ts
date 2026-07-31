import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import * as controller from './inventory.controller';
import {
  lotIdParamsSchema,
  purchaseEntryBodySchema,
  purchaseEntryResponseSchema,
  writeOffBodySchema,
  writeOffResponseSchema,
} from './inventory.schemas';

/** Every route here requires auth. See app.ts. */
const inventoryRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.post(
    '/lots/:lotId/inventory-entries',
    {
      schema: {
        tags: ['inventory'],
        params: lotIdParamsSchema,
        body: purchaseEntryBodySchema,
        response: { 201: purchaseEntryResponseSchema },
      },
    },
    controller.createPurchaseEntryHandler,
  );

  fastify.post(
    '/inventory/write-offs',
    {
      schema: {
        tags: ['inventory'],
        body: writeOffBodySchema,
        response: { 201: writeOffResponseSchema },
      },
    },
    controller.createWriteOffHandler,
  );
};

export default inventoryRoutes;
