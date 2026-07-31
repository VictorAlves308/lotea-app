import type { CreateSaleInput, Sale, SaleListItem, SaleStatus } from '@lotea/shared';

import { apiClient } from '../../shared/lib/api-client';

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface ListSalesParams {
  page?: number;
  limit?: number;
  status?: SaleStatus;
}

export function listSales(params: ListSalesParams = {}): Promise<PaginatedResponse<SaleListItem>> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.status) query.set('status', params.status);
  const qs = query.toString();
  return apiClient.get(`/sales${qs ? `?${qs}` : ''}`);
}

export function createSale(input: CreateSaleInput): Promise<Sale> {
  return apiClient.post('/sales', input);
}

export function getSale(id: string): Promise<Sale> {
  return apiClient.get(`/sales/${id}`);
}
