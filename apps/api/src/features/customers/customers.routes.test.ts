import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { testPrisma, resetDatabase } from '../../test/db';
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

async function createCustomer(actor: TestActor, payload: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: '/customers', headers: authHeader(actor), payload });
}

/** Full HTTP-level setup for one sellable InventoryItem — lot + product + purchase entry, item id read back via the DB (the purchase-entry response is a summary, never per-item ids — see inventory.routes.test.ts). */
async function seedInventoryItem(actor: TestActor) {
  const lotResponse = await app.inject({
    method: 'POST',
    url: '/lots',
    headers: authHeader(actor),
    payload: { name: 'Lote' },
  });
  const productResponse = await app.inject({
    method: 'POST',
    url: '/products',
    headers: authHeader(actor),
    payload: {
      name: `Produto ${Math.random().toString(36).slice(2)}`,
      defaultSalePrice: '29.90',
      minStockAlert: 5,
    },
  });
  const lotId = lotResponse.json().id as string;
  const productId = productResponse.json().id as string;

  await app.inject({
    method: 'POST',
    url: `/lots/${lotId}/inventory-entries`,
    headers: authHeader(actor),
    payload: { productId, quantity: 1, acquisitionCost: '10.00' },
  });

  const [item] = await testPrisma.inventoryItem.findMany({ where: { lotId, productId } });
  return item!.id;
}

describe('POST /customers', () => {
  it('creates a customer', async () => {
    const actor = await registerTestActor(app);
    const response = await createCustomer(actor, { name: 'Maria Silva', phone: '11999998888' });

    expect(response.statusCode).toBe(201);
    expect(response.json().name).toBe('Maria Silva');
  });

  it('returns duplicate candidates instead of creating, when a similarly-named customer already exists', async () => {
    const actor = await registerTestActor(app);
    await createCustomer(actor, { name: 'Maria Silva' });

    const response = await createCustomer(actor, { name: 'Maria Silva' });

    expect(response.statusCode).toBe(200);
    expect(response.json().duplicateCandidates).toHaveLength(1);
  });

  it('creates anyway when confirmDuplicate is set', async () => {
    const actor = await registerTestActor(app);
    await createCustomer(actor, { name: 'Maria Silva' });

    const response = await createCustomer(actor, { name: 'Maria Silva', confirmDuplicate: true });

    expect(response.statusCode).toBe(201);
  });
});

describe('GET /customers/search', () => {
  it('requires authentication', async () => {
    const response = await app.inject({ method: 'GET', url: '/customers/search?query=maria' });
    expect(response.statusCode).toBe(401);
  });

  it('returns a concise suggestion shape', async () => {
    const actor = await registerTestActor(app);
    await createCustomer(actor, { name: 'Maria Silva', phone: '11999998888' });

    const response = await app.inject({
      method: 'GET',
      url: '/customers/search?query=maria',
      headers: authHeader(actor),
    });

    const [suggestion] = response.json().items;
    expect(Object.keys(suggestion).sort()).toEqual(['id', 'name', 'phone', 'notes'].sort());
  });

  it('never returns another tenant’s customers', async () => {
    const owner = await registerTestActor(app);
    const attacker = await registerTestActor(app);
    await createCustomer(owner, { name: 'Maria Silva' });

    const response = await app.inject({
      method: 'GET',
      url: '/customers/search?query=maria',
      headers: authHeader(attacker),
    });

    expect(response.json().items).toHaveLength(0);
  });
});

