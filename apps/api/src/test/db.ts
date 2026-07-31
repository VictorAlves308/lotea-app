import { PrismaPg } from '@prisma/adapter-pg';
import { buildCatalogProductSearchTerms, generateId, normalizeSearchText } from '@lotea/shared';
import bcrypt from 'bcryptjs';

import { PrismaClient } from '../generated/prisma/client.ts';

/**
 * A real PrismaClient connected to a dedicated test database (see
 * vitest.config.ts's DATABASE_URL). These are integration tests on purpose —
 * the invariants under test (tenant isolation, the partial unique index,
 * Decimal precision) only exist at the database layer and can't be verified
 * against a mock.
 */
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const testPrisma = new PrismaClient({ adapter });

/** Full reset between tests — children first, respecting FK order. */
export async function resetDatabase(): Promise<void> {
  await testPrisma.refreshToken.deleteMany();
  await testPrisma.paymentAllocation.deleteMany();
  await testPrisma.customerPayment.deleteMany();
  await testPrisma.inventoryMovement.deleteMany();
  await testPrisma.saleItem.deleteMany();
  await testPrisma.sale.deleteMany();
  await testPrisma.inventoryItem.deleteMany();
  await testPrisma.product.deleteMany();
  await testPrisma.lot.deleteMany();
  await testPrisma.customer.deleteMany();
  await testPrisma.user.deleteMany();
  // Global reference data, not tenant-scoped — reset too, so catalog tests
  // stay deterministic and isolated from each other and from real seed data.
  await testPrisma.catalogProduct.deleteMany();
}

/**
 * A fixed, known plaintext password for every test user (unless overridden),
 * so auth-flow tests can actually log in with it. Hashed at only 4 salt
 * rounds (vs. the real 12 in shared/lib/password.ts) — this is a test
 * fixture, not a real security boundary, and the suite creates dozens of
 * users; 12 rounds each would meaningfully slow the whole run down.
 */
export const TEST_USER_PASSWORD = 'test-password-123';
let testPasswordHashPromise: Promise<string> | null = null;
function getTestPasswordHash(): Promise<string> {
  testPasswordHashPromise ??= bcrypt.hash(TEST_USER_PASSWORD, 4);
  return testPasswordHashPromise;
}

export async function createTestUser(overrides?: {
  name?: string;
  email?: string;
  passwordHash?: string;
}) {
  const id = generateId();
  return testPrisma.user.create({
    data: {
      id,
      name: overrides?.name ?? 'Usuária de Teste',
      email: overrides?.email ?? `${id}@example.com`,
      passwordHash: overrides?.passwordHash ?? (await getTestPasswordHash()),
      createdBy: id,
      updatedBy: id,
    },
  });
}

export async function createTestLot(params: { userId: string; name?: string }) {
  const id = generateId();
  return testPrisma.lot.create({
    data: {
      id,
      userId: params.userId,
      name: params.name ?? 'Lote de Teste',
      receivedAt: new Date(),
      createdBy: params.userId,
      updatedBy: params.userId,
    },
  });
}

export async function createTestCustomer(params: {
  userId: string;
  name?: string;
  phone?: string | null;
}) {
  const id = generateId();
  const name = params.name ?? 'Cliente de Teste';
  return testPrisma.customer.create({
    data: {
      id,
      userId: params.userId,
      name,
      phone: params.phone ?? null,
      searchTerms: normalizeSearchText(name),
      createdBy: params.userId,
      updatedBy: params.userId,
    },
  });
}

export async function createTestCatalogProduct(overrides?: {
  brand?: string;
  name?: string;
  category?: string | null;
  volume?: string;
  description?: string | null;
  active?: boolean;
  searchTerms?: string;
}) {
  const id = generateId();
  const brand = overrides?.brand ?? 'Natura';
  const name = overrides?.name ?? 'Kaiak Clássico';
  const category = overrides?.category ?? 'Perfumaria';
  const volume = overrides?.volume ?? '100ml';
  return testPrisma.catalogProduct.create({
    data: {
      id,
      brand,
      name,
      category,
      volume,
      description: overrides?.description ?? null,
      active: overrides?.active ?? true,
      searchTerms:
        overrides?.searchTerms ?? buildCatalogProductSearchTerms({ name, brand, category, volume }),
    },
  });
}
