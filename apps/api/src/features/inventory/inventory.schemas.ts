import {
  idSchema,
  registerEntryInputSchema,
  registerEntrySummarySchema,
  writeOffInputSchema,
  writeOffSummarySchema,
} from '@lotea/shared';
import { z } from 'zod';

export const lotIdParamsSchema = z.object({ lotId: idSchema });

/** `lotId` comes from the URL, not the body, for this route. */
export const purchaseEntryBodySchema = registerEntryInputSchema.omit({ lotId: true });
export type PurchaseEntryBody = z.infer<typeof purchaseEntryBodySchema>;

export const purchaseEntryResponseSchema = registerEntrySummarySchema;

export const writeOffBodySchema = writeOffInputSchema;
export type WriteOffBody = z.infer<typeof writeOffBodySchema>;

export const writeOffResponseSchema = writeOffSummarySchema;
