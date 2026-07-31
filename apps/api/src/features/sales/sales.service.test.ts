import { beforeEach, describe, expect, it } from 'vitest';

import * as customersService from '../customers/customers.service';
import * as inventoryService from '../inventory/inventory.service';
import * as productsService from '../products/products.service';
import { createTestCustomer, createTestLot, createTestUser, resetDatabase, testPrisma } from '../../test/db';
import {
  CustomerNotFoundError,
  CustomerRequiredError,
  InventoryItemUnavailableError,
  InvalidPaymentAmountError,
  NotFoundError,
  SaleHasActivePaymentsError,
} from '../../shared/errors/app-error';
import * as salesService from './sales.service';

beforeEach(async () => {
  await resetDatabase();
});

async function seedOneItem(userId: string, acquisitionCost = '38.00') {
  const lot = await createTestLot({ userId });
  const product = await productsService.createProduct(testPrisma, {
    userId,
    actingUserId: userId,
    name: 'Kaiak Tradicional Masculino',
  });
  const [item] = await inventoryService.registerPurchaseEntry(testPrisma, {
    userId,
    productId: product.id,
    lotId: lot.id,
    quantity: 1,
    acquisitionCost,
    actingUserId: userId,
  });
  return { lot, product, item: item! };
}

describe('createSale', () => {
  it('marks the InventoryItem SOLD and records a SALE movement', async () => {
    const user = await createTestUser();
    const { item } = await seedOneItem(user.id);

    const sale = await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      items: [{ inventoryItemId: item.id, salePrice: '65.00' }],
    });

    expect(sale.status).toBe('PAID');
    expect(sale.total.toFixed(2)).toBe('65.00');
    expect(sale.items).toHaveLength(1);

    const updatedItem = await testPrisma.inventoryItem.findUniqueOrThrow({
      where: { id: item.id },
    });
    expect(updatedItem.status).toBe('SOLD');

    const movements = await testPrisma.inventoryMovement.findMany({
      where: { inventoryItemId: item.id },
    });
    expect(movements.map((m) => m.type)).toEqual(['PURCHASE_ENTRY', 'SALE']);
  });

  it('snapshots salePrice and acquisitionCost onto the SaleItem, so profit is derivable per item', async () => {
    const user = await createTestUser();
    const { item } = await seedOneItem(user.id, '38.00');

    const sale = await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      items: [{ inventoryItemId: item.id, salePrice: '65.00' }],
    });

    const saleItem = sale.items[0]!;
    expect(saleItem.salePrice.toFixed(2)).toBe('65.00');
    expect(saleItem.acquisitionCostSnapshot.toFixed(2)).toBe('38.00');

    const profit = saleItem.salePrice.minus(saleItem.acquisitionCostSnapshot);
    expect(profit.toFixed(2)).toBe('27.00');
  });

  it('rejects selling an inventory item that belongs to another tenant', async () => {
    const owner = await createTestUser();
    const attacker = await createTestUser();
    const { item } = await seedOneItem(owner.id);

    await expect(
      salesService.createSale(testPrisma, {
        userId: attacker.id,
        actingUserId: attacker.id,
        items: [{ inventoryItemId: item.id, salePrice: '65.00' }],
      }),
    ).rejects.toThrow(NotFoundError);

    // The item must remain untouched — no cross-tenant side effect.
    const untouched = await testPrisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(untouched.status).toBe('IN_STOCK');
  });

  it('rejects selling the same unit twice — application-level fast path', async () => {
    const user = await createTestUser();
    const { item } = await seedOneItem(user.id);

    await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      items: [{ inventoryItemId: item.id, salePrice: '65.00' }],
    });

    await expect(
      salesService.createSale(testPrisma, {
        userId: user.id,
        actingUserId: user.id,
        items: [{ inventoryItemId: item.id, salePrice: '70.00' }],
      }),
    ).rejects.toThrow(InventoryItemUnavailableError);
  });

  it('rejects double-selling even if the application-level status check is bypassed — the partial unique index is the authoritative guard', async () => {
    const user = await createTestUser();
    const { item } = await seedOneItem(user.id);

    await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      items: [{ inventoryItemId: item.id, salePrice: '65.00' }],
    });

    // Simulate a race: force the item back to IN_STOCK (as if two requests
    // both passed the status check before either committed), then attempt a
    // second sale. The active SaleItem for this InventoryItem still exists
    // (voidedAt IS NULL), so the DB-level partial unique index must reject
    // the second insert regardless of what the application-level check saw.
    await testPrisma.inventoryItem.update({ where: { id: item.id }, data: { status: 'IN_STOCK' } });

    await expect(
      salesService.createSale(testPrisma, {
        userId: user.id,
        actingUserId: user.id,
        items: [{ inventoryItemId: item.id, salePrice: '70.00' }],
      }),
    ).rejects.toThrow(InventoryItemUnavailableError);

    const saleItems = await testPrisma.saleItem.findMany({ where: { inventoryItemId: item.id } });
    expect(saleItems).toHaveLength(1);
  });
});

