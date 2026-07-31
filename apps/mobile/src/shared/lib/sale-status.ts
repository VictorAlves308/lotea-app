import type { Status } from '../components/StatusBadge';

/** Maps the backend's `SaleStatus` enum to `StatusBadge`'s status key. */
export function saleStatusToBadge(status: string): Status {
  switch (status) {
    case 'PAID':
      return 'paid';
    case 'PARTIALLY_PAID':
      return 'partiallyPaid';
    case 'CANCELLED':
      return 'cancelled';
    case 'REFUNDED':
      return 'refunded';
    case 'PENDING':
    default:
      return 'pending';
  }
}
