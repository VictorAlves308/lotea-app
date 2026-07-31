import { z } from 'zod';

import { fullAuditFieldsSchema, idSchema, moneySchema } from './common.schema';

/**
 * A Product is the canonical catalog entry — reusable identity only: name,
 * brand, category, SKU, volume, variant. It never carries a cost or price:
 * the same product can be bought at different acquisition costs across
 * different lots, and that cost lives on each InventoryItem instead. See
 * DATABASE.md.
 *
 * `searchTerms` is a normalized (lowercase, accent-stripped) blob of every
 * searchable field, maintained by the service layer on create/update — never
 * user-facing, never a replacement for `name`. It backs the typo-tolerant
 * catalog autocomplete. See DATABASE.md, "Product catalog search".
 */
export const productSchema = z.object({
  id: idSchema,
  userId: idSchema,
  name: z.string().min(1).max(120),
  brand: z.string().max(120).nullable(),
  category: z.string().max(120).nullable(),
  sku: z.string().max(60).nullable(),
  /** e.g. "100ml" — free text, not parsed/validated as a unit. */
  volume: z.string().max(40).nullable(),
  /** e.g. "Masculino", "Feminino", "Infantil" — a product-line variant, distinct from category. */
  variant: z.string().max(60).nullable(),
  notes: z.string().max(2000).nullable(),
  /** Nullable only for products created before this field existed — required going forward, see createProductInputSchema. */
  defaultSalePrice: moneySchema.nullable(),
  /** Alert threshold — "estoque baixo" once in-stock count drops to or below this. */
  minStockAlert: z.number().int().nonnegative().nullable(),
  /** Copied once from the picked CatalogProduct at creation time; null for manually-created products. A URL only, never an upload. */
  imageUrl: z.string().nullable(),
  searchTerms: z.string(),
  /**
   * Provenance only — set once at creation from the CatalogProduct the user
   * picked (null for manually-created products). NEVER re-read for display:
   * this Product's own fields are the source of truth from the moment it's
   * created, even if the catalog entry is later edited or deactivated. See
   * DATABASE.md, "Global product catalog".
   */
  catalogProductId: idSchema.nullable(),
  ...fullAuditFieldsSchema.shape,
});
export type Product = z.infer<typeof productSchema>;

/**
 * User-facing input only — `searchTerms` is derived, never supplied
 * directly. Optional fields may be omitted entirely (not just `null`) since
 * this is what an HTTP request body actually looks like.
 *
 * Two ways to create a Product: pick a `catalogProductId` (its name/brand/
 * category/volume are copied automatically — do not also send those fields
 * manually) or provide `name` manually, with everything else optional.
 * `sku`/`variant`/`notes` are always allowed either way — CatalogProduct
 * doesn't have those fields, so there's no ambiguity to reject there.
 */
export const createProductInputSchema = z
  .object({
    catalogProductId: idSchema.nullish(),
    name: z.string().min(1).max(120).nullish(),
    brand: z.string().max(120).nullish(),
    category: z.string().max(120).nullish(),
    sku: z.string().max(60).nullish(),
    volume: z.string().max(40).nullish(),
    variant: z.string().max(60).nullish(),
    notes: z.string().max(2000).nullish(),
    /** Never set through the create/edit forms — see Product.defaultSalePrice's schema.prisma comment. Sale price is always decided per unit at sale time. */
    defaultSalePrice: moneySchema.nullish(),
    /** Never asked at creation — see Product.minStockAlert's schema.prisma comment. Settable later via editing the product. */
    minStockAlert: z.coerce.number().int().nonnegative().nullish(),
    /**
     * Set once the caller has already seen `searchProducts`'s duplicate
     * candidates and confirmed they want a new product anyway. Defaults to
     * false: by default, creation is blocked and candidates are returned
     * instead. See DATABASE.md, "Product catalog search".
     */
    confirmDuplicate: z.boolean().default(false),
  })
  .refine((data) => Boolean(data.catalogProductId) || Boolean(data.name), {
    message: 'Informe catalogProductId ou name.',
    path: ['name'],
  })
  .refine(
    (data) => !data.catalogProductId || (!data.brand && !data.category && !data.volume),
    {
      message:
        'brand/category/volume vêm do catálogo quando catalogProductId é informado — não os envie manualmente.',
      path: ['catalogProductId'],
    },
  );
export type CreateProductInput = z.infer<typeof createProductInputSchema>;

/**
 * User-facing edit input. `name`/`defaultSalePrice`/`minStockAlert` stay
 * required-if-present (never clearable to null — the app depends on all
 * three being set); `brand`/`category`/`sku`/`volume`/`variant`/`notes` stay
 * nullish, same as creation, since those are legitimately optional.
 * `catalogProductId` is provenance only and never editable — see
 * DATABASE.md, "Global product catalog".
 */
export const updateProductInputSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  brand: z.string().max(120).nullish(),
  category: z.string().max(120).nullish(),
  sku: z.string().max(60).nullish(),
  volume: z.string().max(40).nullish(),
  variant: z.string().max(60).nullish(),
  notes: z.string().max(2000).nullish(),
  defaultSalePrice: moneySchema.optional(),
  minStockAlert: z.coerce.number().int().nonnegative().optional(),
});
export type UpdateProductInput = z.infer<typeof updateProductInputSchema>;

/** Input for the autocomplete/duplicate-check search — a single free-text query. */
export const searchProductsInputSchema = z.object({
  query: z.string().min(1).max(120),
  limit: z.coerce.number().int().positive().max(50).default(10),
});
export type SearchProductsInput = z.infer<typeof searchProductsInputSchema>;

/**
 * The concise shape returned by autocomplete — just enough to tell similar
 * products apart (brand, volume, variant, category) and to fill in the rest
 * of a purchase-entry form once picked. Never the full Product (no
 * searchTerms, no audit fields) — this is what goes over the wire to a
 * mobile autocomplete dropdown, potentially for every keystroke.
 */
export const productSuggestionSchema = z.object({
  id: idSchema,
  name: z.string(),
  brand: z.string().nullable(),
  category: z.string().nullable(),
  sku: z.string().nullable(),
  volume: z.string().nullable(),
  variant: z.string().nullable(),
});
export type ProductSuggestion = z.infer<typeof productSuggestionSchema>;

/**
 * `IN_STOCK`/`LOW`/`OUT` derived from comparing a product's current in-stock
 * `InventoryItem` count against its own `minStockAlert` — never stored,
 * always computed at read time (same "never a stored derived total" rule as
 * everywhere else in this codebase).
 */
export const productStockStatusSchema = z.enum(['IN_STOCK', 'LOW', 'OUT']);
export type ProductStockStatus = z.infer<typeof productStockStatusSchema>;

/** One row of the Produtos list — identity + price + derived stock status, not the full entity. */
export const productListItemSchema = z.object({
  id: idSchema,
  name: z.string(),
  brand: z.string().nullable(),
  category: z.string().nullable(),
  volume: z.string().nullable(),
  defaultSalePrice: moneySchema.nullable(),
  imageUrl: z.string().nullable(),
  inStockCount: z.number().int().nonnegative(),
  stockStatus: productStockStatusSchema,
});
export type ProductListItem = z.infer<typeof productListItemSchema>;

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  /** Typo-tolerant-ish free text — matched against searchTerms, same as /products/search. */
  query: z.string().max(120).optional(),
  /** Exact brand match — backs the filter pills on the Produtos screen. */
  brand: z.string().max(120).optional(),
});
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
