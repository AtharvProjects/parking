/**
 * Auth Service — Thin adapter, retained for page-level imports.
 * Delegates to Supabase direct table operations.
 */
import { supabase } from '@/lib/supabase';
import { supabaseEmployeesService } from '@/services/supabase-employees.service';

export async function findEmployeeByIdentifier(identifier: string) {
  const cleanIdentifier = identifier.trim();
  if (!cleanIdentifier) return null;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanIdentifier);
  
  // 1. Try mobile exact match first (standard operator flow)
  const { data: byMobile } = await supabase
    .from('employees')
    .select('*')
    .eq('mobile', cleanIdentifier)
    .eq('active', true)
    .is('deleted_at', null)
    .maybeSingle();

  if (byMobile) return byMobile;

  // 2. If UUID, search by ID
  if (isUuid) {
    const { data: byId } = await supabase
      .from('employees')
      .select('*')
      .eq('id', cleanIdentifier)
      .eq('active', true)
      .is('deleted_at', null)
      .maybeSingle();
    if (byId) return byId;
  }

  // 3. Search by email
  if (cleanIdentifier.includes('@')) {
    const { data: byEmail } = await supabase
      .from('employees')
      .select('*')
      .eq('email', cleanIdentifier.toLowerCase())
      .eq('active', true)
      .is('deleted_at', null)
      .maybeSingle();
    if (byEmail) return byEmail;
  }

  // 4. Case-insensitive Name search fallback (e.g. "Nana", "Ramesh kaka")
  const { data: byName } = await supabase
    .from('employees')
    .select('*')
    .ilike('name', cleanIdentifier)
    .eq('active', true)
    .is('deleted_at', null)
    .maybeSingle();

  return byName || null;
}

export const authService = {
  async loginWithPin(identifier: string, pin: string) {
    const cleanIdentifier = identifier.trim();
    const cleanPin = pin.trim();

    if (!cleanIdentifier) {
      throw new Error('Please enter your registered mobile number or staff ID.');
    }
    if (!cleanPin || cleanPin.length < 4) {
      throw new Error('PIN must be at least 4 digits.');
    }

    // Ensure we have a valid Supabase Auth session for table permissions
    const { data: currentSession } = await supabase.auth.getSession();
    if (!currentSession?.session?.user) {
      try {
        await supabase.auth.signInWithPassword({
          email: 'admin@santwamanbhau.com',
          password: 'Password@123'
        });
      } catch (authErr) {
        console.warn('Background Supabase auth fallback notice:', authErr);
      }
    }

    const emp = await findEmployeeByIdentifier(cleanIdentifier);
    if (!emp) {
      throw new Error('Employee not found. Please check your mobile number or ID.');
    }

    if (!emp.pin || (emp.pin.trim() !== cleanPin && emp.pin !== cleanPin)) {
      throw new Error('Invalid PIN. Please try again.');
    }

    return { ...emp, pin: '****' };
  },

  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password: password.trim(),
    });
    if (error) throw error;
    return data;
  },

  async getQuickSelectEmployees() {
    return supabaseEmployeesService.getQuickSelectEmployees();
  },

  async getEmployeeById(id: string) {
    return supabaseEmployeesService.getById(id);
  },
};
