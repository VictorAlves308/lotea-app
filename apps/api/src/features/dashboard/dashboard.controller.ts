import type { FinancialDashboardQuery } from '@lotea/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';

import * as dashboardService from './dashboard.service';

export async function getFinancialDashboardHandler(
  request: FastifyRequest<{ Querystring: FinancialDashboardQuery }>,
  reply: FastifyReply,
) {
  const dashboard = await dashboardService.getFinancialDashboard(request.server.prisma, {
    userId: request.userId,
    from: request.query.from,
    to: request.query.to,
    granularity: request.query.granularity,
    rankingLimit: request.query.rankingLimit,
  });
  return reply.status(200).send(dashboard);
}
