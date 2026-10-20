/**
 * Supabase-direct employees service.
 * PINs are hashed server-side via trigger — never exposed in queries.
 */
import { supabase } from '@/lib/supabase';
import type { Employee, EmployeeRole, ShiftType } from '@/lib/database.types';

export const supabaseEmployeesService = {
  async getAll(companyId: string, siteId?: string): Promise<(Employee & { site_name?: string })[]> {
    if (!companyId) return [];
    
    let query = supabase
      .from('employees')
      .select('*, site:sites!employees_site_id_fkey(name)')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (siteId && siteId !== 'ALL') {
      query = query.eq('site_id', siteId);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch employees: ${error.message}`);
    
    return (data || []).map((emp: any) => ({
      ...emp,
      site_name: emp.site?.name,
      // Never expose the PIN hash to the client
      pin: emp.pin ? '****' : null,
    }));
  },

  async getAllByCompany(companyId: string): Promise<(Employee & { site_name?: string })[]> {
    return this.getAll(companyId);
  },

  async getById(id: string): Promise<Employee | null> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .eq('active', true)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch employee: ${error.message}`);
    if (data) {
      (data as any).pin = data.pin ? '****' : null;
    }
    return data as Employee | null;
  },

  async getByAuthId(authUserId: string): Promise<Employee | null> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('auth_user_id', authUserId)
      .eq('active', true)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch employee profile: ${error.message}`);
    if (data) {
      (data as any).pin = data.pin ? '****' : null;
    }
    return data as Employee | null;
  },

  async create(companyId: string, siteId: string, data: {
    name: string;
    mobile: string;
    email?: string;
    role: EmployeeRole;
    shift?: ShiftType;
    pin?: string;
    base_salary?: number;
    salary_type?: 'MONTHLY' | 'DAILY' | 'HOURLY';
    designation?: string;
    joining_date?: string;
  }): Promise<Employee> {
    // Check for duplicate mobile
    const { data: existing } = await supabase
      .from('employees')
      .select('id')
      .eq('company_id', companyId)
      .eq('mobile', data.mobile)
      .is('deleted_at', null)
      .maybeSingle();

    if (existing) {
      throw new Error('An operator with this mobile number already exists.');
    }

    const insertPayload: any = {
      company_id: companyId,
      site_id: siteId,
      name: data.name,
      mobile: data.mobile,
      email: data.email || null,
      role: data.role,
      shift: data.shift || null,
      pin: data.pin || null, // Will be hashed by database trigger
      base_salary: data.base_salary !== undefined ? data.base_salary : 0,
      salary_type: data.salary_type || 'MONTHLY',
      designation: data.designation || 'Parking Attendant',
      joining_date: data.joining_date || new Date().toISOString().split('T')[0],
      active: true,
    };

    let { data: employee, error } = await supabase
      .from('employees')
      .insert(insertPayload)
      .select()
      .single();

    // Resilient fallback if base_salary/designation columns are missing in PostgREST schema cache
    if (error && (
      error.message?.includes('base_salary') ||
      error.message?.includes('salary_type') ||
      error.message?.includes('designation') ||
      error.message?.includes('joining_date') ||
      error.details?.includes('base_salary') ||
      (error as any).code === 'PGRST204'
    )) {
      const fallbackPayload = {
        company_id: companyId,
        site_id: siteId,
        name: data.name,
        mobile: data.mobile,
        email: data.email || null,
        role: data.role,
        shift: data.shift || null,
        pin: data.pin || null,
        active: true,
      };

      const retryRes = await supabase
        .from('employees')
        .insert(fallbackPayload)
        .select()
        .single();

      employee = retryRes.data;
      error = retryRes.error;
    }

    if (error) {
      if (error.code === '23505') {
        if (error.message.includes('idx_single_admin_per_company')) {
          throw new Error('Only one Admin is allowed per organization. Please deactivate the existing Admin first.');
        }
        if (error.message.includes('email')) {
          throw new Error('An employee with this email already exists.');
        }
        throw new Error('An employee with these details already exists.');
      }
      if (error.code === '42501') throw new Error('You do not have permission to create employees.');
      throw new Error(`Failed to create employee: ${error.message}`);
    }
    
    // Mask the PIN in the returned object
    if (employee) {
      (employee as any).pin = data.pin ? '****' : null;
      (employee as any).base_salary = data.base_salary || 0;
      (employee as any).salary_type = data.salary_type || 'MONTHLY';
      (employee as any).designation = data.designation || 'Parking Attendant';
      (employee as any).joining_date = data.joining_date || new Date().toISOString().split('T')[0];
    }
    return employee as Employee;
  },

  async update(companyId: string, id: string, data: {
    name?: string;
    mobile?: string;
    email?: string;
    role?: EmployeeRole;
    shift?: ShiftType | null;
    site_id?: string;
    pin?: string;
    base_salary?: number;
    salary_type?: 'MONTHLY' | 'DAILY' | 'HOURLY';
    designation?: string;
    joining_date?: string;
  }): Promise<void> {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.mobile !== undefined) updateData.mobile = data.mobile;
    if (data.email !== undefined) updateData.email = data.email || null;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.shift !== undefined) updateData.shift = data.shift;
    if (data.site_id !== undefined) updateData.site_id = data.site_id;
    if (data.base_salary !== undefined) updateData.base_salary = data.base_salary;
    if (data.salary_type !== undefined) updateData.salary_type = data.salary_type;
    if (data.designation !== undefined) updateData.designation = data.designation;
    if (data.joining_date !== undefined) updateData.joining_date = data.joining_date;
    if (data.pin !== undefined && data.pin !== '' && data.pin !== '****') {
      updateData.pin = data.pin; // Will be hashed by database trigger
    }

    if (Object.keys(updateData).length === 0) return;

    let { error } = await supabase
      .from('employees')
      .update(updateData as any)
      .eq('id', id)
      .eq('company_id', companyId);

    // Resilient fallback for update if salary/designation columns are missing
    if (error && (
      error.message?.includes('base_salary') ||
      error.message?.includes('salary_type') ||
      error.message?.includes('designation') ||
      error.message?.includes('joining_date') ||
      error.details?.includes('base_salary') ||
      (error as any).code === 'PGRST204'
    )) {
      const coreUpdate: any = {};
      if (updateData.name !== undefined) coreUpdate.name = updateData.name;
      if (updateData.mobile !== undefined) coreUpdate.mobile = updateData.mobile;
      if (updateData.email !== undefined) coreUpdate.email = updateData.email;
      if (updateData.role !== undefined) coreUpdate.role = updateData.role;
      if (updateData.shift !== undefined) coreUpdate.shift = updateData.shift;
      if (updateData.site_id !== undefined) coreUpdate.site_id = updateData.site_id;
      if (updateData.pin !== undefined) coreUpdate.pin = updateData.pin;

      const retryRes = await supabase
        .from('employees')
        .update(coreUpdate)
        .eq('id', id)
        .eq('company_id', companyId);

      error = retryRes.error;
    }

    if (error) {
      if (error.code === '23505' && error.message.includes('idx_single_admin_per_company')) {
        throw new Error('Only one Admin is allowed per organization.');
      }
      if (error.code === '42501') throw new Error('You do not have permission to modify employees.');
      throw new Error(`Failed to update employee: ${error.message}`);
    }
  },

  async toggleActive(companyId: string, id: string, active: boolean): Promise<void> {
    const { error } = await supabase
      .from('employees')
      .update({ active })
      .eq('id', id)
      .eq('company_id', companyId);

    if (error) {
      if (error.code === '42501') throw new Error('You do not have permission to modify employees.');
      throw new Error(`Failed to update employee status: ${error.message}`);
    }
  },

  async softDelete(companyId: string, id: string): Promise<void> {
    const { error } = await supabase
      .from('employees')
      .update({ deleted_at: new Date().toISOString(), active: false })
      .eq('id', id)
      .eq('company_id', companyId);

    if (error) {
      if (error.code === '42501') throw new Error('You do not have permission to delete employees.');
      throw new Error(`Failed to delete employee: ${error.message}`);
    }
  },

  async getQuickSelectEmployees(companyId?: string): Promise<Pick<Employee, 'id' | 'name' | 'mobile' | 'role' | 'shift' | 'site_id'>[]> {
    let query = supabase
      .from('employees')
      .select('id, name, mobile, role, shift, site_id')
      .eq('active', true)
      .is('deleted_at', null)
      .not('pin', 'is', null)
      .order('name', { ascending: true });

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Failed to fetch quick select employees:', error);
      return [];
    }
    return (data || []) as any[];
  },
};
