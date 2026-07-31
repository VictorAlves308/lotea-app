import { useQuery } from '@tanstack/react-query';

import { getProduct } from '../api';

export function useProduct(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['products', 'detail', id],
    queryFn: () => getProduct(id),
    enabled: options?.enabled ?? true,
  });
}
