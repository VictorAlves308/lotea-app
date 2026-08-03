import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

import authRoutes from './features/auth/auth.routes';
import catalogRoutes from './features/catalog/catalog.routes';
import customersRoutes from './features/customers/customers.routes';
import dashboardRoutes from './features/dashboard/dashboard.routes';
import inventoryRoutes from './features/inventory/inventory.routes';
import lotsRoutes from './features/lots/lots.routes';
import productsRoutes from './features/products/products.routes';
import salesRoutes from './features/sales/sales.routes';
import authenticatePlugin from './plugins/authenticate';
import corsPlugin from './plugins/cors';
import errorHandlerPlugin from './plugins/error-handler';
import openapiPlugin from './plugins/openapi';
import prismaPlugin from './plugins/prisma';
import rateLimitPlugin from './plugins/rate-limit';
import securityHeadersPlugin from './plugins/security-headers';
import sensiblePlugin from './plugins/sensible';
import { loggerOptions } from './shared/lib/logger';

export function buildApp() {
  const app = Fastify({ logger: loggerOptions });

  // Every route's Zod schema is both a validator (incoming request) and a
  // serializer (outgoing response) — see fastify-type-provider-zod. Must be
  // set before any route registers.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(corsPlugin);
  app.register(securityHeadersPlugin);
  app.register(sensiblePlugin);
  app.register(errorHandlerPlugin);
  app.register(prismaPlugin);
  app.register(rateLimitPlugin);
  app.register(authenticatePlugin);
  app.register(openapiPlugin);

  app.register(authRoutes);
  app.register(catalogRoutes);
  app.register(customersRoutes);
  app.register(dashboardRoutes);
  app.register(lotsRoutes);
  app.register(productsRoutes);
  app.register(inventoryRoutes);
  app.register(salesRoutes);

  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
