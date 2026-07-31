import { generateId } from '@lotea/shared';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../app';

export async function createTestApp(): Promise<FastifyInstance> {
  const app = buildApp();
  await app.ready();
  return app;
}

export interface TestActor {
  userId: string;
  email: string;
  password: string;
  accessToken: string;
  refreshToken: string;
}

/** Registers a fresh user via the real HTTP route and returns everything a test needs to act as them. */
export async function registerTestActor(
  app: FastifyInstance,
  overrides?: { name?: string; email?: string; password?: string },
): Promise<TestActor> {
  const email = overrides?.email ?? `${generateId()}@example.com`;
  const password = overrides?.password ?? 'senha-teste-123';

  const response = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { name: overrides?.name ?? 'Usuária Teste', email, password },
  });

  const body = response.json();
  return {
    userId: body.user.id,
    email,
    password,
    accessToken: body.tokens.accessToken,
    refreshToken: body.tokens.refreshToken,
  };
}

export function authHeader(actor: TestActor) {
  return { authorization: `Bearer ${actor.accessToken}` };
}