describe('createSale — receivedAmount / customerId', () => {
  it('is fully paid at creation when receivedAmount equals the total, no customer needed', async () => {
    const user = await createTestUser();
    const { item } = await seedOneItem(user.id);

    const sale = await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      receivedAmount: '65.00',
      items: [{ inventoryItemId: item.id, salePrice: '65.00' }],
    });

    expect(sale.status).toBe('PAID');
    expect(sale.paidAmount.toFixed(2)).toBe('65.00');
    expect(sale.customerId).toBeNull();

    const payment = await testPrisma.customerPayment.findFirst({ where: { userId: user.id } });
    expect(payment).not.toBeNull();
    expect(payment!.customerId).toBeNull();
    expect(payment!.amount.toFixed(2)).toBe('65.00');
  });

  it('is PENDING when nothing is received, and requires a customer', async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id });
    const { item } = await seedOneItem(user.id);

    const sale = await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      receivedAmount: '0.00',
      customerId: customer.id,
      items: [{ inventoryItemId: item.id, salePrice: '65.00' }],
    });

    expect(sale.status).toBe('PENDING');
    expect(sale.paidAmount.toFixed(2)).toBe('0.00');
    expect(sale.customerId).toBe(customer.id);
    const payment = await testPrisma.customerPayment.findFirst({ where: { userId: user.id } });
    expect(payment).toBeNull(); // no payment record for a zero-amount receipt
  });

  it('is PARTIALLY_PAID when part of the total is received', async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id });
    const { item } = await seedOneItem(user.id);

    const sale = await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      receivedAmount: '20.00',
      customerId: customer.id,
      items: [{ inventoryItemId: item.id, salePrice: '65.00' }],
    });

    expect(sale.status).toBe('PARTIALLY_PAID');
    expect(sale.paidAmount.toFixed(2)).toBe('20.00');
  });

  it('rejects an outstanding sale (receivedAmount < total) with no customer', async () => {
    const user = await createTestUser();
    const { item } = await seedOneItem(user.id);

    await expect(
      salesService.createSale(testPrisma, {
        userId: user.id,
        actingUserId: user.id,
        receivedAmount: '20.00',
        items: [{ inventoryItemId: item.id, salePrice: '65.00' }],
      }),
    ).rejects.toThrow(CustomerRequiredError);
  });

  it('rejects receivedAmount greater than the total', async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id });
    const { item } = await seedOneItem(user.id);

    await expect(
      salesService.createSale(testPrisma, {
        userId: user.id,
        actingUserId: user.id,
        receivedAmount: '70.00',
        customerId: customer.id,
        items: [{ inventoryItemId: item.id, salePrice: '65.00' }],
      }),
    ).rejects.toThrow(InvalidPaymentAmountError);
  });

  it('rejects an unknown or another tenant’s customerId', async () => {
    const user = await createTestUser();
    const otherTenant = await createTestUser();
    const foreignCustomer = await createTestCustomer({ userId: otherTenant.id });
    const { item } = await seedOneItem(user.id);

    await expect(
      salesService.createSale(testPrisma, {
        userId: user.id,
        actingUserId: user.id,
        receivedAmount: '0.00',
        customerId: foreignCustomer.id,
        items: [{ inventoryItemId: item.id, salePrice: '65.00' }],
      }),
    ).rejects.toThrow(CustomerNotFoundError);
  });

  it('is idempotent with an initial payment — a retry never creates a second CustomerPayment', async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id });
    const { item } = await seedOneItem(user.id);
    const idempotencyKey = 'sale-with-payment-abc';

    const params = {
      userId: user.id,
      actingUserId: user.id,
      idempotencyKey,
      receivedAmount: '20.00',
      customerId: customer.id,
      items: [{ inventoryItemId: item.id, salePrice: '65.00' }],
    };
    const first = await salesService.createSale(testPrisma, params);
    const retry = await salesService.createSale(testPrisma, params);

    expect(retry.id).toBe(first.id);
    const payments = await testPrisma.customerPayment.count({ where: { userId: user.id } });
    expect(payments).toBe(1);
  });

  it('paidAmount always reconciles to the live sum of active PaymentAllocations for a customer-linked sale', async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id });
    const { item } = await seedOneItem(user.id);

    const sale = await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      receivedAmount: '20.00',
      customerId: customer.id,
      items: [{ inventoryItemId: item.id, salePrice: '65.00' }],
    });

    const allocations = await testPrisma.paymentAllocation.findMany({ where: { saleId: sale.id } });
    const total = allocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0);
    expect(total.toFixed(2)).toBe(sale.paidAmount.toFixed(2));

    // After a later payment, the reconciliation must still hold.
    await customersService.registerPayment(testPrisma, {
      userId: user.id,
      customerId: customer.id,
      amount: '45.00',
      actingUserId: user.id,
    });
    const updatedSale = await testPrisma.sale.findUniqueOrThrow({ where: { id: sale.id } });
    const allocationsAfter = await testPrisma.paymentAllocation.findMany({
      where: { saleId: sale.id, customerPayment: { voidedAt: null } },
    });
    const totalAfter = allocationsAfter.reduce((sum, allocation) => sum + Number(allocation.amount), 0);
    expect(totalAfter.toFixed(2)).toBe(updatedSale.paidAmount.toFixed(2));
  });
});

