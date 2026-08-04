import type { AuthTokens, CurrentUser } from '@lotea/shared';

import type { PrismaClient, User } from '../../generated/prisma/client';
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  NotFoundError,
} from '../../shared/errors/app-error';
import { env } from '../../shared/lib/env';
import { signAccessToken } from '../../shared/lib/jwt';
import { hashPassword, verifyPassword } from '../../shared/lib/password';
import { generateOpaqueToken, hashToken } from '../../shared/lib/tokens';
import * as authRepository from './auth.repository';

export function toCurrentUser(user: User): CurrentUser {
  return { id: user.id, name: user.name, email: user.email };
}

/**
 * Precomputed once and reused so an unknown-email login takes roughly the
 * same time as a known-email one — otherwise the response-time difference
 * (skip bcrypt entirely vs. actually compare) would let an attacker
 * enumerate registered emails just by timing the login endpoint.
 */
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword('a-fixed-dummy-password-for-timing-safety');
  return dummyHashPromise;
}

async function issueTokens(
  db: Parameters<typeof authRepository.createRefreshToken>[0],
  userId: string,
): Promise<AuthTokens> {
  const accessToken = signAccessToken(userId);
  const refreshToken = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1000);
  await authRepository.createRefreshToken(db, {
    userId,
    tokenHash: hashToken(refreshToken),
    expiresAt,
  });
  return { accessToken, refreshToken, expiresIn: env.JWT_ACCESS_TTL_SECONDS };
}

export async function register(
  prisma: PrismaClient,
  params: { name: string; email: string; password: string },
): Promise<{ user: User; tokens: AuthTokens }> {
  return prisma.$transaction(async (tx) => {
    const existing = await authRepository.findActiveByEmail(tx, params.email);
    if (existing) {
      throw new EmailAlreadyRegisteredError();
    }
    const passwordHash = await hashPassword(params.password);
    const user = await authRepository.createUser(tx, {
      name: params.name,
      email: params.email,
      passwordHash,
    });
    const tokens = await issueTokens(tx, user.id);
    return { user, tokens };
  });
}

export async function login(
  prisma: PrismaClient,
  params: { email: string; password: string },
): Promise<{ user: User; tokens: AuthTokens }> {
  const user = await authRepository.findActiveByEmail(prisma, params.email);
  if (!user) {
    await verifyPassword(params.password, await getDummyHash());
    throw new InvalidCredentialsError();
  }

  const passwordMatches = await verifyPassword(params.password, user.passwordHash);
  if (!passwordMatches) {
    throw new InvalidCredentialsError();
  }

  const tokens = await issueTokens(prisma, user.id);
  return { user, tokens };
}

/**
 * Refresh rotation: the presented token is revoked in the same transaction
 * that issues its replacement, so a stolen-and-replayed old refresh token
 * stops working the moment the legitimate client rotates it.
 */
export async function refresh(
  prisma: PrismaClient,
  params: { refreshToken: string },
): Promise<AuthTokens> {
  const stored = await authRepository.findRefreshTokenByHash(
    prisma,
    hashToken(params.refreshToken),
  );
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw new InvalidRefreshTokenError();
  }

  return prisma.$transaction(async (tx) => {
    await authRepository.revokeRefreshToken(tx, stored.id);
    return issueTokens(tx, stored.userId);
  });
}

/** Idempotent: logging out an unknown or already-revoked token is not an error. */
export async function logout(
  prisma: PrismaClient,
  params: { refreshToken: string },
): Promise<void> {
  const stored = await authRepository.findRefreshTokenByHash(
    prisma,
    hashToken(params.refreshToken),
  );
  if (stored && !stored.revokedAt) {
    await authRepository.revokeRefreshToken(prisma, stored.id);
  }
}

export async function getCurrentUser(prisma: PrismaClient, userId: string): Promise<User> {
  const user = await authRepository.findActiveById(prisma, userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  return user;
}
