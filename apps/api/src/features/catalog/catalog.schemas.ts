import { catalogProductSchema, catalogProductSuggestionSchema, idSchema } from '@lotea/shared';
import { z } from 'zod';

export const catalogProductParamsSchema = z.object({ id: idSchema });

export const catalogProductResponseSchema = catalogProductSchema;

export const catalogSuggestionListResponseSchema = z.object({
  items: z.array(catalogProductSuggestionSchema),
});
