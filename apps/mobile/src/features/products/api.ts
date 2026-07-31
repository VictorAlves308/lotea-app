import type {
  AvailableInventoryResponse,
  CreateProductInput,
  Product,
  ProductListItem,
  ProductSuggestion,
  UpdateProductInput,
} from '@lotea/shared';

import { apiClient } from '../../shared/lib/api-client';

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface ListProductsParams {
  page?: number;
  limit?: number;
  query?: string;
  brand?: string;
}

export function listProducts(params: ListProductsParams = {}): Promise<PaginatedResponse<ProductListItem>> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.query) query.set('query', params.query);
  if (params.brand) query.set('brand', params.brand);
  const qs = query.toString();
  return apiClient.get(`/products${qs ? `?${qs}` : ''}`);
}

export function getProductBrands(): Promise<{ brands: string[] }> {
  return apiClient.get('/products/brands');
}

export function getProduct(id: string): Promise<Product> {
  return apiClient.get(`/products/${id}`);
}

export function updateProduct(id: string, input: UpdateProductInput): Promise<Product> {
  return apiClient.patch(`/products/${id}`, input);
}

export function getAvailableInventory(productId: string, limit = 20): Promise<AvailableInventoryResponse> {
  return apiClient.get(`/products/${productId}/available-inventory?limit=${limit}`);
}

export type CreateProductResult =
  | { status: 'created'; product: Product }
  | { status: 'duplicates'; duplicateCandidates: ProductSuggestion[] };

/** Same 201-vs-200 duplicate-candidate protocol as customers — see features/customers/api.ts. */
export async function createProduct(input: CreateProductInput): Promise<CreateProductResult> {
  const { status, data } = await apiClient.postWithStatus<Product | { duplicateCandidates: ProductSuggestion[] }>(
    '/products',
    input,
  );

  if (status === 201) {
    return { status: 'created', product: data as Product };
  }
  return { status: 'duplicates', duplicateCandidates: (data as { duplicateCandidates: ProductSuggestion[] }).duplicateCandidates };
}
