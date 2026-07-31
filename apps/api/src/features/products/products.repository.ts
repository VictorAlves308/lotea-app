import { generateId } from '@lotea/shared';

import { Prisma } from '../../generated/prisma/client.ts';
import type { Product } from '../../generated/prisma/client.ts';

type Db = Prisma.TransactionClient;

export async function createProduct(
  db: Db,
  params: {
    userId: string;
    name: string;
    brand?: string | null;
    category?: string | null;
    sku?: string | null;
    volume?: string | null;
    variant?: string | null;
    notes?: string | null;
    defaultSalePrice?: string | null;
    minStockAlert?: number | null;
    imageUrl?: string | null;
    searchTerms: string;
    actingUserId: string;
    /** Provenance only — see schema.prisma's Product.catalogProductId comment. */
    catalogProductId?: string | null;
  },
): Promise<Product> {
  return db.product.create({
    data: {
      id: generateId(),
      userId: params.userId,
      name: params.name,
      brand: params.brand ?? null,
      category: params.category ?? null,
      sku: params.sku ?? null,
      volume: params.volume ?? null,
      variant: params.variant ?? null,
      notes: params.notes ?? null,
      defaultSalePrice: params.defaultSalePrice ?? null,
      minStockAlert: params.minStockAlert ?? null,
      imageUrl: params.imageUrl ?? null,
      searchTerms: params.searchTerms,
      catalogProductId: params.catalogProductId ?? null,
      createdBy: params.actingUserId,
      updatedBy: params.actingUserId,
    },
  });
}

/** Always scoped by userId — see ARCHITECTURE.md's tenant-isolation rule. */
export async function findById(
  db: Db,
  params: { id: string; userId: string },
): Promise<Product | null> {
  return db.product.findFirst({ where: { id: params.id, userId: params.userId, deletedAt: null } });
}

/**
 * Prisma treats an `undefined` field as "leave unchanged" and an explicit
 * `null` as "clear it" — exactly the distinction `updateProductInputSchema`'s
 * `.nullish()` fields already carry, so params pass straight through with no
 * translation needed. `searchTerms` is only ever passed when the caller (the
 * service layer) has determined an identity field actually changed.
 */
export async function updateProduct(
  db: Db,
  params: {
    id: string;
    name?: string;
    brand?: string | null;
    category?: string | null;
    sku?: string | null;
    volume?: string | null;
    variant?: string | null;
    notes?: string | null;
    defaultSalePrice?: string;
    minStockAlert?: number;
    searchTerms?: string;
    actingUserId: string;
  },
): Promise<Product> {
  return db.product.update({
    where: { id: params.id },
    data: {
      name: params.name,
      brand: params.brand,
      category: params.category,
      sku: params.sku,
      volume: params.volume,
      variant: params.variant,
      notes: params.notes,
      defaultSalePrice: params.defaultSalePrice,
      minStockAlert: params.minStockAlert,
      searchTerms: params.searchTerms,
      updatedBy: params.actingUserId,
    },
  });
}

/**
 * "Recently used" means recently added to a lot (a real InventoryItem
 * created for it), not recently created as a catalog entry — that's what
 * actually speeds up repeated purchase-entry data entry. Grouping
 * InventoryItem by productId and ordering by its most recent creation gives
 * exactly that, without needing a separate "last used" column to keep in
 * sync on Product itself.
 */
export async function findRecentlyUsed(
  db: Db,
  params: { userId: string; limit: number },
): Promise<Product[]> {
  const recentUsage = await db.inventoryItem.groupBy({
    by: ['productId'],
    where: { userId: params.userId },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: 'desc' } },
    take: params.limit,
  });

  if (recentUsage.length === 0) return [];

  const products = await db.product.findMany({
    where: { id: { in: recentUsage.map((usage) => usage.productId) }, deletedAt: null },
  });
  const productsById = new Map(products.map((product) => [product.id, product]));

  // Re-order to match recency — findMany's `in` filter doesn't preserve order.
  return recentUsage
    .map((usage) => productsById.get(usage.productId))
    .filter((product): product is Product => product !== undefined);
}

/**
 * Typo-tolerant, accent-insensitive, partial-term catalog search. Uses
 * pg_trgm's `word_similarity` rather than plain `similarity`: `searchTerms`
 * concatenates every searchable field into one blob, so a short single-word
 * query (or a typo of one) would score low against the *whole* blob under
 * plain similarity — word_similarity instead scores the query against its
 * best-matching substring within the blob, which is what "tolerate small
 * spelling mistakes and partial terms" actually requires. Combined with an
 * ILIKE fallback for very short partial terms. Both are accelerated by the
 * same GIN trigram index (gin_trgm_ops supports similarity, word_similarity,
 * and ILIKE alike). `normalizedQuery` must already be produced by
 * `normalizeSearchText` from packages/shared — this function does not
 * normalize it itself. See DATABASE.md, "Product catalog search".
 */
export interface TopProductRow {
  productId: string;
  name: string;
  brand: string | null;
  quantity: number;
  revenue: string;
}

/**
 * Top-selling products in the period, by revenue — a dashboard aggregate.
 * See ARCHITECTURE.md §6/§5: lives here (not in a dashboard.repository.ts)
 * because the *output* is product-centric, mirroring how
 * inventory.repository.ts already reads through Sale/SaleItem for lot
 * financials. Filters by SaleItem's own `createdAt` (not a join to Sale) —
 * cancelled-sale items are already excluded via `voidedAt IS NULL`, the same
 * filter every other revenue-facing query in this codebase uses, so no join
 * to Sale is needed at all. Deliberately includes soft-deleted products —
 * historical rankings shouldn't disappear just because a product was later
 * removed from the active catalog.
 */
