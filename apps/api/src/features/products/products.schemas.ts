import {
  availableInventoryResponseSchema,
  idSchema,
  paginatedResponseSchema,
  productListItemSchema,
  productSchema,
  productSuggestionSchema,
} from '@lotea/shared';
import { z } from 'zod';

export const productParamsSchema = z.object({ id: idSchema });

export const productResponseSchema = productSchema;
export const productListResponseSchema = paginatedResponseSchema(productListItemSchema);
export const productBrandsResponseSchema = z.object({ brands: z.array(z.string()) });

export const availableInventoryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export { availableInventoryResponseSchema };

export const suggestionListResponseSchema = z.object({
  items: z.array(productSuggestionSchema),
});

/** 200: similar products already exist, nothing was created — see products.service.ts. */
export const duplicateCandidatesResponseSchema = z.object({
  duplicateCandidates: z.array(productSuggestionSchema),
});

export const recentProductsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).default(10),
});
