import type { Lot, LotStatus, Prisma } from '../../generated/prisma/client.ts';
import { InvalidLotStatusTransitionError, NotFoundError } from '../../shared/errors/app-error';
import * as lotsRepository from './lots.repository';

type PrismaOrTx = Prisma.TransactionClient;

/**
 * A Lot's status only ever moves forward — ACTIVE → FINISHED → ARCHIVED, or
 * ACTIVE → ARCHIVED directly. ARCHIVED is terminal. Same-status "transitions"
 * and any backward move are rejected, not silently accepted — see
 * DATABASE.md, "Lot status transitions".
 */
const ALLOWED_TRANSITIONS: Record<LotStatus, LotStatus[]> = {
  ACTIVE: ['FINISHED', 'ARCHIVED'],
  FINISHED: ['ARCHIVED'],
  ARCHIVED: [],
};

export async function createLot(
  db: PrismaOrTx,
  params: {
    userId: string;
    name: string;
    supplier?: string | null;
    receivedAt?: Date;
    notes?: string | null;
    actingUserId: string;
  },
): Promise<Lot> {
  return lotsRepository.createLot(db, {
    ...params,
    receivedAt: params.receivedAt ?? new Date(),
  });
}

export async function listLots(
  db: PrismaOrTx,
  params: { userId: string; page: number; limit: number },
) {
  const { items, total } = await lotsRepository.list(db, params);
  return { items, page: params.page, limit: params.limit, total };
}

/**
 * The single "fetch or throw" used everywhere a Lot must be verified to
 * belong to the tenant — including cross-feature (inventory's purchase-entry
 * flow calls this too, at the controller-composition level; see
 * inventory.controller.ts). Deliberately doesn't compose financials here:
 * that lives at the controller level (lots.controller.ts calls this *and*
 * inventoryService.getLotFinancials separately) so this module never has to
 * import inventory.service — which would create a circular dependency,
 * since inventory's purchase-entry flow needs this function to verify lot
 * ownership before creating items.
 */
export async function getLot(db: PrismaOrTx, params: { id: string; userId: string }): Promise<Lot> {
  const lot = await lotsRepository.findById(db, params);
  if (!lot) {
    throw new NotFoundError(`Lot ${params.id} not found`);
  }
  return lot;
}

export async function updateLot(
  db: PrismaOrTx,
  params: {
    id: string;
    userId: string;
    name?: string;
    supplier?: string | null;
    receivedAt?: Date;
    notes?: string | null;
    actingUserId: string;
  },
): Promise<Lot> {
  await getLot(db, { id: params.id, userId: params.userId });
  return lotsRepository.update(db, params);
}

export async function transitionStatus(
  db: PrismaOrTx,
  params: { id: string; userId: string; status: LotStatus; actingUserId: string },
): Promise<Lot> {
  const existing = await getLot(db, { id: params.id, userId: params.userId });
  if (!ALLOWED_TRANSITIONS[existing.status].includes(params.status)) {
    throw new InvalidLotStatusTransitionError(existing.status, params.status);
  }
  return lotsRepository.updateStatus(db, params);
}
