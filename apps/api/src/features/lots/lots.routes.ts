import {
  createLotInputSchema,
  paginationQuerySchema,
  updateLotInputSchema,
  updateLotStatusInputSchema,
} from '@lotea/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import * as controller from './lots.controller';
import {
  lotDetailsResponseSchema,
  lotListResponseSchema,
  lotParamsSchema,
  lotResponseSchema,
} from './lots.schemas';

/** Every route here requires auth — registered under a plugin scope with `fastify.authenticate` as a global preHandler. See app.ts. */
const lotsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.post(
    '/lots',
    {
      schema: { tags: ['lots'], body: createLotInputSchema, response: { 201: lotResponseSchema } },
    },
    controller.createLotHandler,
  );

  fastify.get(
    '/lots',
    {
      schema: {
        tags: ['lots'],
        querystring: paginationQuerySchema,
        response: { 200: lotListResponseSchema },
      },
    },
    controller.listLotsHandler,
  );

  fastify.get(
    '/lots/:id',
    {
      schema: {
        tags: ['lots'],
        params: lotParamsSchema,
        response: { 200: lotDetailsResponseSchema },
      },
    },
    controller.getLotHandler,
  );

  fastify.patch(
    '/lots/:id',
    {
      schema: {
        tags: ['lots'],
        params: lotParamsSchema,
        body: updateLotInputSchema,
        response: { 200: lotResponseSchema },
      },
    },
    controller.updateLotHandler,
  );

  fastify.patch(
    '/lots/:id/status',
    {
      schema: {
        tags: ['lots'],
        params: lotParamsSchema,
        body: updateLotStatusInputSchema,
        response: { 200: lotResponseSchema },
      },
    },
    controller.updateLotStatusHandler,
  );
};

export default lotsRoutes;
