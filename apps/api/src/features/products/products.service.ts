import { buildProductSearchTerms, normalizeSearchText } from '@lotea/shared';

import type { Prisma, Product } from '../../generated/prisma/client';
import { NotFoundError } from '../../shared/errors/app-error';
import * as catalogService from '../catalog/catalog.service';
import * as productsRepository from './products.repository';
import type { TopBrandRow, TopProductRow } from './products.repository';

type PrismaOrTx = Prisma.TransactionClient;

export interface CreateProductParams {
  userId: string;
  actingUserId: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  sku?: string | null;
  volume?: string | null;
  variant?: string | null;
  notes?: string | null;
  defaultSalePrice?: string | null;
  minStockAlert?: number | null;
  /** Copied once from the picked CatalogProduct — see schema.prisma's Product.imageUrl comment. */
  imageUrl?: string | null;
  /** Provenance only — see schema.prisma's Product.catalogProductId comment. */
  catalogProductId?: string | null;
}

/**
 * Creates a catalog Product, computing `searchTerms` from name/brand/
 * category/sku/volume/variant. Does not block on similar existing products
 * — that's a UX decision made by calling `searchProducts` first and letting
 * the user choose "usar produto existente" vs. "cadastrar novo produto". See
 * DATABASE.md, "Product catalog search".
 */
export async function createProduct(db: PrismaOrTx, params: CreateProductParams): Promise<Product> {
  const searchTerms = buildProductSearchTerms(params);
  return productsRepository.createProduct(db, { ...params, searchTerms });
}

/**
 * Typo-tolerant, accent-insensitive autocomplete search across name, brand,
 * category, sku, volume, and variant. The same function backs both
 * "as-you-type" suggestions and the "check for duplicates before creating"
 * flow — both are just this search called at a different moment in the UX.
 */
export async function searchProducts(
  db: PrismaOrTx,
  params: { userId: string; query: string; limit?: number },
): Promise<Product[]> {
  const normalizedQuery = normalizeSearchText(params.query);
  if (!normalizedQuery) return [];

  return productsRepository.searchBySearchTerms(db, {
    userId: params.userId,
    normalizedQuery,
    limit: params.limit ?? 10,
  });
}

/** Derives IN_STOCK/LOW/OUT — never stored, always computed from the live in-stock count vs. the product's own threshold. */
function deriveStockStatus(inStockCount: number, minStockAlert: number | null): 'IN_STOCK' | 'LOW' | 'OUT' {
  if (inStockCount <= 0) return 'OUT';
  if (minStockAlert !== null && inStockCount <= minStockAlert) return 'LOW';
  return 'IN_STOCK';
}

export interface ProductListItemResult {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  volume: string | null;
  defaultSalePrice: string | null;
  imageUrl: string | null;
  inStockCount: number;
  stockStatus: 'IN_STOCK' | 'LOW' | 'OUT';
}

/** The Produtos screen's list — search, brand filter, pagination, plus each product's derived stock status. */
export async function listProducts(
  db: PrismaOrTx,
  params: { userId: string; page: number; limit: number; query?: string; brand?: string },
): Promise<{ items: ProductListItemResult[]; page: number; limit: number; total: number }> {
  const normalizedQuery = params.query ? normalizeSearchText(params.query) : undefined;
  const { items, total } = await productsRepository.listProducts(db, {
    userId: params.userId,
    page: params.page,
    limit: params.limit,
    normalizedQuery: normalizedQuery || undefined,
    brand: params.brand,
  });

  return {
    items: items.map((row) => ({
      id: row.id,
      name: row.name,
      brand: row.brand,
      category: row.category,
      volume: row.volume,
      defaultSalePrice: row.defaultSalePrice,
      imageUrl: row.imageUrl,
      inStockCount: row.inStockCount,
      stockStatus: deriveStockStatus(row.inStockCount, row.minStockAlert),
    })),
    page: params.page,
    limit: params.limit,
    total,
  };
}

/** Brands already used by this tenant — filter pills + the create form's Marca dropdown. */
export async function getBrands(db: PrismaOrTx, params: { userId: string }): Promise<string[]> {
  return productsRepository.listDistinctBrands(db, params);
}

export async function getProductById(
  db: PrismaOrTx,
  params: { id: string; userId: string },
): Promise<Product | null> {
  return productsRepository.findById(db, params);
}

export interface UpdateProductParams {
  id: string;
  userId: string;
  actingUserId: string;
  name?: string;
  brand?: string | null;
  category?: string | null;
  sku?: string | null;
  volume?: string | null;
  variant?: string | null;
  notes?: string | null;
  defaultSalePrice?: string;
  minStockAlert?: number;
}

/**
 * Recomputes `searchTerms` only when an identity field (name/brand/category/
 * sku/volume/variant) actually changed — a price-only or alert-only edit
 * shouldn't pay for a rebuild. When it does change, the blob is built from
 * the full merged set (existing values for anything not in this call), since
 * `buildProductSearchTerms` needs every field, not just the delta.
 */
