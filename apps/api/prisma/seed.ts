import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { generateId } from '@lotea/shared';

import * as customersService from '../src/features/customers/customers.service';
import * as inventoryService from '../src/features/inventory/inventory.service';
import * as lotsService from '../src/features/lots/lots.service';
import * as productsService from '../src/features/products/products.service';
import * as salesService from '../src/features/sales/sales.service';
import { PrismaClient } from '../src/generated/prisma/client';
import { hashPassword } from '../src/shared/lib/password';
import { upsertCatalogProducts } from './lib/upsert-catalog-products';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Real bcrypt hash so both seeded accounts can actually be used to test
// login locally — not just placeholder data. Never use this password (or
// this pattern) outside local development.
//
// Deliberately short (5 chars) for how often this gets typed during manual
// testing — shorter than registerInputSchema's 8-char minimum, so this
// exact password only works for already-seeded accounts, never for signing
// up a new one through the app's own "Criar conta" screen.
const SEED_PASSWORD = 'teste';

/**
 * Realistic pt-BR development data for two independent resellers, covering
 * every scenario DATABASE.md and the test suite exercise: a profitable lot,
 * a lot that hasn't recovered its investment, a partially sold lot, the full
 * item lifecycle (available/reserved/sold/cancelled-and-restored), a
 * cancelled sale with its compensating movement, the same product bought at
 * different costs across different lots, and a second tenant to prove
 * isolation. Re-running this script wipes and recreates everything — it's
 * meant for local development, not production data.
 */
