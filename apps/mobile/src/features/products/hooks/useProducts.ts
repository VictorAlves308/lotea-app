import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { listProducts, type ListProductsParams } from '../api';

export function useProducts(params: ListProductsParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['products', 'list', params],
    queryFn: () => listProducts(params),
    enabled: options?.enabled ?? true,
    // `query` changes on every keystroke, which makes each search a distinct
    // query key — without this, the list would flash to a loading spinner
    // and back between every character typed. Keeping the previous page's
    // results on screen while the new one loads reads as a smooth filter
    // instead of a jumpy one.
    placeholderData: keepPreviousData,
  });
}
