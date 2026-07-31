import { supabase } from '@/lib/supabase';
import type { Employee } from '@/lib/database.types';
import type { CreateEmployeeInput } from '@/lib/validators';

export const employeesService = {
  async getAll(siteId?: string): Promise<Employee[]> {
    let query = supabase
      .from('employees')
      .select('*')
      .is('deleted_at', null)
      .order('name');

    if (siteId && siteId !== 'ALL') query = query.eq('site_id', siteId);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async create(siteId: string, input: CreateEmployeeInput): Promise<Employee> {
    const { data, error } = await supabase
      .from('employees')
      .insert({ ...input, site_id: siteId })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, input: Partial<CreateEmployeeInput>): Promise<Employee> {
    const { data, error } = await supabase
      .from('employees')
      .update(input)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async toggleActive(id: string, active: boolean) {
    const { error } = await supabase
      .from('employees')
      .update({ active })
      .eq('id', id);
    if (error) throw error;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('employees')
      .update({ deleted_at: new Date().toISOString(), active: false })
      .eq('id', id);
    if (error) throw error;
  },
};
