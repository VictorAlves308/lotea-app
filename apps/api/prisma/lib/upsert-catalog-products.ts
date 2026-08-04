import { buildCatalogProductSearchTerms, generateId } from '@lotea/shared';

import { CATALOG_SEED_DATA } from '../catalog-seed-data';
import type { PrismaClient } from '../../src/generated/prisma/client';

/**
 * Upserts every entry in CATALOG_SEED_DATA on its (brand, name, volume)
 * natural key — genuinely idempotent, safe to call repeatedly in any
 * environment (including production), unlike the destructive tenant-fixture
 * seed in seed.ts. Editing an entry's category/description and re-running
 * updates the existing row in place instead of creating a duplicate. See
 * DATABASE.md, "Global product catalog".
 */
export async function upsertCatalogProducts(prisma: PrismaClient): Promise<void> {
  for (const entry of CATALOG_SEED_DATA) {
    const volume = entry.volume ?? '';
    const category = entry.category ?? null;
    const description = entry.description ?? null;
    const searchTerms = buildCatalogProductSearchTerms({
      name: entry.name,
      brand: entry.brand,
      category,
      volume,
    });

    await prisma.catalogProduct.upsert({
      where: { brand_name_volume: { brand: entry.brand, name: entry.name, volume } },
      update: { category, description, searchTerms, active: true },
      create: {
        id: generateId(),
        brand: entry.brand,
        name: entry.name,
        category,
        volume,
        description,
        searchTerms,
      },
    });
  }
}