export async function updateProduct(db: PrismaOrTx, params: UpdateProductParams): Promise<Product> {
  const existing = await productsRepository.findById(db, { id: params.id, userId: params.userId });
  if (!existing) {
    throw new NotFoundError(`Product ${params.id} not found`);
  }

  const identityFieldChanged = [
    params.name,
    params.brand,
    params.category,
    params.sku,
    params.volume,
    params.variant,
  ].some((value) => value !== undefined);

  const searchTerms = identityFieldChanged
    ? buildProductSearchTerms({
        name: params.name !== undefined ? params.name : existing.name,
        brand: params.brand !== undefined ? params.brand : existing.brand,
        category: params.category !== undefined ? params.category : existing.category,
        sku: params.sku !== undefined ? params.sku : existing.sku,
        volume: params.volume !== undefined ? params.volume : existing.volume,
        variant: params.variant !== undefined ? params.variant : existing.variant,
      })
    : undefined;

  return productsRepository.updateProduct(db, {
    id: params.id,
    actingUserId: params.actingUserId,
    name: params.name,
    brand: params.brand,
    category: params.category,
    sku: params.sku,
    volume: params.volume,
    variant: params.variant,
    notes: params.notes,
    defaultSalePrice: params.defaultSalePrice,
    minStockAlert: params.minStockAlert,
    searchTerms,
  });
}

/** Products recently added to a lot — surfaced first for faster repeated purchase entries. */
export async function getRecentlyUsedProducts(
  db: PrismaOrTx,
  params: { userId: string; limit?: number },
): Promise<Product[]> {
  return productsRepository.findRecentlyUsed(db, {
    userId: params.userId,
    limit: params.limit ?? 10,
  });
}

export interface CreateProductResult {
  created: boolean;
  product?: Product;
  duplicateCandidates?: Product[];
}

/**
 * Input for the route-facing creation flow — either `catalogProductId` (its
 * name/brand/category/volume are resolved from the global catalog; see
 * below) or a manual `name`. Mirrors packages/shared's createProductInputSchema,
 * which enforces the "one or the other" rule at the HTTP boundary — this
 * service-level type stays permissive (both nullable) since that validation
 * already happened by the time a controller calls this.
 */
export type CreateProductWithDuplicateCheckParams = Omit<CreateProductParams, 'name'> & {
  name?: string | null;
  confirmDuplicate: boolean;
};

/**
 * The route-facing creation flow: unless the caller has already reviewed
 * candidates and set `confirmDuplicate`, this searches for similar existing
 * products first and, if any are found, returns them instead of creating —
 * the "Cadastrar novo produto" confirmation step from PRODUCT.md. Plain
 * `createProduct` (above) stays available, unconditional, for callers that
 * have already made this decision (the seed script, tests).
 *
 * When `catalogProductId` is set, resolves name/brand/category/volume from
 * the global catalog (via catalogService — the same cross-feature
 * service-to-service read pattern inventory.service.ts uses for
 * productsService) before running the same duplicate-check below. The
 * resulting Product's own fields become the source of truth from creation
 * onward — this resolution never happens again. See DATABASE.md, "Global
 * product catalog".
 */
export async function createProductWithDuplicateCheck(
  db: PrismaOrTx,
  params: CreateProductWithDuplicateCheckParams,
): Promise<CreateProductResult> {
  let resolved: CreateProductParams;

  if (params.catalogProductId) {
    const catalogProduct = await catalogService.getActiveCatalogProduct(db, {
      id: params.catalogProductId,
    });
    resolved = {
      userId: params.userId,
      actingUserId: params.actingUserId,
      name: catalogProduct.name,
      brand: catalogProduct.brand,
      category: catalogProduct.category,
      volume: catalogProduct.volume || null,
      sku: params.sku ?? null,
      variant: params.variant ?? null,
      notes: params.notes ?? null,
      defaultSalePrice: params.defaultSalePrice ?? null,
      minStockAlert: params.minStockAlert ?? null,
      imageUrl: catalogProduct.imageUrl,
      catalogProductId: catalogProduct.id,
    };
  } else {
    // packages/shared's createProductInputSchema guarantees `name` is
    // present whenever catalogProductId is absent.
    resolved = { ...params, name: params.name as string, catalogProductId: null };
  }

  if (!params.confirmDuplicate) {
    const candidates = await searchProducts(db, {
      userId: resolved.userId,
      query: resolved.name,
      limit: 5,
    });
    if (candidates.length > 0) {
      return { created: false, duplicateCandidates: candidates };
    }
  }

  const product = await createProduct(db, resolved);
  return { created: true, product };
}

// --- Dashboard aggregates — called only by dashboard.service.ts. See
// ARCHITECTURE.md §5/§6: kept here rather than in a cross-feature
// dashboard.repository.ts, since the output is product-centric.

export async function getTopSellingProducts(
  db: PrismaOrTx,
  params: { userId: string; from: Date; toExclusive: Date; limit: number },
): Promise<TopProductRow[]> {
  return productsRepository.getTopSellingProducts(db, params);
}

export async function getTopSellingBrands(
  db: PrismaOrTx,
  params: { userId: string; from: Date; toExclusive: Date; limit: number },
): Promise<TopBrandRow[]> {
  return productsRepository.getTopSellingBrands(db, params);
}
