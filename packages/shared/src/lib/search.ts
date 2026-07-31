// Built from numeric code points (rather than a regex literal) so the source
// file never has to embed an actual combining-diacritic character, which is
// easy to mis-copy/mis-render. This is the Unicode "Combining Diacritical
// Marks" block (U+0300-U+036F) that NFD decomposition splits accents into.
const COMBINING_DIACRITICS_PATTERN = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  'g',
);

/**
 * Normalizes text for typo-tolerant, accent-insensitive product search:
 * strips accents/diacritics, lowercases, and collapses whitespace. Used both
 * to build Product.searchTerms on write and to normalize the user's query on
 * read, so they compare on equal footing. See DATABASE.md, "Product catalog
 * search".
 */
export function normalizeSearchText(input: string): string {
  return input
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS_PATTERN, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/** Joins non-empty field values into one space-separated string and normalizes the result. */
function joinAndNormalize(values: Array<string | null | undefined>): string {
  return normalizeSearchText(
    values.filter((value): value is string => Boolean(value && value.trim())).join(' '),
  );
}

/** Builds the single normalized blob searched across name/brand/category/sku/volume/variant. */
export function buildProductSearchTerms(fields: {
  name: string;
  brand?: string | null;
  category?: string | null;
  sku?: string | null;
  volume?: string | null;
  variant?: string | null;
}): string {
  return joinAndNormalize([
    fields.name,
    fields.brand,
    fields.category,
    fields.sku,
    fields.volume,
    fields.variant,
  ]);
}

/**
 * Builds the normalized search blob for a global CatalogProduct entry — name,
 * brand, category, volume only (no sku/variant, which CatalogProduct doesn't
 * have; no description, which is presentational, not searchable — matches
 * `notes` being excluded from Product's own searchTerms). See DATABASE.md,
 * "Global product catalog".
 */
export function buildCatalogProductSearchTerms(fields: {
  name: string;
  brand?: string | null;
  category?: string | null;
  volume?: string | null;
}): string {
  return joinAndNormalize([fields.name, fields.brand, fields.category, fields.volume]);
}
