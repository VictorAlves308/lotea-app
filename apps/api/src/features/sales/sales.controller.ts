import type { CreateSaleInput, ListSalesQuery } from '@lotea/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';

import * as salesService from './sales.service';
import type { SaleWithItems } from './sales.repository';

/**
 * Maps the raw Prisma shape (real Decimal fields) to the wire format
 * (money as fixed-2-decimal strings) — the service layer intentionally
 * keeps returning real Decimal values, since seed.ts and every test do
 * further Decimal arithmetic on the result; only the HTTP boundary needs
 * strings. Mirrors how inventory.service.ts's getLotFinancials already
 * converts before returning, just done here at the controller instead
 * since sales.service.ts's return value is also consumed directly
 * (non-HTTP) by seed.ts/tests.
 */
function toWireSale(sale: SaleWithItems) {
  return {
    ...sale,
    total: sale.total.toFixed(2),
    paidAmount: sale.paidAmount.toFixed(2),
    items: sale.items.map(({ inventoryItem, ...item }) => ({
      ...item,
      productId: inventoryItem.product.id,
      productName: inventoryItem.product.name,
      salePrice: item.salePrice.toFixed(2),
      acquisitionCostSnapshot: item.acquisitionCostSnapshot.toFixed(2),
    })),
  };
}

export async function createSaleHandler(
  request: FastifyRequest<{ Body: CreateSaleInput }>,
  reply: FastifyReply,
) {
  const sale = await salesService.createSale(request.server.prisma, {
    userId: request.userId,
    actingUserId: request.userId,
    idempotencyKey: request.body.idempotencyKey,
    items: request.body.items,
    receivedAmount: request.body.receivedAmount,
    customerId: request.body.customerId,
    paymentMethod: request.body.paymentMethod,
  });
  return reply.status(201).send(toWireSale(sale));
}

export async function listSalesHandler(
  request: FastifyRequest<{ Querystring: ListSalesQuery }>,
  reply: FastifyReply,
) {
  const result = await salesService.listSales(request.server.prisma, {
    userId: request.userId,
    page: request.query.page,
    limit: request.query.limit,
    status: request.query.status,
  });
  return reply.status(200).send(result);
}

export async function getSaleHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const sale = await salesService.getSale(request.server.prisma, {
    id: request.params.id,
    userId: request.userId,
  });
  return reply.status(200).send(toWireSale(sale));
}

export async function cancelSaleHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const sale = await salesService.cancelSale(request.server.prisma, {
    userId: request.userId,
    saleId: request.params.id,
    actingUserId: request.userId,
  });
  return reply.status(200).send(toWireSale(sale));
}
