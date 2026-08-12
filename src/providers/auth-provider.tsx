"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { authService } from "@/services/auth.service";
import type { Employee } from "@/lib/database.types";
import type { Session } from "@supabase/supabase-js";
import { AuthRepository } from "@/database/repositories/AuthRepository";
import { SyncEngine } from "@/sync/engine";

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

  const loadEmployeeFromSupabaseUser = useCallback(async (userId: string, email: string) => {
    try {
      let emp: Employee | null = null;
      if (typeof navigator !== "undefined" && navigator.onLine) {
        emp = await authService.getOrCreateEmployee(userId, email);
        if (emp) {
          await authService.syncEmployeeContext(emp);
        }
      } else {
        emp = await AuthRepository.getEmployeeByAuthId(userId);
        if (emp) {
          localStorage.setItem("company_id", emp.company_id);
          localStorage.setItem("current_employee_id", emp.id);
          localStorage.setItem("current_employee_role", emp.role);
          SyncEngine.startBackgroundSync(emp.company_id);
        }
      }

      if (emp) {
        setEmployee(emp);
        setAuthMode("password");
        setStatus("authenticated");
      } else {
        setStatus("unauthenticated");
      }
    } catch (err: any) {
      console.error("Auth loadEmployee error:", err);
      // If we couldn't load employee from Supabase, try local storage fallback
      const savedEmpId = typeof window !== "undefined" ? localStorage.getItem("current_employee_id") : null;
      if (savedEmpId) {
        const localEmp = await authService.getEmployeeById(savedEmpId);
        if (localEmp) {
          setEmployee(localEmp);
          setStatus("authenticated");
          return;
        }
      }
      setEmployee(null);
      setStatus("unauthenticated");
    }
  }, []);

  // Initial Boot: Check active Supabase session or cached PIN employee session
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        // 1. Check Supabase session
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (initialSession?.user && mounted) {
          setSession(initialSession);
          await loadEmployeeFromSupabaseUser(initialSession.user.id, initialSession.user.email || "");
          return;
        }

        // 2. Check if a staff member was logged in via PIN
        const savedEmpId = typeof window !== "undefined" ? localStorage.getItem("current_employee_id") : null;
        if (savedEmpId && mounted) {
          const emp = await authService.getEmployeeById(savedEmpId);
          if (emp && emp.active) {
            setEmployee(emp);
            setAuthMode("pin");
            setStatus("authenticated");
            if (emp.company_id) {
              SyncEngine.startBackgroundSync(emp.company_id);
            }
            return;
          }
        }

        if (mounted) {
          setStatus("unauthenticated");
        }
      } catch (err) {
        console.error("Auth init exception:", err);
        if (mounted) setStatus("unauthenticated");
      }
    }

    initAuth();

    // Listen for auth state changes from Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      if (newSession?.user) {
        setStatus("loading");
        await loadEmployeeFromSupabaseUser(newSession.user.id, newSession.user.email || "");
      } else if (!localStorage.getItem("current_employee_id")) {
        setStatus("unauthenticated");
        setEmployee(null);
        setAuthMode(null);
        SyncEngine.stopBackgroundSync();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      SyncEngine.stopBackgroundSync();
    };
  }, [loadEmployeeFromSupabaseUser]);

  /**
   * Log in with Email & Password (Admin / Manager)
   */
  const loginWithPassword = useCallback(async ({ email, password }: { email: string; password: string }) => {
    setStatus("loading");
    try {
      const data = await authService.signIn(email, password);
      if (data.session) {
        setSession(data.session);
        setAuthMode("password");
        if (data.user) {
          await loadEmployeeFromSupabaseUser(data.user.id, data.user.email || email);
        }
      }
    } catch (err) {
      setStatus("unauthenticated");
      throw err;
    }
  }, [loadEmployeeFromSupabaseUser]);

  /**
   * Log in with Mobile Number / Staff Identifier & PIN (Gate Operator / Attendant)
   */
  const loginWithPin = useCallback(async ({ identifier, pin }: { identifier: string; pin: string }) => {
    setStatus("loading");
    try {
      const emp = await authService.signInWithPin(identifier, pin);
      setEmployee(emp);
      setAuthMode("pin");
      setStatus("authenticated");
      return emp;
    } catch (err) {
      setStatus("unauthenticated");
      throw err;
    }
  }, []);

  /**
   * Fast In-Booth Operator Switch / Shift Handover
   */
  const switchOperator = useCallback(async ({ identifier, pin }: { identifier: string; pin: string }) => {
    const emp = await authService.signInWithPin(identifier, pin);
    setEmployee(emp);
    setAuthMode("pin");
    return emp;
  }, []);

  /**
   * Request Password Reset Email
   */
  const resetPassword = useCallback(async (email: string) => {
    return await authService.resetPassword(email);
  }, []);

  /**
   * Sign Out
   */
  const signOut = useCallback(async () => {
    await authService.signOut();
    setSession(null);
    setEmployee(null);
    setAuthMode(null);
    setStatus("unauthenticated");
    SyncEngine.stopBackgroundSync();
  }, []);

  const refreshEmployee = useCallback(async () => {
    if (session?.user) {
      await loadEmployeeFromSupabaseUser(session.user.id, session.user.email || "");
    } else if (employee?.id) {
      const updated = await authService.getEmployeeById(employee.id);
      if (updated) setEmployee(updated);
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
