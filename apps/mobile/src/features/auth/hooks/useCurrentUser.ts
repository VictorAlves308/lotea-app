import { useQuery } from '@tanstack/react-query';

import { getMe } from '../api';

/**
 * Backs the dashboard's "Oi, {name}" greeting. Reads `GET /auth/me` rather
 * than caching the `user` object `useLogin` gets back, so the name is still
 * correct after a page refresh (web) or cold start, when only the token —
 * not the login response — survived.
 */
export function useCurrentUser(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getMe,
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  });
}
