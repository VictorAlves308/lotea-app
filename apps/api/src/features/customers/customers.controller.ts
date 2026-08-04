import type {
  CreateCustomerInput,
  CustomerSuggestion,
  ListCustomersQuery,
  ReceivablesSummaryQuery,
  RegisterPaymentInput,
  SearchCustomersInput,
  UpdateCustomerInput,
} from '@lotea/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';

import type { Customer } from '../../generated/prisma/client';
import * as customersService from './customers.service';
import type { CustomerPaymentWithAllocations } from './customers.repository';

function toSuggestion(customer: Customer): CustomerSuggestion {
  return { id: customer.id, name: customer.name, phone: customer.phone, notes: customer.notes };
}

/**
 * Maps the raw Prisma shape (real Decimal `amount` fields, on both the
 * payment and each allocation) to the wire format (money as fixed-2-decimal
 * strings) — same reasoning as sales.controller.ts's toWireSale.
 */
function toWirePayment(payment: CustomerPaymentWithAllocations) {
  return {
    ...payment,
    amount: payment.amount.toFixed(2),
    allocations: payment.allocations.map((allocation) => ({
      ...allocation,
      amount: allocation.amount.toFixed(2),
    })),
  };
}

export async function createCustomerHandler(
  request: FastifyRequest<{ Body: CreateCustomerInput }>,
  reply: FastifyReply,
) {
  const result = await customersService.createCustomerWithDuplicateCheck(request.server.prisma, {
    userId: request.userId,
    actingUserId: request.userId,
    ...request.body,
  });

  if (!result.created) {
    return reply
      .status(200)
      .send({ duplicateCandidates: (result.duplicateCandidates ?? []).map(toSuggestion) });
  }
  return reply.status(201).send(result.customer);
}

export async function updateCustomerHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: UpdateCustomerInput }>,
  reply: FastifyReply,
) {
  const customer = await customersService.updateCustomer(request.server.prisma, {
    id: request.params.id,
    userId: request.userId,
    actingUserId: request.userId,
    ...request.body,
  });
  return reply.status(200).send(customer);
}

export async function searchCustomersHandler(
  request: FastifyRequest<{ Querystring: SearchCustomersInput }>,
  reply: FastifyReply,
) {
  const customers = await customersService.searchCustomers(request.server.prisma, {
    userId: request.userId,
    query: request.query.query,
    limit: request.query.limit,
  });
  return reply.status(200).send({ items: customers.map(toSuggestion) });
}

export async function getCustomerHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const customer = await customersService.getCustomerDetail(request.server.prisma, {
    id: request.params.id,
    userId: request.userId,
  });
  return reply.status(200).send(customer);
}

export async function listCustomersHandler(
  request: FastifyRequest<{ Querystring: ListCustomersQuery }>,
  reply: FastifyReply,
) {
  const result = await customersService.listCustomers(request.server.prisma, {
    userId: request.userId,
    page: request.query.page,
    limit: request.query.limit,
    sort: request.query.sort,
    hasBalance: request.query.hasBalance,
  });
  return reply.status(200).send(result);
}

export async function registerPaymentHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: RegisterPaymentInput }>,
  reply: FastifyReply,
) {
  const payment = await customersService.registerPayment(request.server.prisma, {
    userId: request.userId,
    customerId: request.params.id,
    actingUserId: request.userId,
    ...request.body,
  });
  return reply.status(201).send(toWirePayment(payment));
}

export async function voidPaymentHandler(
  request: FastifyRequest<{ Params: { id: string; paymentId: string } }>,
  reply: FastifyReply,
) {
  const payment = await customersService.voidPayment(request.server.prisma, {
    userId: request.userId,
    customerId: request.params.id,
    paymentId: request.params.paymentId,
    actingUserId: request.userId,
  });
  return reply.status(200).send(toWirePayment(payment));
}

export async function getStatementHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const items = await customersService.getStatement(request.server.prisma, {
    userId: request.userId,
    customerId: request.params.id,
  });
  return reply.status(200).send({ items });
}

export async function getReceivablesSummaryHandler(
  request: FastifyRequest<{ Querystring: ReceivablesSummaryQuery }>,
  reply: FastifyReply,
) {
  const summary = await customersService.getReceivablesSummary(request.server.prisma, {
    userId: request.userId,
    from: request.query.from,
    to: request.query.to,
  });
  return reply.status(200).send(summary);
}
