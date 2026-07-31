import { useQuery } from '@tanstack/react-query';

import { getLot } from '../api';

export function useLot(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['lots', 'detail', id],
    queryFn: () => getLot(id),
    enabled: options?.enabled ?? true,
  });
}
