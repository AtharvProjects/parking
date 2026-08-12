import { supabase } from '@/lib/supabase';
import type { Employee } from '@/lib/database.types';
import { AuthRepository } from '@/database/repositories/AuthRepository';
import { EmployeeRepository } from '@/database/repositories/EmployeeRepository';
import { SyncEngine } from '@/sync/engine';

export interface AuthState {
  user: { id: string; email: string } | null;
  employee: Employee | null;
  isLoading: boolean;
}

export const authService = {
  /**
   * Email/Password Sign-In (For Admins & Managers)
   */
  async signIn(email: string, password: string) {
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: password.trim(),
    });
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('Invalid email or password. Please verify your credentials.');
      }
      throw error;
    }
    return data;
  },

  /**
   * New Account Sign-Up
   */
  async signUp(email: string, password: string) {
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: password.trim(),
    });
    if (error) throw error;
    return data;
  },

  /**
   * Password Reset Request via Email
   */
  async resetPassword(email: string) {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      throw new Error('Please enter your email address to reset your password.');
    }
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/login?reset=true` : undefined,
    });
    if (error) throw error;
    return true;
  },

  /**
   * Fast Security PIN Sign-In (For Field Operators & Booth Attendants)
   * Supports both Online Supabase validation and complete Offline SQLite authentication.
   */
  async signInWithPin(identifier: string, pin: string): Promise<Employee> {
    const cleanIdentifier = identifier.trim();
    const cleanPin = pin.trim();

    if (!cleanIdentifier) {
      throw new Error('Please enter your registered mobile number or employee ID.');
    }
    if (!cleanPin || cleanPin.length < 4) {
      throw new Error('PIN must be at least 4 digits.');
    }

    let employee: Employee | null = null;

    // 1. Try online Supabase check if connected
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('employees')
          .select('*')
          .or(`mobile.eq.${cleanIdentifier},email.eq.${cleanIdentifier},id.eq.${cleanIdentifier}`)
          .eq('pin', cleanPin)
          .eq('active', true)
          .maybeSingle();

        if (error) {
          console.warn('Supabase PIN check warning:', error.message);
        } else if (data) {
          employee = data as Employee;
        }
      } catch (onlineErr) {
        console.warn('Online PIN verification failed, falling back to local SQLite:', onlineErr);
      }
    }

    // 2. If online check did not succeed or device is offline, check local SQLite
    if (!employee) {
      try {
        employee = await EmployeeRepository.verifyPin(cleanIdentifier, cleanPin);
      } catch (localErr) {
        console.error('Local SQLite PIN verification error:', localErr);
      }
    }

    if (!employee) {
      throw new Error('Invalid Mobile Number or Security PIN. Please try again or contact your admin.');
    }

    // 3. Cache employee & site context
    await this.syncEmployeeContext(employee);

    return employee;
  },

  /**
   * Helper to sync and cache company, site, and start background sync for an employee
   */
  async syncEmployeeContext(employee: Employee) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('company_id', employee.company_id);
      localStorage.setItem('current_employee_id', employee.id);
      localStorage.setItem('current_employee_role', employee.role);
    }

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const { data: company } = await supabase.from('companies').select('*').eq('id', employee.company_id).single();
        if (company) await AuthRepository.upsertCompany(company);
      } catch (e) {
        console.warn('Failed to fetch company:', e);
      }

      try {
        const { data: site } = await supabase.from('sites').select('*').eq('id', employee.site_id).single();
        if (site) await AuthRepository.upsertSite(site);
      } catch (e) {
        console.warn('Failed to fetch site:', e);
      }

      try {
        await AuthRepository.upsertEmployee(employee);
      } catch (e) {
        console.warn('Failed to upsert employee to SQLite:', e);
      }

      SyncEngine.startBackgroundSync(employee.company_id);
    }
  },

  /**
   * Sign Out
   */
  async signOut() {
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('Supabase signout failed (safe to ignore if offline):', err);
    }

    if (typeof window !== 'undefined') {
      localStorage.removeItem('current_employee_id');
      localStorage.removeItem('current_employee_role');
    }
    SyncEngine.stopBackgroundSync();
  },

  /**
   * Fetch Quick Select Employees for PIN entry screen
   */
  async getQuickSelectEmployees() {
    try {
      return await EmployeeRepository.getEmployeesForQuickSelect();
    } catch (e) {
      console.warn('Failed to get quick select employees:', e);
      return [];
    }
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

  async getEmployeeById(id: string): Promise<Employee | null> {
    // Check local first
    try {
      const localEmp = await EmployeeRepository.getEmployeeById(id);
      if (localEmp) return localEmp;
    } catch (e) {
      console.warn('Local employee lookup warning:', e);
    }

    // Check remote if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('id', id)
        .eq('active', true)
        .maybeSingle();
      if (!error && data) return data as Employee;
    }

    return null;
  },

  async getOrCreateEmployee(authUserId: string, email: string): Promise<Employee> {
    // Try to find existing employee
    let employee = await this.getEmployee(authUserId);
    if (employee) return employee;

    // Check if there is an invited/pending employee with this email
    const { data: existingByEmail } = await supabase
      .from('employees')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (existingByEmail) {
      // Link auth_user_id and activate
      const { data: updatedEmployee, error } = await supabase
        .from('employees')
        .update({ auth_user_id: authUserId, active: true })
        .eq('id', existingByEmail.id)
        .select()
        .single();
      
      if (error) throw error;
      return updatedEmployee as Employee;
    }

    // Security: Only allow creating a new company/admin if NO companies exist at all (first-run bootstrap)
    const { count } = await supabase.from('companies').select('*', { count: 'exact', head: true });
    
    if (count !== null && count > 0) {
      throw new Error("No employee profile found for this account. Please ask your administrator to invite or add you as a team member.");
    }

    // --- FIRST RUN BOOTSTRAP ONLY ---
    const companyId = crypto.randomUUID();
    await supabase.from('companies').insert({ id: companyId, name: 'Sant Wamanbhau Parking' });

    // Create a default site
    const siteId = crypto.randomUUID();
    await supabase.from('sites').insert({
      id: siteId,
      company_id: companyId,
      name: 'Main Gate Terminal',
      brand_name: 'Sant Wamanbhau Parking',
      address: 'Main Terminal Road',
      city: 'Pune',
      state: 'Maharashtra',
      timezone: 'Asia/Kolkata',
      grace_period_minutes: 15,
      rounding_interval_min: 30,
      day_rate_switchover_hrs: 12,
      overstay_alert_hrs: 24,
      daily_revenue_target: 10000,
      total_slots: 100
    });

    // Create default rates
    await supabase.from('rate_cards').insert([
      { company_id: companyId, site_id: siteId, vehicle_type: 'TRAILOR', hourly_rate: 5000, daily_rate: 50000, effective_from: new Date().toISOString() },
      { company_id: companyId, site_id: siteId, vehicle_type: 'BODY_VEHICLE', hourly_rate: 3000, daily_rate: 30000, effective_from: new Date().toISOString() },
      { company_id: companyId, site_id: siteId, vehicle_type: 'EICHER', hourly_rate: 2000, daily_rate: 20000, effective_from: new Date().toISOString() },
    ]);

    // Create the admin employee
    const payload: any = {
      company_id: companyId,
      auth_user_id: authUserId,
      site_id: siteId,
      name: email.split('@')[0] || 'Admin',
      mobile: '9999999999',
      email,
      role: 'ADMIN',
      pin: '1234',
    };

    const { data, error } = await supabase
      .from('employees')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