describe('cancelSale', () => {
  // Cancellation now requires paidAmount = 0 (see the "cancelSale — blocked
  // by active payments" describe block below) — every test in this block
  // creates its sale with receivedAmount: '0.00' (and therefore a customer,
  // since an outstanding sale always requires one) specifically to exercise
  // the unchanged "cancel with no payment" mechanics, not the new guard.
  it('restores the InventoryItem to IN_STOCK and records a compensating SALE_CANCELLATION movement', async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id });
    const { item } = await seedOneItem(user.id);

    const sale = await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      receivedAmount: '0.00',
      customerId: customer.id,
      items: [{ inventoryItemId: item.id, salePrice: '65.00' }],
    });

    const cancelled = await salesService.cancelSale(testPrisma, {
      userId: user.id,
      saleId: sale.id,
      actingUserId: user.id,
    });

    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.items[0]!.voidedAt).not.toBeNull();

    const restoredItem = await testPrisma.inventoryItem.findUniqueOrThrow({
      where: { id: item.id },
    });
    expect(restoredItem.status).toBe('IN_STOCK');

    const movements = await testPrisma.inventoryMovement.findMany({
      where: { inventoryItemId: item.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(movements.map((m) => m.type)).toEqual(['PURCHASE_ENTRY', 'SALE', 'SALE_CANCELLATION']);
  });

  it('the Sale row itself is never deleted — cancellation is a status', async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id });
    const { item } = await seedOneItem(user.id);
    const sale = await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      receivedAmount: '0.00',
      customerId: customer.id,
      items: [{ inventoryItemId: item.id, salePrice: '65.00' }],
    });

    await salesService.cancelSale(testPrisma, {
      userId: user.id,
      saleId: sale.id,
      actingUserId: user.id,
    });

    const stillThere = await testPrisma.sale.findUnique({ where: { id: sale.id } });
    expect(stillThere).not.toBeNull();
    expect(stillThere!.status).toBe('CANCELLED');
  });

  it('allows the restored unit to be sold again in a new sale', async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id });
    const { item } = await seedOneItem(user.id);
    const firstSale = await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      receivedAmount: '0.00',
      customerId: customer.id,
      items: [{ inventoryItemId: item.id, salePrice: '65.00' }],
    });
    await salesService.cancelSale(testPrisma, {
      userId: user.id,
      saleId: firstSale.id,
      actingUserId: user.id,
    });

    const secondSale = await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      items: [{ inventoryItemId: item.id, salePrice: '60.00' }],
    });

    expect(secondSale.status).toBe('PAID');
    const finalItem = await testPrisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(finalItem.status).toBe('SOLD');
  });

  it('is idempotent — cancelling an already-cancelled sale is a no-op', async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id });
    const { item } = await seedOneItem(user.id);
    const sale = await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      receivedAmount: '0.00',
      customerId: customer.id,
      items: [{ inventoryItemId: item.id, salePrice: '65.00' }],
    });

    await salesService.cancelSale(testPrisma, {
      userId: user.id,
      saleId: sale.id,
      actingUserId: user.id,
    });
    const secondCancel = await salesService.cancelSale(testPrisma, {
      userId: user.id,
      saleId: sale.id,
      actingUserId: user.id,
    });

    expect(secondCancel.status).toBe('CANCELLED');
    const movements = await testPrisma.inventoryMovement.findMany({
      where: { inventoryItemId: item.id, type: 'SALE_CANCELLATION' },
    });
    expect(movements).toHaveLength(1); // not doubled by the second cancel call
  });
});