export async function getTopSellingProducts(
  db: Db,
  params: { userId: string; from: Date; toExclusive: Date; limit: number },
): Promise<TopProductRow[]> {
  return db.$queryRaw<TopProductRow[]>`
    SELECT p.id AS "productId", p.name AS name, p.brand AS brand,
           COUNT(si.id)::int AS quantity,
           SUM(si."salePrice")::text AS revenue
    FROM "SaleItem" si
    JOIN "InventoryItem" ii ON ii.id = si."inventoryItemId"
    JOIN "Product" p ON p.id = ii."productId"
    WHERE si."userId" = ${params.userId}::uuid
      AND si."voidedAt" IS NULL
      AND si."createdAt" >= ${params.from}
      AND si."createdAt" < ${params.toExclusive}
    GROUP BY p.id, p.name, p.brand
    ORDER BY SUM(si."salePrice") DESC
    LIMIT ${params.limit}
  `;
}

export interface TopBrandRow {
  brand: string;
  quantity: number;
  revenue: string;
}

/** Same shape as getTopSellingProducts, grouped by brand — products with no brand set are excluded (nothing meaningful to group them under). */
export async function getTopSellingBrands(
  db: Db,
  params: { userId: string; from: Date; toExclusive: Date; limit: number },
): Promise<TopBrandRow[]> {
  return db.$queryRaw<TopBrandRow[]>`
    SELECT p.brand AS brand,
           COUNT(si.id)::int AS quantity,
           SUM(si."salePrice")::text AS revenue
    FROM "SaleItem" si
    JOIN "InventoryItem" ii ON ii.id = si."inventoryItemId"
    JOIN "Product" p ON p.id = ii."productId"
    WHERE si."userId" = ${params.userId}::uuid
      AND si."voidedAt" IS NULL
      AND p.brand IS NOT NULL
      AND si."createdAt" >= ${params.from}
      AND si."createdAt" < ${params.toExclusive}
    GROUP BY p.brand
    ORDER BY SUM(si."salePrice") DESC
    LIMIT ${params.limit}
  `;
}

export async function searchBySearchTerms(
  db: Db,
  params: { userId: string; normalizedQuery: string; limit: number },
): Promise<Product[]> {
  return db.$queryRaw<Product[]>`
    SELECT *
    FROM "Product"
    WHERE "userId" = ${params.userId}::uuid
      AND "deletedAt" IS NULL
      AND (
        word_similarity(${params.normalizedQuery}, "searchTerms") > 0.4
        OR "searchTerms" ILIKE ${'%' + params.normalizedQuery + '%'}
      )
    ORDER BY word_similarity(${params.normalizedQuery}, "searchTerms") DESC
    LIMIT ${params.limit}
  `;
}

export interface ProductListRow {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  volume: string | null;
  defaultSalePrice: string | null;
  imageUrl: string | null;
  minStockAlert: number | null;
  inStockCount: number;
}

/**
 * The Produtos screen's list — identity + price + a live in-stock count
 * (never a stored quantity, per DATABASE.md). Same conditional-filter,
 * `Prisma.sql`/`Prisma.empty`, base-query-plus-count-query style as
 * customers.repository.ts's `listWithBalance`.
 */
export async function listProducts(
  db: Db,
  params: { userId: string; page: number; limit: number; normalizedQuery?: string; brand?: string },
): Promise<{ items: ProductListRow[]; total: number }> {
  const offset = (params.page - 1) * params.limit;

  const queryFilter = params.normalizedQuery
    ? Prisma.sql`AND (
        word_similarity(${params.normalizedQuery}, p."searchTerms") > 0.4
        OR p."searchTerms" ILIKE ${'%' + params.normalizedQuery + '%'}
      )`
    : Prisma.empty;
  const brandFilter = params.brand ? Prisma.sql`AND p.brand = ${params.brand}` : Prisma.empty;

  const baseFrom = Prisma.sql`
    FROM "Product" p
    LEFT JOIN (
      SELECT "productId", COUNT(*)::int AS count
      FROM "InventoryItem"
      WHERE "userId" = ${params.userId}::uuid AND status = 'IN_STOCK' AND "deletedAt" IS NULL
      GROUP BY "productId"
    ) stock ON stock."productId" = p.id
    WHERE p."userId" = ${params.userId}::uuid AND p."deletedAt" IS NULL
    ${queryFilter}
    ${brandFilter}
  `;

  const [items, countResult] = await Promise.all([
    db.$queryRaw<ProductListRow[]>(Prisma.sql`
      SELECT
        p.id, p.name, p.brand, p.category, p.volume,
        p."defaultSalePrice"::text AS "defaultSalePrice",
        p."imageUrl",
        p."minStockAlert",
        COALESCE(stock.count, 0) AS "inStockCount"
      ${baseFrom}
      ORDER BY p.name ASC
      LIMIT ${params.limit} OFFSET ${offset}
    `),
    db.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      ${baseFrom}
    `),
  ]);

  return { items, total: Number(countResult[0]?.count ?? 0) };
}

/** Brands already used by this tenant — backs the Produtos filter pills and the Marca dropdown on the create form. */
export async function listDistinctBrands(db: Db, params: { userId: string }): Promise<string[]> {
  const rows = await db.$queryRaw<Array<{ brand: string }>>(Prisma.sql`
    SELECT DISTINCT brand
    FROM "Product"
    WHERE "userId" = ${params.userId}::uuid AND "deletedAt" IS NULL AND brand IS NOT NULL
    ORDER BY brand ASC
  `);
  return rows.map((row) => row.brand);
}
