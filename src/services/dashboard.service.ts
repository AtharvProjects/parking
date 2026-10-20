/**
 * Dashboard Service — Thin adapter using Supabase-direct operations.
 */
import { supabaseDashboardService } from '@/services/supabase-dashboard.service';
import type { DashboardStats } from '@/lib/database.types';

function getCompanyId(): string {
  return typeof window !== 'undefined'
    ? localStorage.getItem('company_id') || '00000000-0000-0000-0000-000000000000'
    : '00000000-0000-0000-0000-000000000000';
}

export const dashboardService = {
  async getStats(siteId?: string): Promise<DashboardStats> {
    return supabaseDashboardService.getStats(getCompanyId(), siteId);
  },

  async getRevenueChart(siteId?: string, days = 7) {
    return supabaseDashboardService.getRevenueChart(getCompanyId(), siteId, days);
  },
};