describe('cancelSale — blocked by active payments', () => {
  it('blocks cancelling a partially-paid sale', async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id });
    const { item } = await seedOneItem(user.id);
    const sale = await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      receivedAmount: '20.00',
      customerId: customer.id,
      items: [{ inventoryItemId: item.id, salePrice: '65.00' }],
    });

    await expect(
      salesService.cancelSale(testPrisma, { userId: user.id, saleId: sale.id, actingUserId: user.id }),
    ).rejects.toThrow(SaleHasActivePaymentsError);

    // Stock must not move on a blocked attempt.
    const untouchedItem = await testPrisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(untouchedItem.status).toBe('SOLD');
  });

  it('blocks cancelling a fully-paid sale', async () => {
    const user = await createTestUser();
    const { item } = await seedOneItem(user.id);
    const sale = await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      receivedAmount: '65.00',
      items: [{ inventoryItemId: item.id, salePrice: '65.00' }],
    });

    await expect(
      salesService.cancelSale(testPrisma, { userId: user.id, saleId: sale.id, actingUserId: user.id }),
    ).rejects.toThrow(SaleHasActivePaymentsError);
  });

  it('voiding the payment first, then cancelling, succeeds — items return to stock only at that point', async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id });
    const { item } = await seedOneItem(user.id);
    const sale = await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      receivedAmount: '65.00',
      customerId: customer.id,
      items: [{ inventoryItemId: item.id, salePrice: '65.00' }],
    });
    const payment = await testPrisma.customerPayment.findFirstOrThrow({
      where: { userId: user.id, customerId: customer.id },
    });

    // Blocked before voiding.
    await expect(
      salesService.cancelSale(testPrisma, { userId: user.id, saleId: sale.id, actingUserId: user.id }),
    ).rejects.toThrow(SaleHasActivePaymentsError);
    const stillSold = await testPrisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(stillSold.status).toBe('SOLD');

    await customersService.voidPayment(testPrisma, {
      userId: user.id,
      customerId: customer.id,
      paymentId: payment.id,
      actingUserId: user.id,
    });

    const cancelled = await salesService.cancelSale(testPrisma, {
      userId: user.id,
      saleId: sale.id,
      actingUserId: user.id,
    });
    expect(cancelled.status).toBe('CANCELLED');

    const restoredItem = await testPrisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(restoredItem.status).toBe('IN_STOCK');
  });

  it('never leaves an active (non-voided) payment allocated to a cancelled sale', async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id });
    const { item } = await seedOneItem(user.id);
    const sale = await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      receivedAmount: '65.00',
      customerId: customer.id,
      items: [{ inventoryItemId: item.id, salePrice: '65.00' }],
    });
    const payment = await testPrisma.customerPayment.findFirstOrThrow({
      where: { userId: user.id, customerId: customer.id },
    });

    await customersService.voidPayment(testPrisma, {
      userId: user.id,
      customerId: customer.id,
      paymentId: payment.id,
      actingUserId: user.id,
    });
    await salesService.cancelSale(testPrisma, { userId: user.id, saleId: sale.id, actingUserId: user.id });

    const activeAllocations = await testPrisma.paymentAllocation.findMany({
      where: { saleId: sale.id, customerPayment: { voidedAt: null } },
    });
    expect(activeAllocations).toHaveLength(0);
  });
});

