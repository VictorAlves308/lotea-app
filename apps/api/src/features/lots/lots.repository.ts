import { generateId } from '@lotea/shared';

import type { Lot, LotStatus, Prisma } from '../../generated/prisma/client';

type Db = Prisma.TransactionClient;

export async function createLot(
  db: Db,
  params: {
    userId: string;
    name: string;
    supplier?: string | null;
    receivedAt: Date;
    notes?: string | null;
    actingUserId: string;
  },
): Promise<Lot> {
  return db.lot.create({
    data: {
      id: generateId(),
      userId: params.userId,
      name: params.name,
      supplier: params.supplier ?? null,
      receivedAt: params.receivedAt,
      notes: params.notes ?? null,
      createdBy: params.actingUserId,
      updatedBy: params.actingUserId,
    },
  });
}

/** Always scoped by userId — see ARCHITECTURE.md's tenant-isolation rule. */
export async function findById(
  db: Db,
  params: { id: string; userId: string },
): Promise<Lot | null> {
  return db.lot.findFirst({ where: { id: params.id, userId: params.userId, deletedAt: null } });
}

export async function list(
  db: Db,
  params: { userId: string; page: number; limit: number },
): Promise<{ items: Lot[]; total: number }> {
  const where = { userId: params.userId, deletedAt: null };
  const [items, total] = await Promise.all([
    db.lot.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    }),
    db.lot.count({ where }),
  ]);
  return { items, total };
}

export async function update(
  db: Db,
  params: {
    id: string;
    name?: string;
    supplier?: string | null;
    receivedAt?: Date;
    notes?: string | null;
    actingUserId: string;
  },
): Promise<Lot> {
  return db.lot.update({
    where: { id: params.id },
    data: {
      name: params.name,
      supplier: params.supplier,
      receivedAt: params.receivedAt,
      notes: params.notes,
      updatedBy: params.actingUserId,
    },
  });
}

export async function updateStatus(
  db: Db,
  params: { id: string; status: LotStatus; actingUserId: string },
): Promise<Lot> {
  return db.lot.update({
    where: { id: params.id },
    data: { status: params.status, updatedBy: params.actingUserId },
  });
}
