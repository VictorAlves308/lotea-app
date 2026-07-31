import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { UnauthorizedError } from '../shared/errors/app-error';
import { verifyAccessToken } from '../shared/lib/jwt';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by the `authenticate` preHandler after verifying the bearer access token — never from client input. */
    userId: string;
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/**
 * The authentication middleware: a `preHandler` any protected route wires in
 * via `{ preHandler: fastify.authenticate }`. Verifies the bearer access
 * token and decorates `request.userId` — every downstream controller reads
 * the tenant id from here, never from a body/query/path param. See
 * DATABASE.md's tenant-isolation rule.
 */
const authenticatePlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('authenticate', async (request: FastifyRequest) => {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing bearer token');
    }

    const token = header.slice('Bearer '.length);
    try {
      const { userId } = verifyAccessToken(token);
      request.userId = userId;
    } catch {
      throw new UnauthorizedError('Invalid or expired access token');
    }
  });
};

export default fp(authenticatePlugin, { name: 'authenticate' });
