import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';

/**
 * OpenAPI spec generated directly from the same Zod schemas that validate
 * every route (`fastify-type-provider-zod`'s `jsonSchemaTransform`) — one
 * source of truth, never hand-maintained separately. Spec at
 * `/documentation/json`, browsable UI at `/documentation`.
 */
const openapiPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Lotea API',
        description: 'Inventory, sales, and profit tracking for direct-sales resellers.',
        version: '0.1.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
    transform: jsonSchemaTransform,
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/documentation',
  });
};

export default fp(openapiPlugin, { name: 'openapi' });