describe('offline idempotency', () => {
  it('returns the original sale on a retried submission with the same idempotencyKey', async () => {
    const user = await createTestUser();
    const { item } = await seedOneItem(user.id);
    const idempotencyKey = 'mobile-outbox-abc123';

    const first = await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      idempotencyKey,
      items: [{ inventoryItemId: item.id, salePrice: '65.00' }],
    });

    const retry = await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      idempotencyKey,
      items: [{ inventoryItemId: item.id, salePrice: '65.00' }],
    });

    expect(retry.id).toBe(first.id);

    const allSales = await testPrisma.sale.count({ where: { userId: user.id } });
    expect(allSales).toBe(1);
  });

  it('converges on one sale even under a genuine concurrent race past the pre-check', async () => {
    const user = await createTestUser();
    const { item } = await seedOneItem(user.id);
    const idempotencyKey = 'mobile-outbox-race';

    const [a, b] = await Promise.allSettled([
      salesService.createSale(testPrisma, {
        userId: user.id,
        actingUserId: user.id,
        idempotencyKey,
        items: [{ inventoryItemId: item.id, salePrice: '65.00' }],
      }),
      salesService.createSale(testPrisma, {
        userId: user.id,
        actingUserId: user.id,
        idempotencyKey,
        items: [{ inventoryItemId: item.id, salePrice: '65.00' }],
      }),
    ]);

    expect(a.status).toBe('fulfilled');
    expect(b.status).toBe('fulfilled');
    const idA = a.status === 'fulfilled' ? a.value.id : null;
    const idB = b.status === 'fulfilled' ? b.value.id : null;
    expect(idA).toBe(idB);

    const allSales = await testPrisma.sale.count({ where: { userId: user.id, idempotencyKey } });
    expect(allSales).toBe(1);
  });

  it('idempotencyKey uniqueness is scoped per user — two tenants can reuse the same client-generated key', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    const { item: itemA } = await seedOneItem(userA.id);
    const { item: itemB } = await seedOneItem(userB.id);
    const sharedKey = 'same-client-generated-key';

    const saleA = await salesService.createSale(testPrisma, {
      userId: userA.id,
      actingUserId: userA.id,
      idempotencyKey: sharedKey,
      items: [{ inventoryItemId: itemA.id, salePrice: '65.00' }],
    });
    const saleB = await salesService.createSale(testPrisma, {
      userId: userB.id,
      actingUserId: userB.id,
      idempotencyKey: sharedKey,
      items: [{ inventoryItemId: itemB.id, salePrice: '65.00' }],
    });

    expect(saleA.id).not.toBe(saleB.id);
  });
});

