import { DashboardRepository } from '@/database/repositories/DashboardRepository';

export const dashboardService = {
  get companyId() {
    return localStorage.getItem('company_id') || '';
  },

  async getStats(siteId: string) {
    return DashboardRepository.getStats(this.companyId, siteId);
  },

  async getRevenueChart(siteId: string, days: number = 7) {
    return DashboardRepository.getRevenueChart(this.companyId, siteId, days);
  }
};
