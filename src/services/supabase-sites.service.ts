/**
 * Supabase-direct sites service.
 * All operators can access all active sites in their company.
 */
import { supabase } from '@/lib/supabase';
import type { Site } from '@/lib/database.types';

export const supabaseSitesService = {
  async getAll(companyId: string): Promise<Site[]> {
    if (!companyId) return [];
    
    const { data, error } = await supabase
      .from('sites')
      .select('*')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (error) throw new Error(`Failed to fetch sites: ${error.message}`);
    return (data || []) as Site[];
  },

  /**
   * All authenticated users in the company can see all active sites.
   * Operators are NOT restricted to their assigned site.
   */
  async getAuthorizedSites(companyId: string): Promise<Site[]> {
    return this.getAll(companyId);
  },

  async getById(companyId: string, siteId: string): Promise<Site | null> {
    if (!companyId || !siteId) return null;
    
    const { data, error } = await supabase
      .from('sites')
      .select('*')
      .eq('id', siteId)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch site: ${error.message}`);
    return data as Site | null;
  },

  async create(companyId: string, data: {
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
  }): Promise<Site> {
    const payload: any = {
      company_id: companyId,
      name: data.name,
      brand_name: data.brand_name || null,
      address: data.address || '',
      city: data.city || '',
      state: data.state || 'Maharashtra',
      timezone: 'Asia/Kolkata',
      grace_period_minutes: data.grace_period_minutes ?? 15,
      rounding_interval_min: data.rounding_interval_min ?? 30,
      day_rate_switchover_hrs: data.day_rate_switchover_hrs ?? 12,
      overstay_alert_hrs: data.overstay_alert_hrs ?? 24,
      daily_revenue_target: data.daily_revenue_target ?? 10000,
      total_slots: data.total_slots ?? 100,
    };

    const { data: site, error } = await supabase
      .from('sites')
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (error.code === '42501') throw new Error('You do not have permission to create sites.');
      throw new Error(`Failed to create site: ${error.message}`);
    }
    return site as Site;
  },

  async update(companyId: string, siteId: string, data: Partial<Site>): Promise<void> {
    // Only allow updating known valid schema fields
    const allowedFields = [
      'name', 'brand_name', 'address', 'city', 'state',
      'total_slots', 'grace_period_minutes', 'rounding_interval_min',
      'day_rate_switchover_hrs', 'overstay_alert_hrs', 'daily_revenue_target'
    ];
    
    const updateData: any = {};
    for (const field of allowedFields) {
      if (data[field as keyof Site] !== undefined) {
        updateData[field] = data[field as keyof Site];
      }
    }
    
    if (Object.keys(updateData).length === 0) return;

    const { error } = await supabase
      .from('sites')
      .update(updateData as any)
      .eq('id', siteId)
      .eq('company_id', companyId);

    if (error) {
      if (error.code === '42501') throw new Error('You do not have permission to modify sites.');
      throw new Error(`Failed to update site: ${error.message}`);
    }
  },

  async softDelete(companyId: string, siteId: string): Promise<void> {
    const { error } = await supabase
      .from('sites')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', siteId)
      .eq('company_id', companyId);

    if (error) {
      if (error.code === '42501') throw new Error('You do not have permission to delete sites.');
      throw new Error(`Failed to delete site: ${error.message}`);
    }
  },
};