async function main() {
  console.log('Seeding Lotea development data...\n');

  // Global catalog data is independent of tenant data — upserted (not wiped)
  // so re-running this script doesn't churn it. See
  // prisma/lib/upsert-catalog-products.ts.
  await upsertCatalogProducts(prisma);
  console.log('Catálogo global atualizado.\n');

  // Children first, respecting FK order.
  await prisma.refreshToken.deleteMany();
  await prisma.paymentAllocation.deleteMany();
  await prisma.customerPayment.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.product.deleteMany();
  await prisma.lot.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();

  // ---------------------------------------------------------------------
  // Tenant 1: Ana Paula — Natura + Avon reseller
  // ---------------------------------------------------------------------
  const anaId = generateId();
  const ana = await prisma.user.create({
    data: {
      id: anaId,
      name: 'Ana Paula Ferreira',
      email: 'teste@teste.com',
      passwordHash: await hashPassword(SEED_PASSWORD),
      createdBy: anaId,
      updatedBy: anaId,
    },
  });

  const kaiak = await productsService.createProduct(prisma, {
    userId: ana.id,
    actingUserId: ana.id,
    name: 'Kaiak Tradicional Masculino 100ml',
    brand: 'Natura',
    category: 'Perfumaria',
    sku: 'NAT-KAIAK-100',
    volume: '100ml',
    variant: 'Masculino',
    defaultSalePrice: '65.00',
    minStockAlert: 5,
  });

  const aguaDeCheiro = await productsService.createProduct(prisma, {
    userId: ana.id,
    actingUserId: ana.id,
    name: 'Água de Cheiro Talco Desodorante',
    brand: 'Natura',
    category: 'Perfumaria',
    sku: 'NAT-AGCH-TALCO',
    volume: '100ml',
    variant: 'Unissex',
    defaultSalePrice: '32.00',
    minStockAlert: 5,
  });

  const batom = await productsService.createProduct(prisma, {
    userId: ana.id,
    actingUserId: ana.id,
    name: 'Batom Ultra Color',
    brand: 'Avon',
    category: 'Maquiagem',
    sku: 'AVON-BAT-UC',
    variant: 'Feminino',
    notes: 'Cores mais vendidas: Rosa Choque e Vermelho Paixão.',
    defaultSalePrice: '30.00',
    minStockAlert: 3,
  });

  // A repeat customer Ana sells to on fiado (buy-now-pay-later) terms —
  // demonstrates the accounts-receivable flow: a partially-paid sale, a
  // later payment against it, and a sale that was cancelled before any
  // payment was ever made.
  const fernanda = await customersService.createCustomer(prisma, {
    userId: ana.id,
    actingUserId: ana.id,
    name: 'Fernanda Costa',
    phone: '11987654321',
  });

  // --- Lot A: fully sold, clearly profitable ---
  // Created ACTIVE (purchase entries are only allowed against an ACTIVE lot
  // — see inventory.service.ts), stocked, sold, then transitioned to
  // FINISHED once every unit is gone — the real lifecycle, not a shortcut.
  const lotA = await prisma.lot.create({
    data: {
      id: generateId(),
      userId: ana.id,
      name: 'Compra Natura Ciclo 05/2026',
      supplier: 'Natura',
      receivedAt: new Date('2026-05-10'),
      status: 'ACTIVE',
      notes: 'Lote encerrado — todas as unidades vendidas.',
      createdBy: ana.id,
      updatedBy: ana.id,
    },
  });

  const lotAItems = await inventoryService.registerPurchaseEntry(prisma, {
    userId: ana.id,
    productId: kaiak.id,
    lotId: lotA.id,
    quantity: 5,
    acquisitionCost: '38.00',
    actingUserId: ana.id,
  });

  for (const item of lotAItems) {
    await salesService.createSale(prisma, {
      userId: ana.id,
      actingUserId: ana.id,
      idempotencyKey: `seed-lotA-${item.id}`,
      items: [{ inventoryItemId: item.id, salePrice: '65.00' }],
    });
  }
  await lotsService.transitionStatus(prisma, {
    id: lotA.id,
    userId: ana.id,
    status: 'FINISHED',
    actingUserId: ana.id,
  });
  console.log('Lote A (Kaiak, ciclo 05): 5 unidades, todas vendidas — lote lucrativo.');

  // --- Lot B: mostly unsold, investment not recovered yet ---
  const lotB = await prisma.lot.create({
    data: {
      id: generateId(),
      userId: ana.id,
      name: 'Compra Natura Ciclo 07/2026',
      supplier: 'Natura',
      receivedAt: new Date('2026-07-02'),
      status: 'ACTIVE',
      createdBy: ana.id,
      updatedBy: ana.id,
    },
  });

  const lotBItems = await inventoryService.registerPurchaseEntry(prisma, {
    userId: ana.id,
    productId: aguaDeCheiro.id,
    lotId: lotB.id,
    quantity: 10,
    acquisitionCost: '25.00',
    actingUserId: ana.id,
  });

  await salesService.createSale(prisma, {
    userId: ana.id,
    actingUserId: ana.id,
    idempotencyKey: `seed-lotB-${lotBItems[0]!.id}`,
    items: [{ inventoryItemId: lotBItems[0]!.id, salePrice: '32.00' }],
  });
  console.log(
    'Lote B (Água de Cheiro, ciclo 07): 10 unidades, 1 vendida — custo de R$250,00 ainda não recuperado (receita de R$32,00).',
  );

  // --- Lot C: partially sold, already recovered its cost, and hosts the
  // full item-lifecycle spread (available / reserved / sold / cancelled) ---
  const lotC = await prisma.lot.create({
    data: {
      id: generateId(),
      userId: ana.id,
      name: 'Compra Avon Ciclo 06/2026',
      supplier: 'Avon',
      receivedAt: new Date('2026-06-15'),
      status: 'ACTIVE',
      createdBy: ana.id,
      updatedBy: ana.id,
    },
  });

  const lotCItems = await inventoryService.registerPurchaseEntry(prisma, {
    userId: ana.id,
    productId: batom.id,
    lotId: lotC.id,
    quantity: 6,
    acquisitionCost: '12.00',
    actingUserId: ana.id,
  });
  const [soldItem1, soldItem2, soldItem3, cancelledItem, reservedItem, availableItem] = lotCItems;

  for (const item of [soldItem1!, soldItem2!, soldItem3!]) {
    await salesService.createSale(prisma, {
      userId: ana.id,
      actingUserId: ana.id,
      idempotencyKey: `seed-lotC-${item.id}`,
      items: [{ inventoryItemId: item.id, salePrice: '30.00' }],
    });
  }

  // A sale that gets cancelled before any payment was made: the item goes
  // SOLD, then reverses back to IN_STOCK through a compensating
  // SALE_CANCELLATION movement. Cancellation requires paidAmount = 0 (see
  // sales.service.ts's cancelSale), so this is created unpaid — and
  // therefore, per that same rule, needs a customer.
  const cancelledSale = await salesService.createSale(prisma, {
    userId: ana.id,
    actingUserId: ana.id,
    idempotencyKey: `seed-lotC-cancelled-${cancelledItem!.id}`,
    receivedAmount: '0.00',
    customerId: fernanda.id,
    items: [{ inventoryItemId: cancelledItem!.id, salePrice: '28.00' }],
  });
  await salesService.cancelSale(prisma, {
    userId: ana.id,
    saleId: cancelledSale.id,
    actingUserId: ana.id,
  });

  // A reservation, held for a customer but not yet sold — no service exists
  // for this yet, so it's set up directly like the seed narrative requires.
  await prisma.inventoryItem.update({
    where: { id: reservedItem!.id },
    data: { status: 'RESERVED', updatedBy: ana.id },
  });
  await prisma.inventoryMovement.create({
    data: {
      id: generateId(),
      userId: ana.id,
      inventoryItemId: reservedItem!.id,
      type: 'RESERVATION',
      notes: 'Reservado para cliente via WhatsApp.',
      createdBy: ana.id,
    },
  });

  // `availableItem` is left untouched: IN_STOCK, only its PURCHASE_ENTRY movement.
  void availableItem;

  console.log(
    'Lote C (Batom Avon, ciclo 06): 6 unidades — 3 vendidas, 1 vendida e cancelada (estoque restaurado), 1 reservada, 1 disponível. Receita confirmada de R$90,00 supera o custo de R$72,00.',
  );

  // --- Lot D: same product (Kaiak) bought again at a different cost ---
  const lotD = await prisma.lot.create({
    data: {
      id: generateId(),
      userId: ana.id,
      name: 'Compra Natura Ciclo 09/2026',
      supplier: 'Natura',
      // Deliberately dated in the past (not in the calendar month the
      // "ciclo" name implies) — a future receivedAt made this lot always
      // sort as "most recent" ahead of anything the tester creates today,
      // permanently hijacking the Lotes tab's "current lot" banner. Lots
      // list orders by receivedAt desc (see lots.repository.ts), so seed
      // dates must stay in the past like every other seeded lot here.
      receivedAt: new Date('2026-07-20'),
      status: 'ACTIVE',
      notes: 'Mesmo produto do Lote A, porém com custo de aquisição maior.',
      createdBy: ana.id,
      updatedBy: ana.id,
    },
  });

  const lotDItems = await inventoryService.registerPurchaseEntry(prisma, {
    userId: ana.id,
    productId: kaiak.id,
    lotId: lotD.id,
    quantity: 4,
    acquisitionCost: '41.00',
    actingUserId: ana.id,
  });

  const [lotDWalkInItem, lotDFiadoItem] = lotDItems;

  // A normal à-vista (walk-in) sale — paid in full, no customer needed.
  await salesService.createSale(prisma, {
    userId: ana.id,
    actingUserId: ana.id,
    idempotencyKey: `seed-lotD-${lotDWalkInItem!.id}`,
    receivedAmount: '70.00',
    items: [{ inventoryItemId: lotDWalkInItem!.id, salePrice: '70.00' }],
  });

  // A fiado sale to Fernanda: R$30 received now, R$40 fica pendente —
  // followed by a later payment of R$25, leaving her with a R$15 saldo.
  await salesService.createSale(prisma, {
    userId: ana.id,
    actingUserId: ana.id,
    idempotencyKey: `seed-lotD-${lotDFiadoItem!.id}`,
    receivedAmount: '30.00',
    customerId: fernanda.id,
    items: [{ inventoryItemId: lotDFiadoItem!.id, salePrice: '70.00' }],
  });
  await customersService.registerPayment(prisma, {
    userId: ana.id,
    customerId: fernanda.id,
    amount: '25.00',
    actingUserId: ana.id,
  });

  console.log(
    'Lote D (Kaiak, ciclo 09): mesmo produto do Lote A, custo de aquisição de R$41,00 (vs. R$38,00 no Lote A).',
  );
  const fernandaDetail = await customersService.getCustomerDetail(prisma, { id: fernanda.id, userId: ana.id });
  console.log(
    `Fernanda Costa (fiado): venda de R$70,00 (R$30,00 recebidos), pagamento posterior de R$25,00 — saldo atual R$${fernandaDetail.balance.replace('.', ',')}.`,
  );

  // ---------------------------------------------------------------------
  // Tenant 2: Carla Souza — Hinode reseller, kept fully isolated from Ana
  // ---------------------------------------------------------------------
  const carlaId = generateId();
  const carla = await prisma.user.create({
    data: {
      id: carlaId,
      name: 'Carla Souza',
      email: 'carla.souza@example.com',
      passwordHash: await hashPassword(SEED_PASSWORD),
      createdBy: carlaId,
      updatedBy: carlaId,
    },
  });

  const perfumeHinode = await productsService.createProduct(prisma, {
    userId: carla.id,
    actingUserId: carla.id,
    name: 'Perfume Bronx Black',
    brand: 'Hinode',
    category: 'Perfumaria',
    sku: 'HIN-BRONX-BLACK',
    volume: '100ml',
    variant: 'Masculino',
    defaultSalePrice: '55.00',
    minStockAlert: 3,
  });

  const lotHinode = await prisma.lot.create({
    data: {
      id: generateId(),
      userId: carla.id,
      name: 'Compra Hinode Julho 2026',
      supplier: 'Hinode',
      receivedAt: new Date('2026-07-05'),
      status: 'ACTIVE',
      createdBy: carla.id,
      updatedBy: carla.id,
    },
  });

  const hinodeItems = await inventoryService.registerPurchaseEntry(prisma, {
    userId: carla.id,
    productId: perfumeHinode.id,
    lotId: lotHinode.id,
    quantity: 3,
    acquisitionCost: '30.00',
    actingUserId: carla.id,
  });

  await salesService.createSale(prisma, {
    userId: carla.id,
    actingUserId: carla.id,
    idempotencyKey: `seed-hinode-${hinodeItems[0]!.id}`,
    items: [{ inventoryItemId: hinodeItems[0]!.id, salePrice: '55.00' }],
  });
  console.log(
    '\nTenant Carla Souza (Hinode): 1 produto, 1 lote, 3 unidades, 1 vendida — dados isolados de Ana.',
  );

  console.log('\nSeed concluído.');
  console.log(`  Ana Paula:  ${ana.id} (${ana.email})`);
  console.log(`  Carla:      ${carla.id} (${carla.email})`);
  console.log(`  Senha (ambas as contas): ${SEED_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
