import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { searchCatalog } from '../api';

/**
 * Backs the "novo produto" name field's autocomplete — global CatalogProduct
 * (Natura/Avon/etc.), not the user's own products. `limit: 4`, deliberately
 * small: this is meant to surface a handful of close matches, not flood the
 * dropdown with loosely-related results for a product that genuinely isn't
 * in the catalog yet — the "cadastrar como produto novo" row always stays
 * visible alongside these, however many come back (see produtos/novo.tsx).
 */
export function useCatalogSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['catalog', 'search', trimmed],
    queryFn: () => searchCatalog({ query: trimmed, limit: 4 }),
    enabled: trimmed.length >= 2,
    placeholderData: keepPreviousData,
  });
}