describe('dashboard aggregates', () => {
  const from = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const toExclusive = new Date(Date.now() + 24 * 60 * 60 * 1000);

  it('getSalesByStatusCounts buckets by status and zero-fills the rest', async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id });
    const { item: paidItem } = await seedOneItem(user.id);
    const { item: pendingItem } = await seedOneItem(user.id);
    const { item: cancelItem } = await seedOneItem(user.id);

    await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      items: [{ inventoryItemId: paidItem.id, salePrice: '65.00' }],
    });

    await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      items: [{ inventoryItemId: pendingItem.id, salePrice: '65.00' }],
      receivedAmount: '0.00',
      customerId: customer.id,
    });

    const cancelledSale = await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      items: [{ inventoryItemId: cancelItem.id, salePrice: '65.00' }],
      receivedAmount: '0.00',
      customerId: customer.id,
    });
    await salesService.cancelSale(testPrisma, {
      userId: user.id,
      saleId: cancelledSale.id,
      actingUserId: user.id,
    });

    const counts = await salesService.getSalesByStatusCounts(testPrisma, { userId: user.id, from, toExclusive });
    expect(counts).toEqual({ paid: 1, partiallyPaid: 0, pending: 1, cancelled: 1 });
  });

  it('getAverageTicket excludes cancelled sales', async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id });
    const { item: item1 } = await seedOneItem(user.id);
    const { item: item2 } = await seedOneItem(user.id);

    await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      items: [{ inventoryItemId: item1.id, salePrice: '100.00' }],
    });
    const cancelledSale = await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      items: [{ inventoryItemId: item2.id, salePrice: '9999.00' }],
      receivedAmount: '0.00',
      customerId: customer.id,
    });
    await salesService.cancelSale(testPrisma, {
      userId: user.id,
      saleId: cancelledSale.id,
      actingUserId: user.id,
    });

    const result = await salesService.getAverageTicket(testPrisma, { userId: user.id, from, toExclusive });
    expect(result.averageTicket).toBe('100.00');
    expect(result.count).toBe(1);
  });

  it('getSoldTimeline buckets by day and excludes cancelled sales', async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id });
    const { item: item1 } = await seedOneItem(user.id);
    const { item: item2 } = await seedOneItem(user.id);
    const { item: item3 } = await seedOneItem(user.id);

    const day1 = new Date(Date.UTC(2026, 0, 5, 10, 0, 0));
    const day2 = new Date(Date.UTC(2026, 0, 6, 10, 0, 0));

    const sale1 = await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      items: [{ inventoryItemId: item1.id, salePrice: '50.00' }],
    });
    await testPrisma.sale.update({ where: { id: sale1.id }, data: { createdAt: day1 } });

    const sale2 = await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      items: [{ inventoryItemId: item2.id, salePrice: '30.00' }],
    });
    await testPrisma.sale.update({ where: { id: sale2.id }, data: { createdAt: day1 } });

    const cancelledSale = await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      items: [{ inventoryItemId: item3.id, salePrice: '9999.00' }],
      receivedAmount: '0.00',
      customerId: customer.id,
    });
    await testPrisma.sale.update({ where: { id: cancelledSale.id }, data: { createdAt: day2 } });
    await salesService.cancelSale(testPrisma, {
      userId: user.id,
      saleId: cancelledSale.id,
      actingUserId: user.id,
    });

    const timeline = await salesService.getSoldTimeline(testPrisma, {
      userId: user.id,
      from: new Date(Date.UTC(2026, 0, 1)),
      toExclusive: new Date(Date.UTC(2026, 0, 10)),
      granularity: 'day',
    });

    // day2's only sale was cancelled — it contributes no bucket at all.
    expect(timeline).toHaveLength(1);
    expect(timeline[0]!.sold).toBe('80.00');
    expect(timeline[0]!.bucket.toISOString().slice(0, 10)).toBe('2026-01-05');
  });
});
