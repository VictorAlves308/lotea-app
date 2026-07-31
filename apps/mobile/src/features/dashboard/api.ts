import type { FinancialDashboard } from '@lotea/shared';

import { apiClient } from '../../shared/lib/api-client';

export interface FinancialDashboardParams {
  /** YYYY-MM-DD, inclusive on both ends. */
  from: string;
  to: string;
  granularity?: 'day' | 'week' | 'month';
  rankingLimit?: number;
}

export function getFinancialDashboard(params: FinancialDashboardParams): Promise<FinancialDashboard> {
  const query = new URLSearchParams({ from: params.from, to: params.to });
  if (params.granularity) query.set('granularity', params.granularity);
  if (params.rankingLimit) query.set('rankingLimit', String(params.rankingLimit));

  return apiClient.get(`/dashboard/financial?${query.toString()}`);
}
