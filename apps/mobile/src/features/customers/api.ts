import type {
  Customer,
  CustomerDetail,
  CustomerListItem,
  CustomerPayment,
  CreateCustomerInput,
  CustomerStatementLine,
  CustomerSuggestion,
  ReceivablesSummary,
  RegisterPaymentInput,
} from '@lotea/shared';

import { apiClient } from '../../shared/lib/api-client';

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface ListCustomersParams {
  page?: number;
  limit?: number;
  sort?: 'name' | 'balance' | 'recent';
  hasBalance?: boolean;
}

export function listCustomers(params: ListCustomersParams = {}): Promise<PaginatedResponse<CustomerListItem>> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.sort) query.set('sort', params.sort);
  if (params.hasBalance !== undefined) query.set('hasBalance', String(params.hasBalance));
  const qs = query.toString();
  return apiClient.get(`/customers${qs ? `?${qs}` : ''}`);
}

export function getCustomer(id: string): Promise<CustomerDetail> {
  return apiClient.get(`/customers/${id}`);
}

export function getCustomerStatement(id: string): Promise<{ items: CustomerStatementLine[] }> {
  return apiClient.get(`/customers/${id}/statement`);
}

export function getReceivablesSummary(): Promise<ReceivablesSummary> {
  return apiClient.get('/customers/receivables-summary');
}

export function registerPayment(customerId: string, input: RegisterPaymentInput): Promise<CustomerPayment> {
  return apiClient.post(`/customers/${customerId}/payments`, input);
}

export type CreateCustomerResult =
  | { status: 'created'; customer: Customer }
  | { status: 'duplicates'; duplicateCandidates: CustomerSuggestion[] };

/**
 * The API answers 201 (created) or 200 (name looks like an existing
 * customer — nothing created yet, here are the candidates). Pass
 * `confirmDuplicate: true` on a second call once the user has seen the
 * candidates and wants to create anyway.
 */
export async function createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult> {
  const { status, data } = await apiClient.postWithStatus<
    Customer | { duplicateCandidates: CustomerSuggestion[] }
  >('/customers', input);

  if (status === 201) {
    return { status: 'created', customer: data as Customer };
  }
  return { status: 'duplicates', duplicateCandidates: (data as { duplicateCandidates: CustomerSuggestion[] }).duplicateCandidates };
}
