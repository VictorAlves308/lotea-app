import { z } from 'zod';

import { idSchema } from './common.schema';

/**
 * A global, shared reference catalog entry (e.g. "Natura Kaiak Clássico") —
 * identity only, never stock/price/quantity/lote. Not tenant-scoped: every
 * authenticated user sees the same rows. Selecting one when creating a
 * Product copies its fields once; the Product never depends on this entry
 * again afterward. See DATABASE.md, "Global product catalog".
 */
export const catalogProductSchema = z.object({
  id: idSchema,
  brand: z.string().min(1).max(120),
  name: z.string().min(1).max(120),
  category: z.string().max(120).nullable(),
  /** "" (not a nullable field) when not applicable — see DATABASE.md. */
  volume: z.string().max(40),
  description: z.string().max(500).nullable(),
  /** A URL only — never an upload. Typically sourced from an affiliate product data feed (Awin/Rakuten), not scraped. */
  imageUrl: z.string().nullable(),
  active: z.boolean(),
  searchTerms: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type CatalogProduct = z.infer<typeof catalogProductSchema>;

/** Input for the catalog autocomplete search — a single free-text query. */
export const searchCatalogInputSchema = z.object({
  query: z.string().min(1).max(120),
  limit: z.coerce.number().int().positive().max(50).default(10),
});
export type SearchCatalogInput = z.infer<typeof searchCatalogInputSchema>;

/**
 * The concise shape returned by catalog autocomplete — enough to tell
 * similar products apart and decide whether to pick one. Never the full
 * CatalogProduct (no searchTerms, no active/audit fields).
 */
export const catalogProductSuggestionSchema = z.object({
  id: idSchema,
  brand: z.string(),
  name: z.string(),
  category: z.string().nullable(),
  volume: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
});
export type CatalogProductSuggestion = z.infer<typeof catalogProductSuggestionSchema>;
