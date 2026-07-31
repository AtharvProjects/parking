import { supabase } from '@/lib/supabase';
import type { RateCard } from '@/lib/database.types';
import type { CreateRateCardInput } from '@/lib/validators';

export const ratesService = {
  async getAll(siteId?: string): Promise<RateCard[]> {
    let query = supabase
      .from('rate_cards')
      .select('*')
      .order('effective_from', { ascending: false });

    if (siteId && siteId !== 'ALL') query = query.eq('site_id', siteId);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getActive(siteId: string): Promise<RateCard[]> {
    const { data, error } = await supabase
      .from('rate_cards')
      .select('*')
      .eq('site_id', siteId)
      .is('effective_to', null)
      .order('vehicle_type');

    if (error) throw error;
    return data || [];
  },

  async create(siteId: string, input: CreateRateCardInput, createdBy?: string): Promise<RateCard> {
    // Expire existing active rate for this vehicle type
    await supabase
      .from('rate_cards')
      .update({ effective_to: new Date().toISOString() })
      .eq('site_id', siteId)
      .eq('vehicle_type', input.vehicle_type)
      .is('effective_to', null);

    const { data, error } = await supabase
      .from('rate_cards')
      .insert({
        ...input,
        site_id: siteId,
        created_by: createdBy,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
