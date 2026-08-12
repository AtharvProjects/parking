import { RateRepository } from '@/database/repositories/RateRepository';

export const ratesService = {
  get companyId() {
    return localStorage.getItem('company_id') || '';
  },

  async getActive(siteId: string) {
    return RateRepository.getActiveRates(this.companyId, siteId);
  },
  
  async getAll(siteId?: string) {
    // Reusing getActiveRates for simplicity in this offline refactor
    if (!siteId) return [];
    return RateRepository.getActiveRates(this.companyId, siteId);
  },

  async create(siteId: string, data: any, createdById: string) {
    return RateRepository.createRate(this.companyId, siteId, data, createdById);
  }
};
