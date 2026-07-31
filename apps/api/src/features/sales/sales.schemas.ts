import { idSchema, paginatedResponseSchema, saleListItemSchema, saleSchema } from '@lotea/shared';
import { z } from 'zod';

export const saleParamsSchema = z.object({ id: idSchema });
export const saleResponseSchema = saleSchema;
export const saleListResponseSchema = paginatedResponseSchema(saleListItemSchema);
