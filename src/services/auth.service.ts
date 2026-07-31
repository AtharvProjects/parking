import { supabase } from '@/lib/supabase';
import type { Employee } from '@/lib/database.types';

export interface AuthState {
  user: { id: string; email: string } | null;
  employee: Employee | null;
  isLoading: boolean;
}

export const authService = {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  },

  async getEmployee(authUserId: string): Promise<Employee | null> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('auth_user_id', authUserId)
      .eq('active', true)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getOrCreateEmployee(authUserId: string, email: string): Promise<Employee> {
    // Try to find existing employee
    let employee = await this.getEmployee(authUserId);
    if (employee) return employee;

    // Get first site to assign to
    const { data: sites } = await supabase
      .from('sites')
      .select('id')
      .limit(1)
      .single();

    if (!sites) throw new Error('No site configured. Please set up a parking location first.');

    // Create a new employee record linked to this auth user
    const { data, error } = await supabase
      .from('employees')
      .insert({
        auth_user_id: authUserId,
        site_id: sites.id,
        name: email.split('@')[0],
        mobile: '0000000000',
        email,
        role: 'ADMIN',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
