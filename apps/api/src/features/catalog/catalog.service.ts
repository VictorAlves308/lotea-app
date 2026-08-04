import { normalizeSearchText } from '@lotea/shared';

import type { CatalogProduct, Prisma } from '../../generated/prisma/client';
import { CatalogProductNotFoundError } from '../../shared/errors/app-error';
import * as catalogRepository from './catalog.repository';

type PrismaOrTx = Prisma.TransactionClient;

/**
 * As-you-type autocomplete over the global catalog. Same normalize-then-
 * search shape as products.service.ts's searchProducts, against a different
 * (non-tenant-scoped) table.
 */
export async function searchCatalog(
  db: PrismaOrTx,
  params: { query: string; limit?: number },
): Promise<CatalogProduct[]> {
  const normalizedQuery = normalizeSearchText(params.query);
  if (!normalizedQuery) return [];

  return catalogRepository.searchCatalogProducts(db, {
    normalizedQuery,
    limit: params.limit ?? 10,
  });
}

/**
 * Fetch-or-throw for a specific catalog entry, used both by GET /catalog/:id
 * and by products.service.ts when creating a Product from a catalogProductId
 * — the sanctioned cross-feature service-to-service read (see
 * inventory.service.ts -> productsService for the same pattern).
 */
export async function getActiveCatalogProduct(
  db: PrismaOrTx,
  params: { id: string },
): Promise<CatalogProduct> {
  const catalogProduct = await catalogRepository.findActiveById(db, params);
  if (!catalogProduct) {
    throw new CatalogProductNotFoundError();
  }
  return catalogProduct;
}
