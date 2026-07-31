import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 60_000,
      gcTime: 24 * 60 * 60 * 1000, // keep a day of cache around for offline reads
    },
  },
});
