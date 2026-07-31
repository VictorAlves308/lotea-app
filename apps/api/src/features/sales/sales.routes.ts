import { createSaleInputSchema, listSalesQuerySchema } from '@lotea/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import * as controller from './sales.controller';
import { saleListResponseSchema, saleParamsSchema, saleResponseSchema } from './sales.schemas';

/**
 * The first public HTTP surface for sales — sales.service.ts/repository.ts
 * already existed (called only by seed.ts and tests) but had no routes.
 * `GET /sales` (cross-customer, most-recent-first) backs the Vendas screen —
 * a single customer's sales remain reachable via her statement, but that's
 * no substitute for "everything I sold recently regardless of who bought
 * it". No "change customer" endpoint (removed from the plan entirely — see
 * DATABASE.md, "Accounts receivable": no sale can ever legally reach a state
 * where that would be valid). Every route here requires auth. See app.ts.
 */
const salesRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.post(
    '/sales',
    {
      schema: { tags: ['sales'], body: createSaleInputSchema, response: { 201: saleResponseSchema } },
    },
    controller.createSaleHandler,
  );

  fastify.get(
    '/sales',
    {
      schema: { tags: ['sales'], querystring: listSalesQuerySchema, response: { 200: saleListResponseSchema } },
    },
    controller.listSalesHandler,
  );

  fastify.get(
    '/sales/:id',
    {
      schema: { tags: ['sales'], params: saleParamsSchema, response: { 200: saleResponseSchema } },
    },
    controller.getSaleHandler,
  );

  fastify.post(
    '/sales/:id/cancel',
    {
      schema: { tags: ['sales'], params: saleParamsSchema, response: { 200: saleResponseSchema } },
    },
    controller.cancelSaleHandler,
  );
};

export default salesRoutes;
