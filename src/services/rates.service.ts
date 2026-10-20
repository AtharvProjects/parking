/**
 * Rates Service — Thin adapter using Supabase-direct operations.
 * Preserves the existing API surface used by page components.
 */
import { supabaseRatesService } from '@/services/supabase-rates.service';
import type { RateCard, VehicleType } from '@/lib/database.types';

function getCompanyId(): string {
  return typeof window !== 'undefined' ? localStorage.getItem('company_id') || '' : '';
}

export const ratesService = {
  async getActiveRates(siteId: string): Promise<RateCard[]> {
    return supabaseRatesService.getActiveRates(getCompanyId(), siteId);
  },

  // Alias for backward compatibility with page components
  async getActive(siteId: string): Promise<RateCard[]> {
    return supabaseRatesService.getActiveRates(getCompanyId(), siteId);
  },

  // Alias for backward compatibility with page components
  async getAll(siteId: string): Promise<RateCard[]> {
    return supabaseRatesService.getActiveRates(getCompanyId(), siteId);
  },

  async createRate(siteId: string, data: {
    vehicle_type: VehicleType | string;
    hourly_rate: number;
    daily_rate: number;
    effective_from?: string;
  }, createdById: string): Promise<void> {
    return supabaseRatesService.createOrUpdateRate(getCompanyId(), siteId, data, createdById);
  },

  // Alias for backward compatibility with page components
  async create(siteId: string, data: {
    vehicle_type: VehicleType | string;
    hourly_rate: number;
    daily_rate: number;
    effective_from?: string;
  }, createdById?: string): Promise<void> {
    const empId = createdById || (typeof window !== 'undefined' ? localStorage.getItem('current_employee_id') || '' : '');
    return supabaseRatesService.createOrUpdateRate(getCompanyId(), siteId, data, empId);
  },
};
