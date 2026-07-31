import type { CatalogProductSuggestion } from '@lotea/shared';

import { apiClient } from '../../shared/lib/api-client';

export function searchCatalog(params: { query: string; limit?: number }): Promise<{ items: CatalogProductSuggestion[] }> {
  const search = new URLSearchParams({ query: params.query });
  if (params.limit) search.set('limit', String(params.limit));
  return apiClient.get(`/catalog/search?${search.toString()}`);
}
