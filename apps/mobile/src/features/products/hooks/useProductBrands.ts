import { useQuery } from '@tanstack/react-query';

import { getProductBrands } from '../api';

export function useProductBrands(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['products', 'brands'],
    queryFn: getProductBrands,
    enabled: options?.enabled ?? true,
  });
}
