import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { resetDatabase } from '../../test/db';
import { authHeader, createTestApp, registerTestActor } from '../../test/app';

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

describe('GET /dashboard/financial', () => {
  it('requires authentication', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/dashboard/financial?from=2026-01-01&to=2026-01-31',
    });
    expect(response.statusCode).toBe(401);
  });

  it('returns every indicator, empty and zeroed, for a tenant with no data', async () => {
    const actor = await registerTestActor(app);

    const response = await app.inject({
      method: 'GET',
      url: '/dashboard/financial?from=2026-01-01&to=2026-01-31&granularity=day&rankingLimit=5',
      headers: authHeader(actor),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.totalSoldInPeriod).toBe('0.00');
    expect(body.totalReceivedInPeriod).toBe('0.00');
    expect(body.totalOutstanding).toBe('0.00');
    expect(body.customersWithBalanceCount).toBe(0);
    expect(body.salesByStatus).toEqual({ paid: 0, partiallyPaid: 0, pending: 0, cancelled: 0 });
    expect(body.averageTicket).toBe('0.00');
    expect(body.timeline).toHaveLength(31); // every day in January, zero-filled
    expect(body.topCustomersByBalance).toEqual([]);
    expect(body.topProducts).toEqual([]);
    expect(body.topBrands).toEqual([]);
    expect(body.recentPayments).toEqual([]);
  });

  it('rejects a rankingLimit above the schema’s max', async () => {
    const actor = await registerTestActor(app);

    const response = await app.inject({
      method: 'GET',
      url: '/dashboard/financial?from=2026-01-01&to=2026-01-31&rankingLimit=999',
      headers: authHeader(actor),
    });

    expect(response.statusCode).toBe(400);
  });
});
