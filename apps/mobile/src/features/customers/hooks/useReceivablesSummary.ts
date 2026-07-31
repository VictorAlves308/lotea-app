import { useQuery } from '@tanstack/react-query';

import { getReceivablesSummary } from '../api';

export function useReceivablesSummary(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['customers', 'receivables-summary'],
    queryFn: () => getReceivablesSummary(),
    enabled: options?.enabled ?? true,
  });
}
