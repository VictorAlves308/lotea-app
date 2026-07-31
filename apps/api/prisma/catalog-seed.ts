import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { upsertCatalogProducts } from './lib/upsert-catalog-products';
import { PrismaClient } from '../src/generated/prisma/client.ts';

/**
 * Standalone entry point for seeding/updating the global product catalog,
 * independent of the destructive tenant-fixture seed in seed.ts. Safe to run
 * anytime, anywhere (including production) — see upsert-catalog-products.ts.
 */
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

upsertCatalogProducts(prisma)
  .then(() => console.log('Catálogo global atualizado.'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
