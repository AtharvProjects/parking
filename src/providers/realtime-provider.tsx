"use client";

/**
 * Centralized Supabase Realtime subscription provider.
 * Subscribes to all relevant table changes for the company and
 * invalidates React Query caches so all components auto-refresh.
 */
import React, { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import { useQueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface RealtimeContextType {
  isConnected: boolean;
}

const RealtimeContext = createContext<RealtimeContextType>({ isConnected: false });

export const useRealtime = () => useContext(RealtimeContext);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { employee, status } = useAuth();
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isConnectedRef = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || !employee?.company_id) {
      // Cleanup if not authenticated
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        isConnectedRef.current = false;
      }
      return;
    }

    const companyId = employee.company_id;
    const channelName = `realtime-${companyId}`;

    // Remove existing channel if any
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Create a single channel with listeners for all relevant tables
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "parking_sessions", filter: `company_id=eq.${companyId}` },
        (_payload) => {
          // Invalidate all session-related queries
          queryClient.invalidateQueries({ queryKey: ["active-vehicles"] });
          queryClient.invalidateQueries({ queryKey: ["active-sessions"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
          queryClient.invalidateQueries({ queryKey: ["reports"] });
          queryClient.invalidateQueries({ queryKey: ["search"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments" },
        (_payload) => {
          // Payments changed — affects dashboard revenue and reports
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
          queryClient.invalidateQueries({ queryKey: ["reports"] });
          queryClient.invalidateQueries({ queryKey: ["search"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sites", filter: `company_id=eq.${companyId}` },
        (_payload) => {
          queryClient.invalidateQueries({ queryKey: ["sites"] });
          queryClient.invalidateQueries({ queryKey: ["all-sites"] });
          queryClient.invalidateQueries({ queryKey: ["authorized-sites"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "employees", filter: `company_id=eq.${companyId}` },
        (_payload) => {
          queryClient.invalidateQueries({ queryKey: ["employees"] });
          queryClient.invalidateQueries({ queryKey: ["all-employees"] });
          queryClient.invalidateQueries({ queryKey: ["quick-select-employees"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rate_cards", filter: `company_id=eq.${companyId}` },
        (_payload) => {
          queryClient.invalidateQueries({ queryKey: ["active-rates"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "audit_logs", filter: `company_id=eq.${companyId}` },
        (_payload) => {
          queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
        }
      )
      .subscribe((status) => {
        isConnectedRef.current = status === "SUBSCRIBED";
        if (status === "SUBSCRIBED") {
          console.log("[Realtime] Connected to company channel:", companyId);
        } else if (status === "CLOSED") {
          console.log("[Realtime] Channel closed");
        } else if (status === "CHANNEL_ERROR") {
          console.error("[Realtime] Channel error — will auto-retry");
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        isConnectedRef.current = false;
      }
    };
  }, [employee?.company_id, status, queryClient]);

  return (
    <RealtimeContext.Provider value={{ isConnected: isConnectedRef.current }}>
      {children}
    </RealtimeContext.Provider>
  );
}