describe('GET /customers/:id', () => {
  it('returns the customer with her current balance', async () => {
    const actor = await registerTestActor(app);
    const created = await createCustomer(actor, { name: 'Maria Silva' });

    const response = await app.inject({
      method: 'GET',
      url: `/customers/${created.json().id}`,
      headers: authHeader(actor),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().balance).toBe('0.00');
  });

  it('returns 404 for another tenant’s customer', async () => {
    const owner = await registerTestActor(app);
    const attacker = await registerTestActor(app);
    const created = await createCustomer(owner, { name: 'Maria Silva' });

    const response = await app.inject({
      method: 'GET',
      url: `/customers/${created.json().id}`,
      headers: authHeader(attacker),
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('GET /customers (list)', () => {
  it('sorts by balance and filters by hasBalance', async () => {
    const actor = await registerTestActor(app);
    const withBalance = await createCustomer(actor, { name: 'Com Saldo' });
    await createCustomer(actor, { name: 'Sem Saldo' });
    const itemId = await seedInventoryItem(actor);

    await app.inject({
      method: 'POST',
      url: '/sales',
      headers: authHeader(actor),
      payload: {
        items: [{ inventoryItemId: itemId, salePrice: '50.00' }],
        receivedAmount: '0.00',
        customerId: withBalance.json().id,
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/customers?hasBalance=true',
      headers: authHeader(actor),
    });

    expect(response.json().items.map((c: { name: string }) => c.name)).toEqual(['Com Saldo']);
  });
});

describe('Sale + payment flow integrated end to end', () => {
  it('creates a partially-paid sale requiring a customer, registers a payment, and reflects it in the statement', async () => {
    const actor = await registerTestActor(app);
    const customer = (await createCustomer(actor, { name: 'Maria' })).json();
    const itemId = await seedInventoryItem(actor);

    const saleResponse = await app.inject({
      method: 'POST',
      url: '/sales',
      headers: authHeader(actor),
      payload: {
        items: [{ inventoryItemId: itemId, salePrice: '160.00' }],
        receivedAmount: '0.00',
        customerId: customer.id,
      },
    });
    expect(saleResponse.statusCode).toBe(201);
    expect(saleResponse.json().status).toBe('PENDING');

    const paymentResponse = await app.inject({
      method: 'POST',
      url: `/customers/${customer.id}/payments`,
      headers: authHeader(actor),
      payload: { amount: '80.00' },
    });
    expect(paymentResponse.statusCode).toBe(201);

    const statementResponse = await app.inject({
      method: 'GET',
      url: `/customers/${customer.id}/statement`,
      headers: authHeader(actor),
    });
    const lines = statementResponse.json().items;
    expect(lines).toHaveLength(2);
    expect(lines[0].type).toBe('SALE');
    expect(lines[1].type).toBe('PAYMENT');

    const detailResponse = await app.inject({
      method: 'GET',
      url: `/customers/${customer.id}`,
      headers: authHeader(actor),
    });
    expect(detailResponse.json().balance).toBe('80.00');
  });

  it('rejects a partially-paid sale without a customer', async () => {
    const actor = await registerTestActor(app);
    const itemId = await seedInventoryItem(actor);

    const response = await app.inject({
      method: 'POST',
      url: '/sales',
      headers: authHeader(actor),
      payload: { items: [{ inventoryItemId: itemId, salePrice: '160.00' }], receivedAmount: '0.00' },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('CUSTOMER_REQUIRED');
  });

  it('voiding a payment reopens the sale it funded', async () => {
    const actor = await registerTestActor(app);
    const customer = (await createCustomer(actor, { name: 'Maria' })).json();
    const itemId = await seedInventoryItem(actor);

    await app.inject({
      method: 'POST',
      url: '/sales',
      headers: authHeader(actor),
      payload: {
        items: [{ inventoryItemId: itemId, salePrice: '50.00' }],
        receivedAmount: '0.00',
        customerId: customer.id,
      },
    });
    const payment = (
      await app.inject({
        method: 'POST',
        url: `/customers/${customer.id}/payments`,
        headers: authHeader(actor),
        payload: { amount: '50.00' },
      })
    ).json();

    const voidResponse = await app.inject({
      method: 'POST',
      url: `/customers/${customer.id}/payments/${payment.id}/void`,
      headers: authHeader(actor),
    });
    expect(voidResponse.statusCode).toBe(200);
    expect(voidResponse.json().voidedAt).not.toBeNull();

    const detailResponse = await app.inject({
      method: 'GET',
      url: `/customers/${customer.id}`,
      headers: authHeader(actor),
    });
    expect(detailResponse.json().balance).toBe('50.00');
  });
});
