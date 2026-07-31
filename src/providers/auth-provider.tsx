"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { authService } from "@/services/auth.service";
import type { Employee } from "@/lib/database.types";
import type { Session } from "@supabase/supabase-js";

interface AuthContextType {
  session: Session | null;
  employee: Employee | null;
  status: "loading" | "authenticated" | "unauthenticated";
  signOut: () => Promise<void>;
  refreshEmployee: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  employee: null,
  status: "loading",
  signOut: async () => {},
  refreshEmployee: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");

  const loadEmployee = useCallback(async (userId: string, email: string) => {
    try {
      const emp = await authService.getOrCreateEmployee(userId, email);
      setEmployee(emp);
    } catch {
      setEmployee(null);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        setStatus("authenticated");
        loadEmployee(session.user.id, session.user.email || "");
      } else {
        setStatus("unauthenticated");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        setStatus("authenticated");
        loadEmployee(session.user.id, session.user.email || "");
      } else {
        setStatus("unauthenticated");
        setEmployee(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadEmployee]);

  const signOut = useCallback(async () => {
    await authService.signOut();
    setSession(null);
    setEmployee(null);
    setStatus("unauthenticated");
  }, []);

  const refreshEmployee = useCallback(async () => {
    if (session?.user) {
      await loadEmployee(session.user.id, session.user.email || "");
    }
  }, [session, loadEmployee]);

  return (
    <AuthContext.Provider value={{ session, employee, status, signOut, refreshEmployee }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
