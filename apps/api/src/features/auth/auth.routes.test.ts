import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { resetDatabase } from '../../test/db';
import { createTestApp, registerTestActor } from '../../test/app';

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

describe('POST /auth/register', () => {
  it('creates a user and returns a token pair', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { name: 'Ana Paula', email: 'ana@example.com', password: 'senha12345' },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.user).toEqual({
      id: expect.any(String),
      name: 'Ana Paula',
      email: 'ana@example.com',
    });
    expect(body.tokens.accessToken).toEqual(expect.any(String));
    expect(body.tokens.refreshToken).toEqual(expect.any(String));
    expect(body.user.passwordHash).toBeUndefined();
  });

  it('rejects a duplicate email', async () => {
    await registerTestActor(app, { email: 'dup@example.com' });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { name: 'Outra Pessoa', email: 'dup@example.com', password: 'senha12345' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('EMAIL_ALREADY_REGISTERED');
  });

  it('rejects a password shorter than 8 characters', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { name: 'Ana Paula', email: 'ana2@example.com', password: 'short' },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('POST /auth/login', () => {
  it('logs in with correct credentials', async () => {
    const actor = await registerTestActor(app, {
      email: 'login@example.com',
      password: 'senha12345',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: actor.email, password: actor.password },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().tokens.accessToken).toEqual(expect.any(String));
  });

  it('rejects a wrong password with a generic error', async () => {
    const actor = await registerTestActor(app, {
      email: 'wrongpass@example.com',
      password: 'senha12345',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: actor.email, password: 'not-the-right-password' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects an email that was never registered, with the same error as a wrong password', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'never-registered@example.com', password: 'whatever123' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('protected routes', () => {
  it('rejects a request with no Authorization header', async () => {
    const response = await app.inject({ method: 'GET', url: '/auth/me' });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a malformed bearer token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: 'Bearer not-a-real-token' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('accepts a valid access token and returns the current user', async () => {
    const actor = await registerTestActor(app, { name: 'Carla', email: 'carla-me@example.com' });

    const response = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${actor.accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: actor.userId, name: 'Carla', email: actor.email });
  });
});

describe('POST /auth/refresh', () => {
  it('issues a new token pair and invalidates the old refresh token (rotation)', async () => {
    const actor = await registerTestActor(app);

    const refreshResponse = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: actor.refreshToken },
    });
    expect(refreshResponse.statusCode).toBe(200);
    const newTokens = refreshResponse.json();
    expect(newTokens.refreshToken).not.toBe(actor.refreshToken);

    // The old refresh token must no longer work — rotation revoked it.
    const reuseResponse = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: actor.refreshToken },
    });
    expect(reuseResponse.statusCode).toBe(401);
    expect(reuseResponse.json().error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('rejects an unknown refresh token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: 'this-token-was-never-issued' },
    });
    expect(response.statusCode).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('revokes the refresh token so it can no longer be used', async () => {
    const actor = await registerTestActor(app);

    const logoutResponse = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      payload: { refreshToken: actor.refreshToken },
    });
    expect(logoutResponse.statusCode).toBe(204);

    const refreshResponse = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: actor.refreshToken },
    });
    expect(refreshResponse.statusCode).toBe(401);
  });

  it('is idempotent — logging out twice is not an error', async () => {
    const actor = await registerTestActor(app);
    await app.inject({
      method: 'POST',
      url: '/auth/logout',
      payload: { refreshToken: actor.refreshToken },
    });

    const secondLogout = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      payload: { refreshToken: actor.refreshToken },
    });
    expect(secondLogout.statusCode).toBe(204);
  });
});
