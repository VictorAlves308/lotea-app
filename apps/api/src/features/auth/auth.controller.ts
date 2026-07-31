import type { LoginInput, LogoutInput, RefreshInput, RegisterInput } from '@lotea/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';

import * as authService from './auth.service';

export async function registerHandler(
  request: FastifyRequest<{ Body: RegisterInput }>,
  reply: FastifyReply,
) {
  const { user, tokens } = await authService.register(request.server.prisma, request.body);
  return reply.status(201).send({ user: authService.toCurrentUser(user), tokens });
}

export async function loginHandler(
  request: FastifyRequest<{ Body: LoginInput }>,
  reply: FastifyReply,
) {
  const { user, tokens } = await authService.login(request.server.prisma, request.body);
  return reply.status(200).send({ user: authService.toCurrentUser(user), tokens });
}

export async function refreshHandler(
  request: FastifyRequest<{ Body: RefreshInput }>,
  reply: FastifyReply,
) {
  const tokens = await authService.refresh(request.server.prisma, request.body);
  return reply.status(200).send(tokens);
}

export async function logoutHandler(
  request: FastifyRequest<{ Body: LogoutInput }>,
  reply: FastifyReply,
) {
  await authService.logout(request.server.prisma, request.body);
  return reply.status(204).send();
}

/**
 * `request.userId` comes from the `authenticate` preHandler plugin, which
 * verified the bearer access token — never from client input. See
 * ARCHITECTURE.md / DATABASE.md's tenant-isolation rule: every authenticated
 * route derives its identity this way, never from a body/query param.
 */
export async function meHandler(request: FastifyRequest, reply: FastifyReply) {
  const user = await authService.getCurrentUser(request.server.prisma, request.userId);
  return reply.status(200).send(authService.toCurrentUser(user));
}
