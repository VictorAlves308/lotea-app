import { z } from 'zod';

import { fullAuditFieldsSchema, idSchema, lotStatusSchema } from './common.schema';

/**
 * A Lot is a purchase batch. It never stores a total cost: that figure is
 * always derived on read as SUM(InventoryItem.acquisitionCost) for the lot,
 * so it can never drift from the items that actually make it up. See
 * DATABASE.md's "Financial invariants" section.
 */
export const lotSchema = z.object({
  id: idSchema,
  userId: idSchema,
  name: z.string().min(1).max(120),
  supplier: z.string().max(120).nullable(),
  receivedAt: z.coerce.date(),
  notes: z.string().max(2000).nullable(),
  status: lotStatusSchema,
  ...fullAuditFieldsSchema.shape,
});
export type Lot = z.infer<typeof lotSchema>;

export const createLotInputSchema = z.object({
  name: z.string().min(1).max(120),
  supplier: z.string().max(120).nullish(),
  /** Defaults to today (server-side) when omitted. */
  receivedAt: z.coerce.date().optional(),
  notes: z.string().max(2000).nullish(),
});
export type CreateLotInput = z.infer<typeof createLotInputSchema>;

/** Editable fields only — status changes go through the dedicated transition endpoint, not here. */
export const updateLotInputSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  supplier: z.string().max(120).nullish(),
  receivedAt: z.coerce.date().optional(),
  notes: z.string().max(2000).nullish(),
});
export type UpdateLotInput = z.infer<typeof updateLotInputSchema>;

/**
 * A Lot's status only moves forward: ACTIVE → FINISHED → ARCHIVED, or
 * ACTIVE → ARCHIVED directly. ARCHIVED is terminal. See DATABASE.md, "Lot
 * status transitions".
 */
export const updateLotStatusInputSchema = z.object({
  status: lotStatusSchema,
});
export type UpdateLotStatusInput = z.infer<typeof updateLotStatusInputSchema>;
