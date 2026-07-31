import { beforeEach, describe, expect, it } from 'vitest';

import { createTestCatalogProduct, resetDatabase, testPrisma } from '../../test/db';
import { CatalogProductNotFoundError } from '../../shared/errors/app-error';
import * as catalogService from './catalog.service';

beforeEach(async () => {
  await resetDatabase();
});

async function seedCatalog() {
  const kaiakClassico = await createTestCatalogProduct({
    brand: 'Natura',
    name: 'Kaiak Clássico',
    category: 'Perfumaria',
    volume: '100ml',
  });
  const kaiakAero = await createTestCatalogProduct({
    brand: 'Natura',
    name: 'Kaiak Aero',
    category: 'Perfumaria',
    volume: '100ml',
  });
  const malbec = await createTestCatalogProduct({
    brand: 'Boticário',
    name: 'Malbec',
    category: 'Perfumaria',
    volume: '100ml',
  });
  const farAway = await createTestCatalogProduct({
    brand: 'Avon',
    name: 'Far Away',
    category: 'Perfumaria',
    volume: '50ml',
  });
  const siage = await createTestCatalogProduct({
    brand: 'Eudora',
    name: 'Siàge Liso Absoluto',
    category: 'Cuidados com os Cabelos',
    volume: '300ml',
  });
  const essencial = await createTestCatalogProduct({
    brand: 'Natura',
    name: 'Essencial Feminino',
    category: 'Perfumaria',
    volume: '100ml',
  });
  const inactive = await createTestCatalogProduct({
    brand: 'Natura',
    name: 'Linha Descontinuada',
    active: false,
  });
  return { kaiakClassico, kaiakAero, malbec, farAway, siage, essencial, inactive };
}

describe('searchCatalog', () => {
  it('matches by name', async () => {
    await seedCatalog();
    const results = await catalogService.searchCatalog(testPrisma, { query: 'kaiak' });
    expect(results.map((p) => p.name)).toEqual(
      expect.arrayContaining(['Kaiak Clássico', 'Kaiak Aero']),
    );
  });

  it('matches by brand', async () => {
    await seedCatalog();
    const results = await catalogService.searchCatalog(testPrisma, { query: 'boticário' });
    expect(results.map((p) => p.name)).toContain('Malbec');
  });

  it('matches a partial term', async () => {
    await seedCatalog();
    const results = await catalogService.searchCatalog(testPrisma, { query: 'mal' });
    expect(results.map((p) => p.name)).toContain('Malbec');
  });

  it('matches a short partial term via the ILIKE fallback', async () => {
    await seedCatalog();
    const results = await catalogService.searchCatalog(testPrisma, { query: 'ess' });
    expect(results.map((p) => p.name)).toContain('Essencial Feminino');
  });

  it('tolerates a small spelling mistake', async () => {
    await seedCatalog();
    const results = await catalogService.searchCatalog(testPrisma, { query: 'kaiac' });
    expect(results.map((p) => p.name)).toContain('Kaiak Clássico');
  });

  it('ignores accents', async () => {
    await seedCatalog();
    const results = await catalogService.searchCatalog(testPrisma, { query: 'siage' });
    expect(results.map((p) => p.name)).toContain('Siàge Liso Absoluto');
  });

  it('matches "far" against "Far Away"', async () => {
    await seedCatalog();
    const results = await catalogService.searchCatalog(testPrisma, { query: 'far' });
    expect(results.map((p) => p.name)).toContain('Far Away');
  });

  it('returns no results for an unrelated query', async () => {
    await seedCatalog();
    const results = await catalogService.searchCatalog(testPrisma, { query: 'xyzabc123' });
    expect(results).toHaveLength(0);
  });

  it('never returns a deactivated entry', async () => {
    await seedCatalog();
    const results = await catalogService.searchCatalog(testPrisma, { query: 'descontinuada' });
    expect(results).toHaveLength(0);
  });

  it('is identical regardless of which tenant is asking — the catalog is global', async () => {
    await seedCatalog();
    const results = await catalogService.searchCatalog(testPrisma, { query: 'kaiak' });
    // No userId parameter exists on this function at all — nothing to vary per tenant.
    expect(results.length).toBeGreaterThan(0);
  });
});

describe('getActiveCatalogProduct', () => {
  it('returns the entry when active', async () => {
    const { kaiakClassico } = await seedCatalog();
    const result = await catalogService.getActiveCatalogProduct(testPrisma, {
      id: kaiakClassico.id,
    });
    expect(result.id).toBe(kaiakClassico.id);
  });

  it('throws for a deactivated entry', async () => {
    const { inactive } = await seedCatalog();
    await expect(
      catalogService.getActiveCatalogProduct(testPrisma, { id: inactive.id }),
    ).rejects.toThrow(CatalogProductNotFoundError);
  });

  it('throws for an unknown id', async () => {
    await expect(
      catalogService.getActiveCatalogProduct(testPrisma, {
        id: '00000000-0000-7000-8000-000000000000',
      }),
    ).rejects.toThrow(CatalogProductNotFoundError);
  });
});
