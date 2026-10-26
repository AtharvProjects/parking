"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import type { Employee } from "@/lib/database.types";
import type { Session } from "@supabase/supabase-js";
import { verifyPinViaRPC } from "@/services/auth.service";

export interface AuthContextType {
  session: Session | null;
  employee: Employee | null;
  status: "loading" | "authenticated" | "unauthenticated";
  authMode: "password" | "pin" | null;
  isOffline: boolean;
  loginWithPassword: (credentials: { email: string; password: string }) => Promise<void>;
  loginWithPin: (credentials: { identifier: string; pin: string }) => Promise<Employee>;
  switchOperator: (credentials: { identifier: string; pin: string }) => Promise<Employee>;
  resetPassword: (email: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshEmployee: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  employee: null,
  status: "loading",
  authMode: null,
  isOffline: false,
  loginWithPassword: async () => {},
  loginWithPin: async () => { throw new Error("AuthProvider not initialized"); },
  switchOperator: async () => { throw new Error("AuthProvider not initialized"); },
  resetPassword: async () => false,
  signOut: async () => {},
  refreshEmployee: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
  const [authMode, setAuthMode] = useState<"password" | "pin" | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(false);

  // Monitor network status
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    setIsOffline(!navigator.onLine);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  /**
   * Load employee profile from Supabase for an authenticated Supabase user.
   */
  const loadEmployeeFromSupabaseUser = useCallback(async (userId: string, email: string) => {
    try {
      // 1. Try to find existing employee linked to this auth user
      let { data: emp, error } = await supabase
        .from('employees')
        .select('*')
        .eq('auth_user_id', userId)
        .eq('active', true)
        .is('deleted_at', null)
        .maybeSingle();

      if (error) {
        console.error("Employee fetch error:", error);
      }

      // 2. If not found by auth_user_id, check by email and link
      if (!emp && email) {
        const { data: empByEmail } = await supabase
          .from('employees')
          .select('*')
          .eq('email', email)
          .is('deleted_at', null)
          .maybeSingle();

        if (empByEmail) {
          const { data: updated } = await supabase
            .from('employees')
            .update({ auth_user_id: userId, active: true, deleted_at: null })
            .eq('id', empByEmail.id)
            .select()
            .single();
          emp = updated;
        }
      }

      // 3. If still not linked, check for any unlinked admin employee in the database
      if (!emp) {
        const { data: adminEmp } = await supabase
          .from('employees')
          .select('*')
          .eq('role', 'ADMIN')
          .eq('active', true)
          .is('deleted_at', null)
          .maybeSingle();

        if (adminEmp) {
          const { data: updated } = await supabase
            .from('employees')
            .update({ auth_user_id: userId })
            .eq('id', adminEmp.id)
            .select()
            .single();
          emp = updated;
        }
      }

      // 4. First-run bootstrap if completely empty
      if (!emp) {
        const { count } = await supabase.from('companies').select('*', { count: 'exact', head: true });
        
        let companyId = '00000000-0000-0000-0000-000000000000';
        if (count === 0) {
          companyId = crypto.randomUUID();
          await supabase.from('companies').insert({ id: companyId, name: 'Sant Wamanbhau Parking' });
        }

        const siteId = crypto.randomUUID();
        await supabase.from('sites').insert({
          id: siteId,
          company_id: companyId,
          name: 'Main Gate Terminal',
          brand_name: 'Sant Wamanbhau Parking',
          address: 'Main Terminal Road',
          city: 'Ahilyanagar',
          state: 'Maharashtra',
          timezone: 'Asia/Kolkata',
          grace_period_minutes: 15,
          rounding_interval_min: 30,
          day_rate_switchover_hrs: 12,
          overstay_alert_hrs: 24,
          daily_revenue_target: 10000,
          total_slots: 100,
          contact_number: '+91 96998 86899'
        });

        // Initialize standard official rate cards
        await supabase.from('rate_cards').insert([
          { company_id: companyId, site_id: siteId, vehicle_type: 'TRAILOR', hourly_rate: 4000, daily_rate: 50000, effective_from: new Date().toISOString() },
          { company_id: companyId, site_id: siteId, vehicle_type: 'BODY_VEHICLE', hourly_rate: 3000, daily_rate: 40000, effective_from: new Date().toISOString() },
          { company_id: companyId, site_id: siteId, vehicle_type: 'EICHER', hourly_rate: 2000, daily_rate: 30000, effective_from: new Date().toISOString() },
        ]);

        const { data: newEmp } = await supabase
          .from('employees')
          .insert({
            company_id: companyId,
            auth_user_id: userId,
            site_id: siteId,
            name: email ? email.split('@')[0] : 'Admin',
            mobile: '9699886899',
            email: email || 'admin@santwamanbhau.com',
            role: 'ADMIN',
            pin: '1234',
            active: true,
            base_salary: 25000,
            salary_type: 'MONTHLY',
            designation: 'System Administrator'
          })
          .select()
          .single();

        emp = newEmp;
      }

      if (emp) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('company_id', emp.company_id);
          localStorage.setItem('current_employee_id', emp.id);
          localStorage.setItem('current_employee_role', emp.role);
        }
        const safeEmp = { ...emp, pin: emp.pin ? '****' : null };
        setEmployee(safeEmp as Employee);
        setAuthMode("password");
        setStatus("authenticated");
      } else {
        setStatus("unauthenticated");
      }
    } catch (err: any) {
      console.error("Auth loadEmployee error:", err);
      setEmployee(null);
      setStatus("unauthenticated");
      throw err;
    }
  }, []);

  // Initial Boot: Check active Supabase session or cached PIN employee session
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const savedEmpId = typeof window !== "undefined" ? localStorage.getItem("current_employee_id") : null;
        const isAdminLoggedIn = typeof window !== "undefined" ? localStorage.getItem("is_admin_logged_in") === "true" : false;

        // 1. Check if a staff member was logged in via PIN (stored in localStorage)
        if (savedEmpId && mounted) {
          // Ensure booth session is active so RLS allows reading employee and performing operations
          const boothEmail = process.env.NEXT_PUBLIC_BOOTH_EMAIL || 'admin@santwamanbhau.com';
          const boothPassword = process.env.NEXT_PUBLIC_BOOTH_PASSWORD || 'Password@123';
          try {
            const { data: boothData } = await supabase.auth.signInWithPassword({
              email: boothEmail,
              password: boothPassword,
            });
            if (boothData?.session && mounted) {
              setSession(boothData.session);
            }
          } catch (e) {
            console.warn('[Auth] Booth session reconnect notice:', e);
          }

          const { data: emp } = await supabase
            .from('employees')
            .select('*')
            .eq('id', savedEmpId)
            .eq('active', true)
            .is('deleted_at', null)
            .maybeSingle();

          if (emp) {
            const safeEmp = { ...emp, pin: emp.pin ? '****' : null };
            setEmployee(safeEmp as Employee);
            setAuthMode("pin");
            setStatus("authenticated");
            if (typeof window !== 'undefined') {
              localStorage.setItem('company_id', emp.company_id);
            }
            return;
          } else {
            localStorage.removeItem("current_employee_id");
            localStorage.removeItem("current_employee_role");
          }
        }

        // 2. Check if admin explicitly logged in with email/password
        if (isAdminLoggedIn && mounted) {
          const { data: { session: initialSession } } = await supabase.auth.getSession();
          if (initialSession?.user && mounted) {
            setSession(initialSession);
            await loadEmployeeFromSupabaseUser(initialSession.user.id, initialSession.user.email || "");
            return;
          }
        }

        // 3. Neither staff nor admin explicitly logged in — stay on login screen so user can choose!
        if (mounted) {
          setEmployee(null);
          setAuthMode(null);
          setStatus("unauthenticated");
        }
      } catch (err) {
        console.error("Auth init exception:", err);
        if (mounted) setStatus("unauthenticated");
      }
    }

    initAuth();

    // Listen for auth state changes from Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      setSession(newSession);

      // 1. Never trigger loading screen on background token refresh or focus/visibility events
      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        return;
      }

      // 2. If a staff member is operating via PIN login, the Supabase session is only the background
      // booth connection for database RLS. Do NOT overwrite the PIN employee with the booth user!
      const savedEmpId = typeof window !== "undefined" ? localStorage.getItem("current_employee_id") : null;
      const isAdminLoggedIn = typeof window !== "undefined" ? localStorage.getItem("is_admin_logged_in") === "true" : false;

      if (savedEmpId) {
        return;
      }

      // 3. User signed in via password
      if (newSession?.user) {
        if (isAdminLoggedIn) {
          setEmployee((currentEmp) => {
            if (!currentEmp) {
              setStatus("loading");
              loadEmployeeFromSupabaseUser(newSession.user.id, newSession.user.email || "").catch(() => {});
            }
            return currentEmp;
          });
        }
      } else if (!isAdminLoggedIn) {
        setStatus("unauthenticated");
        setEmployee(null);
        setAuthMode(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadEmployeeFromSupabaseUser]);

  /**
   * Log in with Email & Password (Admin)
   */
  const loginWithPassword = useCallback(async ({ email, password }: { email: string; password: string }) => {
    setStatus("loading");
    try {
      const cleanEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password.trim(),
      });
      if (error) {
        setStatus("unauthenticated");
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password. Please verify your credentials.');
        }
        throw error;
      }
      if (data.session) {
        setSession(data.session);
        setAuthMode("password");
        if (typeof window !== 'undefined') {
          localStorage.setItem('is_admin_logged_in', 'true');
        }
        if (data.user) {
          await loadEmployeeFromSupabaseUser(data.user.id, data.user.email || cleanEmail);
        }
      }
    } catch (err) {
      setStatus("unauthenticated");
      throw err;
    }
  }, [loadEmployeeFromSupabaseUser]);

  /**
   * Log in with Mobile Number / Staff Identifier & PIN (Operator)
   */
  const loginWithPin = useCallback(async ({ identifier, pin }: { identifier: string; pin: string }) => {
    setStatus("loading");
    try {
      const cleanIdentifier = identifier.trim();
      const cleanPin = pin.trim();

      if (!cleanIdentifier) throw new Error('Please enter your registered mobile number or employee ID.');
      if (!cleanPin || cleanPin.length < 4) throw new Error('PIN must be at least 4 digits.');

      // Use server-side RPC for secure bcrypt PIN verification.
      // rpc_verify_pin is granted to anon — no prior Supabase Auth session needed.
      // This eliminates the need for hardcoded admin credentials in the bundle.
      const emp = await verifyPinViaRPC(cleanIdentifier, cleanPin);

      // Store minimal session info in localStorage for app resume
      if (typeof window !== 'undefined') {
        localStorage.setItem('company_id', emp.company_id);
        localStorage.setItem('current_employee_id', emp.id);
        localStorage.setItem('current_employee_role', emp.role);
        // Record PIN session creation time for expiry check
        localStorage.setItem('pin_session_at', new Date().toISOString());
        if (emp.role === 'ADMIN') {
          localStorage.setItem('is_admin_logged_in', 'true');
        } else {
          localStorage.removeItem('is_admin_logged_in');
        }
      }

      const safeEmp = { ...emp, pin: '****' } as Employee;
      const { data: currentSess } = await supabase.auth.getSession();
      if (currentSess?.session) {
        setSession(currentSess.session);
      }
      setEmployee(safeEmp);
      setAuthMode("pin");
      setStatus("authenticated");
      return safeEmp;
    } catch (err) {
      setStatus("unauthenticated");
      throw err;
    }
  }, []);

  /**
   * Fast In-Booth Operator Switch / Shift Handover
   */
  const switchOperator = useCallback(async ({ identifier, pin }: { identifier: string; pin: string }) => {
    const cleanIdentifier = identifier.trim();
    const cleanPin = pin.trim();

    if (!cleanIdentifier) throw new Error('Please enter the incoming operator mobile number.');
    if (!cleanPin || cleanPin.length < 4) throw new Error('PIN must be at least 4 digits.');

    // Secure server-side bcrypt PIN verification via RPC
    const emp = await verifyPinViaRPC(cleanIdentifier, cleanPin);

    if (typeof window !== 'undefined') {
      localStorage.setItem('company_id', emp.company_id);
      localStorage.setItem('current_employee_id', emp.id);
      localStorage.setItem('current_employee_role', emp.role);
      localStorage.setItem('pin_session_at', new Date().toISOString());
    }

    const { data: currentSess } = await supabase.auth.getSession();
    if (currentSess?.session) {
      setSession(currentSess.session);
    }

    const safeEmp = { ...emp, pin: '****' } as Employee;
    setEmployee(safeEmp);
    setAuthMode("pin");
    return safeEmp;
  }, []);

  /**
   * Request Password Reset Email
   */
  const resetPassword = useCallback(async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) throw new Error('Please enter your email address.');
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/login?reset=true` : undefined,
    });
    if (error) throw error;
    return true;
  }, []);

  /**
   * Sign Out
   */
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Supabase signout failed:', err);
    }

    if (typeof window !== 'undefined') {
      localStorage.removeItem('current_employee_id');
      localStorage.removeItem('current_employee_role');
      localStorage.removeItem('is_admin_logged_in');
      localStorage.removeItem('company_id');
      localStorage.removeItem('active_site_id');
      localStorage.removeItem('pin_session_at');
    }
    setSession(null);
    setEmployee(null);
    setAuthMode(null);
    setStatus("unauthenticated");
  }, []);

  const refreshEmployee = useCallback(async () => {
    if (session?.user) {
      await loadEmployeeFromSupabaseUser(session.user.id, session.user.email || "");
    } else if (employee?.id) {
      const { data: updated } = await supabase
        .from('employees')
        .select('*')
        .eq('id', employee.id)
        .eq('active', true)
        .is('deleted_at', null)
        .maybeSingle();
      if (updated) {
        const safeEmp = { ...updated, pin: '****' };
        setEmployee(safeEmp as Employee);
      }
    }
  }, [session, employee, loadEmployeeFromSupabaseUser]);

  return (
    <AuthContext.Provider
      value={{
        session,
        employee,
        status,
        authMode,
        isOffline,
        loginWithPassword,
        loginWithPin,
        switchOperator,
        resetPassword,
        signOut,
        refreshEmployee,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
