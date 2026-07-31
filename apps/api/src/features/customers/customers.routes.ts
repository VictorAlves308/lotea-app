import {
  createCustomerInputSchema,
  listCustomersQuerySchema,
  receivablesSummaryQuerySchema,
  receivablesSummarySchema,
  registerPaymentInputSchema,
  searchCustomersInputSchema,
  updateCustomerInputSchema,
} from '@lotea/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { rateLimitConfig } from '../../shared/lib/rate-limit-config';
import * as controller from './customers.controller';
import {
  customerDetailResponseSchema,
  customerListResponseSchema,
  customerParamsSchema,
  customerResponseSchema,
  duplicateCandidatesResponseSchema,
  paymentParamsSchema,
  paymentResponseSchema,
  statementResponseSchema,
  suggestionListResponseSchema,
} from './customers.schemas';

/** Every route here requires auth. See app.ts. */
const customersRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.post(
    '/customers',
    {
      schema: {
        tags: ['customers'],
        body: createCustomerInputSchema,
        response: { 200: duplicateCandidatesResponseSchema, 201: customerResponseSchema },
      },
    },
    controller.createCustomerHandler,
  );

  fastify.get(
    '/customers/search',
    {
      schema: {
        tags: ['customers'],
        querystring: searchCustomersInputSchema,
        response: { 200: suggestionListResponseSchema },
      },
      // Same budget as /products/search and /catalog/search — meant to fire
      // on every keystroke of an autocomplete box, but still bounded.
      config: { rateLimit: rateLimitConfig(60, '1 minute') },
    },
    controller.searchCustomersHandler,
  );

  fastify.get(
    '/customers/receivables-summary',
    {
      schema: {
        tags: ['customers'],
        querystring: receivablesSummaryQuerySchema,
        response: { 200: receivablesSummarySchema },
      },
    },
    controller.getReceivablesSummaryHandler,
  );

  fastify.get(
    '/customers/:id',
    {
      schema: {
        tags: ['customers'],
        params: customerParamsSchema,
        response: { 200: customerDetailResponseSchema },
      },
    },
    controller.getCustomerHandler,
  );

  fastify.get(
    '/customers',
    {
      schema: {
        tags: ['customers'],
        querystring: listCustomersQuerySchema,
        response: { 200: customerListResponseSchema },
      },
    },
    controller.listCustomersHandler,
  );

  fastify.patch(
    '/customers/:id',
    {
      schema: {
        tags: ['customers'],
        params: customerParamsSchema,
        body: updateCustomerInputSchema,
        response: { 200: customerResponseSchema },
      },
    },
    controller.updateCustomerHandler,
  );

  fastify.get(
    '/customers/:id/statement',
    {
      schema: {
        tags: ['customers'],
        params: customerParamsSchema,
        response: { 200: statementResponseSchema },
      },
    },
    controller.getStatementHandler,
  );

  fastify.post(
    '/customers/:id/payments',
    {
      schema: {
        tags: ['customers'],
        params: customerParamsSchema,
        body: registerPaymentInputSchema,
        response: { 201: paymentResponseSchema },
      },
    },
    controller.registerPaymentHandler,
  );

  fastify.post(
    '/customers/:id/payments/:paymentId/void',
    {
      schema: {
        tags: ['customers'],
        params: paymentParamsSchema,
        response: { 200: paymentResponseSchema },
      },
    },
    controller.voidPaymentHandler,
  );
};

export default customersRoutes;
