import { supabase } from '@/lib/supabase';
import type { Site } from '@/lib/database.types';

export const sitesService = {
  async getAll(): Promise<Site[]> {
    const { data, error } = await supabase
      .from('sites')
      .select('*')
      .is('deleted_at', null)
      .order('name');

    if (error) throw error;
    return data || [];
  },

  async getById(id: string): Promise<Site | null> {
    const { data, error } = await supabase
      .from('sites')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Site>): Promise<Site> {
    const { data, error } = await supabase
      .from('sites')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async create(input: { name: string; address?: string; city?: string }): Promise<Site> {
    const { data, error } = await supabase
      .from('sites')
      .insert(input)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
