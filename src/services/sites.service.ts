import { SiteRepository } from '@/database/repositories/SiteRepository';
import type { Site } from '@/lib/database.types';

export const sitesService = {
  get companyId() {
    return localStorage.getItem('company_id') || '';
  },

  async getAll() {
    return SiteRepository.getSites(this.companyId);
  },

  async getAuthorizedSites(employee: { id: string; role: string; site_id: string; company_id?: string }) {
    const compId = employee.company_id || this.companyId;
    return SiteRepository.getAuthorizedSites(compId, employee.id, employee.role, employee.site_id);
  },

  async getById(id: string) {
    return SiteRepository.getById(this.companyId, id);
  },

  async create(data: {
    name: string;
    brand_name?: string;
    address?: string;
    city?: string;
    state?: string;
    total_slots?: number;
    grace_period_minutes?: number;
    rounding_interval_min?: number;
    day_rate_switchover_hrs?: number;
    overstay_alert_hrs?: number;
    daily_revenue_target?: number;
    contact_number?: string;
  }) {
    return SiteRepository.create(this.companyId, data);
  },

  async update(siteId: string, data: Partial<Site>) {
    return SiteRepository.update(this.companyId, siteId, data);
  },

  async delete(siteId: string) {
    return SiteRepository.softDelete(this.companyId, siteId);
  }
};
