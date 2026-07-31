import type { CreateLotInput, Lot, RegisterEntryInput, RegisterEntrySummary } from '@lotea/shared';

import { apiClient } from '../../shared/lib/api-client';

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export function listLots(params: { limit?: number } = {}): Promise<PaginatedResponse<Lot>> {
  const query = new URLSearchParams();
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiClient.get(`/lots${qs ? `?${qs}` : ''}`);
}

export function createLot(input: CreateLotInput): Promise<Lot> {
  return apiClient.post('/lots', input);
}

export interface LotFinancials {
  itemCount: number;
  soldCount: number;
  totalCost: string;
  revenue: string;
  realizedProfit: string;
  hasRecoveredInvestment: boolean;
  totalReceived: string;
  outstanding: string;
}

export interface LotCustomerBalance {
  customerId: string;
  name: string;
  outstanding: string;
}

export interface LotItem {
  productId: string;
  productName: string;
  acquisitionCost: string;
  quantity: number;
  inStockCount: number;
  soldCount: number;
}

export interface LotDetails {
  lot: Lot;
  financials: LotFinancials;
  customerBalances: LotCustomerBalance[];
  items: LotItem[];
}

export function getLot(id: string): Promise<LotDetails> {
  return apiClient.get(`/lots/${id}`);
}

export function createPurchaseEntry(
  lotId: string,
  input: Omit<RegisterEntryInput, 'lotId'>,
): Promise<RegisterEntrySummary> {
  return apiClient.post(`/lots/${lotId}/inventory-entries`, input);
}
