import { useQuery } from '@tanstack/react-query';

import { listSales, type ListSalesParams } from '../api';

export function useSales(params: ListSalesParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['sales', 'list', params],
    queryFn: () => listSales(params),
    enabled: options?.enabled ?? true,
  });
}
