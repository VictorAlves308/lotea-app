import type { RegisterEntrySummary, WriteOffSummary } from '@lotea/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';

import * as inventoryService from './inventory.service';
import type { PurchaseEntryBody, WriteOffBody } from './inventory.schemas';

/**
 * Creates N InventoryItem rows (one per unit) inside a transaction (see
 * inventory.service.ts / sales.service.ts pattern) but responds with a
 * summary, never the full item array — requirement 4's "don't return an
 * unnecessarily large response when many units are created".
 */
export async function createPurchaseEntryHandler(
  request: FastifyRequest<{ Params: { lotId: string }; Body: PurchaseEntryBody }>,
  reply: FastifyReply,
) {
  const expiresAt = request.body.expiresAt ?? null;

  const items = await inventoryService.registerPurchaseEntry(request.server.prisma, {
    userId: request.userId,
    actingUserId: request.userId,
    lotId: request.params.lotId,
    productId: request.body.productId,
    quantity: request.body.quantity,
    acquisitionCost: request.body.acquisitionCost,
    expiresAt,
  });

  const summary: RegisterEntrySummary = {
    lotId: request.params.lotId,
    productId: request.body.productId,
    quantity: items.length,
    acquisitionCost: request.body.acquisitionCost,
    expiresAt,
    createdAt: new Date(),
  };
  return reply.status(201).send(summary);
}

/** Same "summary, never the full item array" shape as createPurchaseEntryHandler. */
export async function createWriteOffHandler(
  request: FastifyRequest<{ Body: WriteOffBody }>,
  reply: FastifyReply,
) {
  const items = await inventoryService.registerWriteOff(request.server.prisma, {
    userId: request.userId,
    actingUserId: request.userId,
    productId: request.body.productId,
    quantity: request.body.quantity,
    reason: request.body.reason,
    notes: request.body.notes,
  });

  const summary: WriteOffSummary = {
    productId: request.body.productId,
    quantity: items.length,
    reason: request.body.reason,
    createdAt: new Date(),
  };
  return reply.status(201).send(summary);
}
