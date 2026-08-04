import type { CatalogProduct, Prisma } from '../../generated/prisma/client';

type Db = Prisma.TransactionClient;

/**
 * Typo-tolerant, accent-insensitive, partial-term search across the global
 * catalog — no userId filter, every authenticated user searches the same
 * rows. Mirrors products.repository.ts's searchBySearchTerms exactly (same
 * word_similarity + ILIKE combination, same GIN trigram index shape), minus
 * tenant scoping. `normalizedQuery` must already be produced by
 * normalizeSearchText from packages/shared. See DATABASE.md, "Global product
 * catalog".
 */
export async function searchCatalogProducts(
  db: Db,
  params: { normalizedQuery: string; limit: number },
): Promise<CatalogProduct[]> {
  return db.$queryRaw<CatalogProduct[]>`
    SELECT *
    FROM "CatalogProduct"
    WHERE "active" = true
      AND (
        word_similarity(${params.normalizedQuery}, "searchTerms") > 0.4
        OR "searchTerms" ILIKE ${'%' + params.normalizedQuery + '%'}
      )
    ORDER BY word_similarity(${params.normalizedQuery}, "searchTerms") DESC
    LIMIT ${params.limit}
  `;
}

/** Deactivated entries are treated as not found — never surfaced to tenants. */
export async function findActiveById(
  db: Db,
  params: { id: string },
): Promise<CatalogProduct | null> {
  return db.catalogProduct.findFirst({ where: { id: params.id, active: true } });
}
