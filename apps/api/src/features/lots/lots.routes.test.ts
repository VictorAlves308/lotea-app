import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { resetDatabase, testPrisma } from '../../test/db';
import { authHeader, createTestApp, registerTestActor, type TestActor } from '../../test/app';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await resetDatabase();
});

describe('POST /lots', () => {
  it('creates a lot owned by the authenticated user', async () => {
    const actor = await registerTestActor(app);

    const response = await app.inject({
      method: 'POST',
      url: '/lots',
      headers: authHeader(actor),
      payload: { name: 'Compra Natura Ciclo 05', supplier: 'Natura' },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.name).toBe('Compra Natura Ciclo 05');
    expect(body.userId).toBe(actor.userId);
    expect(body.status).toBe('ACTIVE');
  });

  it('rejects an unauthenticated request', async () => {
    const response = await app.inject({ method: 'POST', url: '/lots', payload: { name: 'X' } });
    expect(response.statusCode).toBe(401);
  });
});

describe('GET /lots', () => {
  it('lists only the authenticated user’s lots, paginated', async () => {
    const actor = await registerTestActor(app);
    const otherActor = await registerTestActor(app);

    for (let i = 0; i < 3; i += 1) {
      await app.inject({
        method: 'POST',
        url: '/lots',
        headers: authHeader(actor),
        payload: { name: `Lote ${i}` },
      });
    }
    await app.inject({
      method: 'POST',
      url: '/lots',
      headers: authHeader(otherActor),
      payload: { name: 'Lote de outro usuário' },
    });

    const response = await app.inject({ method: 'GET', url: '/lots', headers: authHeader(actor) });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.total).toBe(3);
    expect(body.items).toHaveLength(3);
    expect(body.items.every((lot: { userId: string }) => lot.userId === actor.userId)).toBe(true);
  });

  it('respects page and limit query params', async () => {
    const actor = await registerTestActor(app);
    for (let i = 0; i < 5; i += 1) {
      await app.inject({
        method: 'POST',
        url: '/lots',
        headers: authHeader(actor),
        payload: { name: `Lote ${i}` },
      });
    }

    const response = await app.inject({
      method: 'GET',
      url: '/lots?page=2&limit=2',
      headers: authHeader(actor),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.items).toHaveLength(2);
    expect(body.page).toBe(2);
    expect(body.total).toBe(5);
  });
});

describe('GET /lots/:id', () => {
  it('returns the lot with its financials', async () => {
    const actor = await registerTestActor(app);
    const createResponse = await app.inject({
      method: 'POST',
      url: '/lots',
      headers: authHeader(actor),
      payload: { name: 'Compra Natura' },
    });
    const lotId = createResponse.json().id;

    const response = await app.inject({
      method: 'GET',
      url: `/lots/${lotId}`,
      headers: authHeader(actor),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.lot.id).toBe(lotId);
    expect(body.financials).toEqual({
      itemCount: 0,
      soldCount: 0,
      totalCost: '0.00',
      revenue: '0.00',
      realizedProfit: '0.00',
      hasRecoveredInvestment: true,
      totalReceived: '0.00',
      outstanding: '0.00',
    });
    expect(body.customerBalances).toEqual([]);
  });

  it('includes the lot’s customer balance breakdown, matching the financials totals', async () => {
    const actor: TestActor = await registerTestActor(app);

    const lotResponse = await app.inject({
      method: 'POST',
      url: '/lots',
      headers: authHeader(actor),
      payload: { name: 'Compra Natura' },
    });
    const lotId = lotResponse.json().id as string;

    const productResponse = await app.inject({
      method: 'POST',
      url: '/products',
      headers: authHeader(actor),
      payload: { name: 'Produto Teste', defaultSalePrice: '29.90', minStockAlert: 5 },
    });
    const productId = productResponse.json().id as string;

    await app.inject({
      method: 'POST',
      url: `/lots/${lotId}/inventory-entries`,
      headers: authHeader(actor),
      payload: { productId, quantity: 1, acquisitionCost: '10.00' },
    });
    const [item] = await testPrisma.inventoryItem.findMany({ where: { lotId, productId } });

    const customerResponse = await app.inject({
      method: 'POST',
      url: '/customers',
      headers: authHeader(actor),
      payload: { name: 'Maria Silva' },
    });
    const customerId = customerResponse.json().id as string;

    await app.inject({
      method: 'POST',
      url: '/sales',
      headers: authHeader(actor),
      payload: {
        items: [{ inventoryItemId: item!.id, salePrice: '100.00' }],
        receivedAmount: '40.00',
        customerId,
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: `/lots/${lotId}`,
      headers: authHeader(actor),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.financials.revenue).toBe('100.00');
    expect(body.financials.totalReceived).toBe('40.00');
    expect(body.financials.outstanding).toBe('60.00');
    expect(body.customerBalances).toEqual([
      { customerId, name: 'Maria Silva', outstanding: '60.00' },
    ]);
  });

  it('returns 404 for another tenant’s lot — never leaks existence', async () => {
    const owner = await registerTestActor(app);
    const attacker = await registerTestActor(app);
    const createResponse = await app.inject({
      method: 'POST',
      url: '/lots',
      headers: authHeader(owner),
      payload: { name: 'Lote Privado' },
    });
    const lotId = createResponse.json().id;

    const response = await app.inject({
      method: 'GET',
      url: `/lots/${lotId}`,
      headers: authHeader(attacker),
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns 404 for a nonexistent lot id', async () => {
    const actor = await registerTestActor(app);
    const response = await app.inject({
      method: 'GET',
      url: '/lots/019789ab-cdef-7abc-8def-0123456789ab',
      headers: authHeader(actor),
    });
    expect(response.statusCode).toBe(404);
  });
});

describe('PATCH /lots/:id', () => {
  it('updates editable fields', async () => {
    const actor = await registerTestActor(app);
    const createResponse = await app.inject({
      method: 'POST',
      url: '/lots',
      headers: authHeader(actor),
      payload: { name: 'Nome Original' },
    });
    const lotId = createResponse.json().id;

    const response = await app.inject({
      method: 'PATCH',
      url: `/lots/${lotId}`,
      headers: authHeader(actor),
      payload: { name: 'Nome Atualizado', supplier: 'Avon' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.name).toBe('Nome Atualizado');
    expect(body.supplier).toBe('Avon');
  });

  it('rejects updating another tenant’s lot', async () => {
    const owner = await registerTestActor(app);
    const attacker = await registerTestActor(app);
    const createResponse = await app.inject({
      method: 'POST',
      url: '/lots',
      headers: authHeader(owner),
      payload: { name: 'Lote Privado' },
    });
    const lotId = createResponse.json().id;

    const response = await app.inject({
      method: 'PATCH',
      url: `/lots/${lotId}`,
      headers: authHeader(attacker),
      payload: { name: 'Hackeado' },
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('PATCH /lots/:id/status', () => {
  async function createLot(actor: Awaited<ReturnType<typeof registerTestActor>>) {
    const response = await app.inject({
      method: 'POST',
      url: '/lots',
      headers: authHeader(actor),
      payload: { name: 'Lote' },
    });
    return response.json().id as string;
  }

  it('allows ACTIVE → FINISHED', async () => {
    const actor = await registerTestActor(app);
    const lotId = await createLot(actor);

    const response = await app.inject({
      method: 'PATCH',
      url: `/lots/${lotId}/status`,
      headers: authHeader(actor),
      payload: { status: 'FINISHED' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('FINISHED');
  });

  it('allows ACTIVE → ARCHIVED directly', async () => {
    const actor = await registerTestActor(app);
    const lotId = await createLot(actor);

    const response = await app.inject({
      method: 'PATCH',
      url: `/lots/${lotId}/status`,
      headers: authHeader(actor),
      payload: { status: 'ARCHIVED' },
    });

    expect(response.statusCode).toBe(200);
  });

  it('rejects ARCHIVED → ACTIVE — ARCHIVED is terminal', async () => {
    const actor = await registerTestActor(app);
    const lotId = await createLot(actor);
    await app.inject({
      method: 'PATCH',
      url: `/lots/${lotId}/status`,
      headers: authHeader(actor),
      payload: { status: 'ARCHIVED' },
    });

    const response = await app.inject({
      method: 'PATCH',
      url: `/lots/${lotId}/status`,
      headers: authHeader(actor),
      payload: { status: 'ACTIVE' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('INVALID_LOT_STATUS_TRANSITION');
  });

  it('rejects FINISHED → ACTIVE — backward moves are never allowed', async () => {
    const actor = await registerTestActor(app);
    const lotId = await createLot(actor);
    await app.inject({
      method: 'PATCH',
      url: `/lots/${lotId}/status`,
      headers: authHeader(actor),
      payload: { status: 'FINISHED' },
    });

    const response = await app.inject({
      method: 'PATCH',
      url: `/lots/${lotId}/status`,
      headers: authHeader(actor),
      payload: { status: 'ACTIVE' },
    });

    expect(response.statusCode).toBe(409);
  });

  it('rejects a same-status "transition" (ACTIVE → ACTIVE)', async () => {
    const actor = await registerTestActor(app);
    const lotId = await createLot(actor);

    const response = await app.inject({
      method: 'PATCH',
      url: `/lots/${lotId}/status`,
      headers: authHeader(actor),
      payload: { status: 'ACTIVE' },
    });

    expect(response.statusCode).toBe(409);
  });
});
