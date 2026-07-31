import { z } from 'zod';

import { idSchema, immutableAuditFieldsSchema, inventoryMovementTypeSchema } from './common.schema';

/**
 * One immutable row per state change of one InventoryItem — never updated,
 * never deleted. See DATABASE.md's "Inventory movements" section.
 */
export const inventoryMovementSchema = z.object({
  id: idSchema,
  userId: idSchema,
  inventoryItemId: idSchema,
  /** The Sale this movement originated from, when the type is SALE or SALE_CANCELLATION. */
  saleId: idSchema.nullable(),
  type: inventoryMovementTypeSchema,
  notes: z.string().max(2000).nullable(),
  ...immutableAuditFieldsSchema.shape,
});
export type InventoryMovement = z.infer<typeof inventoryMovementSchema>;
