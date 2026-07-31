import type {
  CreateLotInput,
  PaginationQuery,
  UpdateLotInput,
  UpdateLotStatusInput,
} from '@lotea/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';

import * as inventoryService from '../inventory/inventory.service';
import * as lotsService from './lots.service';

export async function createLotHandler(
  request: FastifyRequest<{ Body: CreateLotInput }>,
  reply: FastifyReply,
) {
  const lot = await lotsService.createLot(request.server.prisma, {
    userId: request.userId,
    actingUserId: request.userId,
    ...request.body,
  });
  return reply.status(201).send(lot);
}

export async function listLotsHandler(
  request: FastifyRequest<{ Querystring: PaginationQuery }>,
  reply: FastifyReply,
) {
  const result = await lotsService.listLots(request.server.prisma, {
    userId: request.userId,
    page: request.query.page,
    limit: request.query.limit,
  });
  return reply.status(200).send(result);
}

export async function getLotHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const { id, userId } = { id: request.params.id, userId: request.userId };
  // Composed here, not in a service: lots.service.ts deliberately doesn't
  // import inventory.service.ts (that would create a circular dependency
  // with inventory's purchase-entry flow, which needs lots.service.ts to
  // verify lot ownership). See lots.service.ts's getLot() doc comment.
  const lot = await lotsService.getLot(request.server.prisma, { id, userId });
  const financials = await inventoryService.getLotFinancials(request.server.prisma, {
    lotId: id,
    userId,
  });
  // Bounded for display — getLotFinancials already computed the true
  // (unbounded) totals above independently, so the two can never disagree
  // just because this list happens to be capped.
  const customerBalances = await inventoryService.getLotCustomerBalances(request.server.prisma, {
    lotId: id,
    userId,
    limit: 20,
  });
  const items = await inventoryService.getLotItems(request.server.prisma, { lotId: id, userId });
  return reply.status(200).send({ lot, financials, customerBalances, items });
}

export async function updateLotHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: UpdateLotInput }>,
  reply: FastifyReply,
) {
  const lot = await lotsService.updateLot(request.server.prisma, {
    id: request.params.id,
    userId: request.userId,
    actingUserId: request.userId,
    ...request.body,
  });
  return reply.status(200).send(lot);
}

export async function updateLotStatusHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: UpdateLotStatusInput }>,
  reply: FastifyReply,
) {
  const lot = await lotsService.transitionStatus(request.server.prisma, {
    id: request.params.id,
    userId: request.userId,
    actingUserId: request.userId,
    status: request.body.status,
  });
  return reply.status(200).send(lot);
}
