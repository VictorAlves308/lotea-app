import { useQuery } from '@tanstack/react-query';

import { listCustomers, type ListCustomersParams } from '../api';

export function useCustomers(params: ListCustomersParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['customers', 'list', params],
    queryFn: () => listCustomers(params),
    enabled: options?.enabled ?? true,
  });
}
