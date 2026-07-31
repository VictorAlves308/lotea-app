import { useQuery } from '@tanstack/react-query';

import { getFinancialDashboard, type FinancialDashboardParams } from '../api';

export function useFinancialDashboard(params: FinancialDashboardParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['dashboard', 'financial', params],
    queryFn: () => getFinancialDashboard(params),
    enabled: options?.enabled ?? true,
  });
}
