import { useQuery } from '@tanstack/react-query';

import { listLots } from '../api';

/** Distinct from `useLots` (that one bundles create/purchase-entry mutations) — this is the read query for a lot picker. */
export function useLotsList(params: { limit?: number } = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['lots', 'list', params],
    queryFn: () => listLots(params),
    enabled: options?.enabled ?? true,
  });
}
