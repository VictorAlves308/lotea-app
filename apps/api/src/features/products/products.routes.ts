import {
  createProductInputSchema,
  listProductsQuerySchema,
  searchProductsInputSchema,
  updateProductInputSchema,
} from '@lotea/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import {
  availableInventoryQuerySchema,
  availableInventoryResponseSchema,
  duplicateCandidatesResponseSchema,
  productBrandsResponseSchema,
  productListResponseSchema,
  productParamsSchema,
  productResponseSchema,
  recentProductsQuerySchema,
  suggestionListResponseSchema,
} from './products.schemas';
import { rateLimitConfig } from '../../shared/lib/rate-limit-config';
import * as controller from './products.controller';

/** Every route here requires auth. See app.ts. */
const productsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get(
    '/products/search',
    {
      schema: {
        tags: ['products'],
        querystring: searchProductsInputSchema,
        response: { 200: suggestionListResponseSchema },
      },
      // Generous — this is meant to fire on every keystroke of an autocomplete
      // box — but still bounded, per requirement 6.
      config: { rateLimit: rateLimitConfig(60, '1 minute') },
    },
    controller.searchProductsHandler,
  );

  fastify.get(
    '/products/recent',
    {
      schema: {
        tags: ['products'],
        querystring: recentProductsQuerySchema,
        response: { 200: suggestionListResponseSchema },
      },
    },
    controller.recentProductsHandler,
  );

  fastify.get(
    '/products/brands',
    {
      schema: {
        tags: ['products'],
        response: { 200: productBrandsResponseSchema },
      },
    },
    controller.getBrandsHandler,
  );

  fastify.get(
    '/products',
    {
      schema: {
        tags: ['products'],
        querystring: listProductsQuerySchema,
        response: { 200: productListResponseSchema },
      },
    },
    controller.listProductsHandler,
  );

  fastify.post(
    '/products',
    {
      schema: {
        tags: ['products'],
        body: createProductInputSchema,
        response: { 200: duplicateCandidatesResponseSchema, 201: productResponseSchema },
      },
    },
    controller.createProductHandler,
  );

  fastify.get(
    '/products/:id',
    {
      schema: {
        tags: ['products'],
        params: productParamsSchema,
        response: { 200: productResponseSchema },
      },
    },
    controller.getProductHandler,
  );

  fastify.patch(
    '/products/:id',
    {
      schema: {
        tags: ['products'],
        params: productParamsSchema,
        body: updateProductInputSchema,
        response: { 200: productResponseSchema },
      },
    },
    controller.updateProductHandler,
  );

  fastify.get(
    '/products/:id/available-inventory',
    {
      schema: {
        tags: ['products'],
        params: productParamsSchema,
        querystring: availableInventoryQuerySchema,
        response: { 200: availableInventoryResponseSchema },
      },
    },
    controller.getAvailableInventoryHandler,
  );
};

export default productsRoutes;
