import { beforeEach, describe, expect, it } from 'vitest';

import { resetDatabase, testPrisma } from '../src/test/db';
import { CATALOG_SEED_DATA } from './catalog-seed-data';
import { upsertCatalogProducts } from './lib/upsert-catalog-products';

beforeEach(async () => {
  await resetDatabase();
});

// Several hundred sequential upserts (one round-trip per catalog entry, by
// design — see upsert-catalog-products.ts) comfortably exceed vitest's
// default 5s test timeout, especially when a test runs two full passes.
const SEED_TIMEOUT_MS = 60_000;

describe('upsertCatalogProducts', () => {
  it(
    'creates every seed entry exactly once',
    async () => {
      await upsertCatalogProducts(testPrisma);
      const count = await testPrisma.catalogProduct.count();
      expect(count).toBe(CATALOG_SEED_DATA.length);
    },
    SEED_TIMEOUT_MS,
  );

  it(
    'is idempotent — re-running does not create duplicate rows',
    async () => {
      await upsertCatalogProducts(testPrisma);
      const firstRunCount = await testPrisma.catalogProduct.count();

      await upsertCatalogProducts(testPrisma);
      const secondRunCount = await testPrisma.catalogProduct.count();

      expect(secondRunCount).toBe(firstRunCount);
    },
    SEED_TIMEOUT_MS,
  );

  it(
    'updates an existing entry in place instead of duplicating it',
    async () => {
      await upsertCatalogProducts(testPrisma);
      const [firstEntry] = CATALOG_SEED_DATA;
      const before = await testPrisma.catalogProduct.findFirst({
        where: { brand: firstEntry!.brand, name: firstEntry!.name, volume: firstEntry!.volume ?? '' },
      });

      // Simulate an edit to the curated data (a real edit would change
      // catalog-seed-data.ts and re-run the script) by upserting a modified
      // single-entry list directly through the same upsert logic.
      const updatedDescription = 'Descrição atualizada para teste de idempotência.';
      await testPrisma.catalogProduct.upsert({
        where: {
          brand_name_volume: {
            brand: firstEntry!.brand,
            name: firstEntry!.name,
            volume: firstEntry!.volume ?? '',
          },
        },
        update: { description: updatedDescription },
        create: {
          id: before!.id,
          brand: firstEntry!.brand,
          name: firstEntry!.name,
          volume: firstEntry!.volume ?? '',
          searchTerms: before!.searchTerms,
        },
      });

      const totalCount = await testPrisma.catalogProduct.count();
      expect(totalCount).toBe(CATALOG_SEED_DATA.length); // no new row created

      const after = await testPrisma.catalogProduct.findUnique({ where: { id: before!.id } });
      expect(after?.description).toBe(updatedDescription);
    },
    SEED_TIMEOUT_MS,
  );
});
