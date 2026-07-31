import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

// Persists the React Query cache so reads (product list, stock levels) survive
// app restarts while offline. See ARCHITECTURE.md §8.
export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'lotea.queryCache',
});
