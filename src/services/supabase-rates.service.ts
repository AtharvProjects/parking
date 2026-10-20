/**
 * Supabase-direct rates service.
 * Manages site-specific parking rate cards.
 */
import { supabase } from '@/lib/supabase';
import type { RateCard, VehicleType } from '@/lib/database.types';

export const supabaseRatesService = {
  async getActiveRates(companyId: string, siteId: string): Promise<RateCard[]> {
    if (!companyId || !siteId) return [];
    
    const { data, error } = await supabase
      .from('rate_cards')
      .select('*')
      .eq('company_id', companyId)
      .eq('site_id', siteId)
      .is('effective_to', null)
      .order('vehicle_type', { ascending: true });

    if (error) throw new Error(`Failed to fetch rates: ${error.message}`);
    return (data || []) as RateCard[];
  },

  async createOrUpdateRate(companyId: string, siteId: string, data: {
    vehicle_type: VehicleType | string;
    hourly_rate: number;
    daily_rate: number;
    effective_from?: string;
  }, createdById: string): Promise<void> {
    const now = new Date().toISOString();
    const effectiveFrom = data.effective_from || now;
    const vType = data.vehicle_type as VehicleType;

    // 1. Deprecate old active rate for this vehicle type
    const { data: oldRates } = await supabase
      .from('rate_cards')
      .select('id')
      .eq('company_id', companyId)
      .eq('site_id', siteId)
      .eq('vehicle_type', vType)
      .is('effective_to', null);

    if (oldRates && oldRates.length > 0) {
      const { error: updateError } = await supabase
        .from('rate_cards')
        .update({ effective_to: now })
        .in('id', oldRates.map(r => r.id));

      if (updateError) {
        console.error('Failed to deprecate old rate:', updateError);
      }
    }

    // 2. Insert new active rate
    const { error } = await supabase
      .from('rate_cards')
      .insert({
        company_id: companyId,
        site_id: siteId,
        vehicle_type: vType,
        hourly_rate: data.hourly_rate,
        daily_rate: data.daily_rate,
        effective_from: effectiveFrom,
        created_by: createdById,
      });

    if (error) {
      if (error.code === '42501') throw new Error('You do not have permission to modify rates.');
      throw new Error(`Failed to create rate: ${error.message}`);
    }
  },
};
