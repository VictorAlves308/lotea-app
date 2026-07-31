import type { Customer, ProductListItem } from '@lotea/shared';
import type { QueryClient } from '@tanstack/react-query';

/**
 * A transient, one-shot channel for "create X elsewhere, then auto-select it
 * back on this screen" flows — e.g. Nova Venda's "+ Cadastrar novo
 * cliente/produto" shortcuts. Piggybacks on the app-wide QueryClient (both
 * screens already share it) instead of threading return values through
 * router params, so it works regardless of which screen opened the creation
 * flow. Each `consume*` call clears the slot — it's read exactly once.
 */
const PENDING_CUSTOMER_KEY = ['pendingSelection', 'customer'] as const;
const PENDING_PRODUCT_KEY = ['pendingSelection', 'product'] as const;

export function setPendingCustomerSelection(queryClient: QueryClient, customer: Customer): void {
  queryClient.setQueryData(PENDING_CUSTOMER_KEY, customer);
}

export function consumePendingCustomerSelection(queryClient: QueryClient): Customer | undefined {
  const customer = queryClient.getQueryData<Customer>(PENDING_CUSTOMER_KEY);
  if (customer) {
    queryClient.removeQueries({ queryKey: PENDING_CUSTOMER_KEY, exact: true });
  }
  return customer;
}

export function setPendingProductSelection(queryClient: QueryClient, product: ProductListItem): void {
  queryClient.setQueryData(PENDING_PRODUCT_KEY, product);
}

export function consumePendingProductSelection(queryClient: QueryClient): ProductListItem | undefined {
  const product = queryClient.getQueryData<ProductListItem>(PENDING_PRODUCT_KEY);
  if (product) {
    queryClient.removeQueries({ queryKey: PENDING_PRODUCT_KEY, exact: true });
  }
  return product;
}
