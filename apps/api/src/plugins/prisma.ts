import { PrismaPg } from '@prisma/adapter-pg';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

// Prisma 7 generates client source into a custom output path rather than
// node_modules/@prisma/client — see prisma/schema.prisma's generator block.
import { PrismaClient } from '../generated/prisma/client.ts';
import { env } from '../shared/lib/env';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

const prismaPlugin: FastifyPluginAsync = async (fastify) => {
  // Prisma 7 requires an explicit driver adapter — there's no more implicit,
  // schema-configured connection. The underlying pg.Pool still connects
  // lazily on first query, so the server can boot (and /health can respond)
  // even before a database is reachable.
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  fastify.decorate('prisma', prisma);
  fastify.addHook('onClose', async (instance) => {
    await instance.prisma.$disconnect();
  });
};

export default fp(prismaPlugin, { name: 'prisma' });
