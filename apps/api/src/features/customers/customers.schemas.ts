import {
  customerDetailSchema,
  customerListItemSchema,
  customerPaymentSchema,
  customerSchema,
  customerStatementLineSchema,
  customerSuggestionSchema,
  idSchema,
  paginatedResponseSchema,
} from '@lotea/shared';
import { z } from 'zod';

export const customerParamsSchema = z.object({ id: idSchema });
export const paymentParamsSchema = z.object({ id: idSchema, paymentId: idSchema });

/** POST/PATCH return the bare identity — no balance needed for a create/edit action. */
export const customerResponseSchema = customerSchema;
/** GET /customers/:id returns the richer detail shape, with her current balance. */
export const customerDetailResponseSchema = customerDetailSchema;
export const customerListResponseSchema = paginatedResponseSchema(customerListItemSchema);

export const suggestionListResponseSchema = z.object({ items: z.array(customerSuggestionSchema) });
export const duplicateCandidatesResponseSchema = z.object({
  duplicateCandidates: z.array(customerSuggestionSchema),
});

export const statementResponseSchema = z.object({ items: z.array(customerStatementLineSchema) });
export const paymentResponseSchema = customerPaymentSchema;
