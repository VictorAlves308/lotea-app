import { asyncStoragePersister } from './persister';
import { queryClient } from './query-client';
import { clearAuthTokens } from './storage';

/**
 * Full session teardown: auth tokens, the in-memory React Query cache, and
 * its AsyncStorage-persisted copy. Every path that ends a session — manual
 * logout and the automatic one when a refresh attempt fails — must call this
 * together, so another user picking up the same device next never sees the
 * previous seller's cached sales/customers, even offline.
 */
export async function clearSession(): Promise<void> {
  await clearAuthTokens();
  queryClient.clear();
  await asyncStoragePersister.removeClient();
}
