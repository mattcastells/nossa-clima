import { useQuery } from '@tanstack/react-query';

import { getDashboardSummary } from '@/services/dashboard';

export const useDashboardSummary = () =>
  useQuery({ queryKey: ['dashboard-summary'], queryFn: getDashboardSummary });
