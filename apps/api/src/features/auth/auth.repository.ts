import { generateId } from '@lotea/shared';

import type { Prisma, RefreshToken, User } from '../../generated/prisma/client.ts';

type Db = Prisma.TransactionClient;

export async function createUser(
  db: Db,
  params: { name: string; email: string; passwordHash: string },
): Promise<User> {
  // Self-registration: the new user is its own actor — see DATABASE.md's
  // audit-field policy on why createdBy/updatedBy aren't enforced relations.
  const id = generateId();
  return db.user.create({
    data: {
      id,
      name: params.name,
      email: params.email,
      passwordHash: params.passwordHash,
      createdBy: id,
      updatedBy: id,
    },
  });
}

/** Excludes soft-deleted (deactivated) accounts — they can't log in or register a duplicate email. */
export async function findActiveByEmail(db: Db, email: string): Promise<User | null> {
  return db.user.findFirst({ where: { email, deletedAt: null } });
}

export async function findActiveById(db: Db, id: string): Promise<User | null> {
  return db.user.findFirst({ where: { id, deletedAt: null } });
}

export async function createRefreshToken(
  db: Db,
  params: { userId: string; tokenHash: string; expiresAt: Date },
): Promise<RefreshToken> {
  return db.refreshToken.create({
    data: {
      id: generateId(),
      userId: params.userId,
      tokenHash: params.tokenHash,
      expiresAt: params.expiresAt,
    },
  });
}

export async function findRefreshTokenByHash(
  db: Db,
  tokenHash: string,
): Promise<RefreshToken | null> {
  return db.refreshToken.findUnique({ where: { tokenHash } });
}

export async function revokeRefreshToken(db: Db, id: string): Promise<RefreshToken> {
  return db.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
}
