import 'dotenv/config';

import { defineConfig } from 'prisma/config';

// Prisma 7 moved the connection URL out of schema.prisma — see
// https://pris.ly/d/prisma7-client-config. The Fastify app itself still reads
// DATABASE_URL through src/shared/lib/env.ts; this file is only consumed by
// the Prisma CLI (generate/migrate).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
