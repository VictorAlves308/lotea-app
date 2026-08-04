import type { IncomingMessage, ServerResponse } from 'node:http';

import type { FastifyInstance } from 'fastify';

import { buildApp } from '../src/app';

// Reused across warm invocations of the same serverless instance — building
// a fresh Fastify app (re-registering every plugin/route) on every request
// would make even a warm function as slow as a cold one.
let appReadyPromise: Promise<FastifyInstance> | null = null;

async function buildReadyApp(): Promise<FastifyInstance> {
  const app = buildApp();
  await app.ready();
  return app;
}

function getApp(): Promise<FastifyInstance> {
  appReadyPromise ??= buildReadyApp();
  return appReadyPromise;
}

/**
 * Vercel's Node.js runtime hands a serverless function the same raw
 * req/res Node gives any http server — Fastify's own `server` (created at
 * `Fastify()` construction, before `.listen()` is ever called) already has
 * its routing wired to its 'request' event, so emitting one directly here
 * runs the exact same request pipeline as the Render deployment, with no
 * separate serverless-specific route handling to keep in sync.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getApp();
  app.server.emit('request', req, res);
}
