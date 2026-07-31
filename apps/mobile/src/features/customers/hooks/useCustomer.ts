import { useQuery } from '@tanstack/react-query';

import { getCustomer, getCustomerStatement } from '../api';

export function useCustomer(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['customers', 'detail', id],
    queryFn: () => getCustomer(id),
    enabled: options?.enabled ?? true,
  });
}

export function useCustomerStatement(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['customers', 'statement', id],
    queryFn: () => getCustomerStatement(id),
    enabled: options?.enabled ?? true,
  });
}
