import type { Status } from '../components/StatusBadge';

/** Maps the backend's derived `ProductStockStatus` to `StatusBadge`'s status key. */
export function productStockStatusToBadge(status: string): Status {
  switch (status) {
    case 'LOW':
      return 'lowStock';
    case 'OUT':
      return 'outOfStock';
    case 'IN_STOCK':
    default:
      return 'inStock';
  }
}
