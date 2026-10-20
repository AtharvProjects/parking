/**
 * Sites Service — Thin adapter using Supabase-direct operations.
 */
import { supabaseSitesService } from '@/services/supabase-sites.service';
import type { Site } from '@/lib/database.types';

function getCompanyId(): string {
  return typeof window !== 'undefined'
    ? localStorage.getItem('company_id') || '00000000-0000-0000-0000-000000000000'
    : '00000000-0000-0000-0000-000000000000';
}

export const sitesService = {
  async getAll(): Promise<Site[]> {
    return supabaseSitesService.getAll(getCompanyId());
  },

  async getAuthorizedSites(): Promise<Site[]> {
    return supabaseSitesService.getAuthorizedSites(getCompanyId());
  },

  async getById(siteId: string): Promise<Site | null> {
    return supabaseSitesService.getById(getCompanyId(), siteId);
  },

  async create(data: Parameters<typeof supabaseSitesService.create>[1]): Promise<Site> {
    return supabaseSitesService.create(getCompanyId(), data);
  },

  async update(siteId: string, data: Partial<Site>): Promise<void> {
    return supabaseSitesService.update(getCompanyId(), siteId, data);
  },

  async softDelete(siteId: string): Promise<void> {
    return supabaseSitesService.softDelete(getCompanyId(), siteId);
  },

  async delete(siteId: string): Promise<void> {
    return supabaseSitesService.softDelete(getCompanyId(), siteId);
  },
};
