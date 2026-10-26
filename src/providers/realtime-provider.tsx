"use client";

/**
 * Centralized Supabase Realtime subscription provider.
 *
 * Subscribes to all relevant table changes for the company and
 * invalidates React Query caches so all devices (Android, iOS, iPadOS, Web)
 * stay in instant real-time sync with photos, sessions, and payments.
 *
 * RESILIENCE FEATURES:
 * - Listens to Capacitor appStateChange on native devices (iOS, iPadOS, Android)
 *   to immediately reconnect and refresh data upon app resume/unlock.
 * - Listens to window online & visibilitychange for seamless background/foreground recovery.
 * - Auto-retries websocket reconnection on CHANNEL_ERROR or TIMED_OUT.
 * - Refreshes active-vehicles, active-sessions, dashboard-stats, reports, and revenue-chart.
 */
import React, { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import { useQueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

interface RealtimeContextType {
  isConnected: boolean;
  connectionStatus: "CONNECTING" | "SUBSCRIBED" | "CLOSED" | "CHANNEL_ERROR" | "TIMED_OUT";
  reconnect: () => void;
}

const RealtimeContext = createContext<RealtimeContextType>({
  isConnected: false,
  connectionStatus: "CLOSED",
  reconnect: () => {},
});

export const useRealtime = () => useContext(RealtimeContext);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { employee, status } = useAuth();
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<RealtimeContextType["connectionStatus"]>("CLOSED");

  // Invalidate all active queries to ensure total cross-device sync
  const invalidateAllQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["active-vehicles"] });
    queryClient.invalidateQueries({ queryKey: ["active-sessions"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    queryClient.invalidateQueries({ queryKey: ["reports"] });
    queryClient.invalidateQueries({ queryKey: ["search"] });
    queryClient.invalidateQueries({ queryKey: ["revenue-chart"] });
    queryClient.invalidateQueries({ queryKey: ["sites"] });
    queryClient.invalidateQueries({ queryKey: ["employees"] });
    queryClient.invalidateQueries({ queryKey: ["active-rates"] });
  }, [queryClient]);

  const resolvedCompanyId =
    employee?.company_id ||
    (typeof window !== "undefined" ? localStorage.getItem("company_id") : null) ||
    "00000000-0000-0000-0000-000000000000";

  const setupChannel = useCallback(() => {
    if (status === "unauthenticated" && !resolvedCompanyId) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        setIsConnected(false);
        setConnectionStatus("CLOSED");
      }
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setConnectionStatus("CONNECTING");

    const channelName = `vertix-realtime-${resolvedCompanyId}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "parking_sessions", filter: `company_id=eq.${resolvedCompanyId}` },
        (_payload) => {
          // Session changed (entry/exit/photos updated) — invalidate all session views
          queryClient.invalidateQueries({ queryKey: ["active-vehicles"] });
          queryClient.invalidateQueries({ queryKey: ["active-sessions"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
          queryClient.invalidateQueries({ queryKey: ["reports"] });
          queryClient.invalidateQueries({ queryKey: ["search"] });
          queryClient.invalidateQueries({ queryKey: ["revenue-chart"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments" },
        (_payload) => {
          queryClient.invalidateQueries({ queryKey: ["active-vehicles"] });
          queryClient.invalidateQueries({ queryKey: ["active-sessions"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
          queryClient.invalidateQueries({ queryKey: ["reports"] });
          queryClient.invalidateQueries({ queryKey: ["search"] });
          queryClient.invalidateQueries({ queryKey: ["revenue-chart"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sites", filter: `company_id=eq.${resolvedCompanyId}` },
        (_payload) => {
          queryClient.invalidateQueries({ queryKey: ["sites"] });
          queryClient.invalidateQueries({ queryKey: ["all-sites"] });
          queryClient.invalidateQueries({ queryKey: ["authorized-sites"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "employees", filter: `company_id=eq.${resolvedCompanyId}` },
        (_payload) => {
          queryClient.invalidateQueries({ queryKey: ["employees"] });
          queryClient.invalidateQueries({ queryKey: ["all-employees"] });
          queryClient.invalidateQueries({ queryKey: ["quick-select-employees"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rate_cards", filter: `company_id=eq.${resolvedCompanyId}` },
        (_payload) => {
          queryClient.invalidateQueries({ queryKey: ["active-rates"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "staff_attendance", filter: `company_id=eq.${resolvedCompanyId}` },
        (_payload) => {
          queryClient.invalidateQueries({ queryKey: ["staff-attendance"] });
          queryClient.invalidateQueries({ queryKey: ["attendance"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "staff_transactions", filter: `company_id=eq.${resolvedCompanyId}` },
        (_payload) => {
          queryClient.invalidateQueries({ queryKey: ["staff-transactions"] });
          queryClient.invalidateQueries({ queryKey: ["payroll"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "audit_logs", filter: `company_id=eq.${resolvedCompanyId}` },
        (_payload) => {
          queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
        }
      )
      .subscribe((channelStatus) => {
        const connected = channelStatus === "SUBSCRIBED";
        setIsConnected(connected);
        setConnectionStatus(channelStatus as RealtimeContextType["connectionStatus"]);

        if (connected) {
          console.log("[Realtime] Connected to company channel:", resolvedCompanyId);
        } else if (channelStatus === "CLOSED") {
          console.log("[Realtime] Channel closed — scheduling reconnect");
          reconnectTimeoutRef.current = setTimeout(() => setupChannel(), 3000);
        } else if (channelStatus === "CHANNEL_ERROR") {
          console.error("[Realtime] Channel error — retrying in 4s");
          reconnectTimeoutRef.current = setTimeout(() => setupChannel(), 4000);
        } else if (channelStatus === "TIMED_OUT") {
          console.warn("[Realtime] Channel timed out — retrying in 3s");
          reconnectTimeoutRef.current = setTimeout(() => setupChannel(), 3000);
        }
      });

    channelRef.current = channel;
  }, [resolvedCompanyId, status, queryClient]);

  // Initial mount & status change
  useEffect(() => {
    setupChannel();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        setIsConnected(false);
        setConnectionStatus("CLOSED");
      }
    };
  }, [setupChannel]);

  // Native & Browser Foreground and Reconnect Handlers
  useEffect(() => {
    const handleResumeOrOnline = () => {
      console.log("[Realtime] App resumed / online detected — re-verifying connection & syncing data");
      invalidateAllQueries();
      if (!channelRef.current || connectionStatus !== "SUBSCRIBED") {
        setupChannel();
      }
    };

    // 1. Capacitor Native App State Listener (iOS, iPadOS, Android)
    let appStateHandle: any = null;
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener("appStateChange", ({ isActive }) => {
        if (isActive) {
          handleResumeOrOnline();
        }
      }).then((h) => {
        appStateHandle = h;
      }).catch(() => {});
    }

    // 2. Web / PWA Document Visibility & Online Listeners
    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        handleResumeOrOnline();
      }
    };

    const handleWindowFocus = () => {
      handleResumeOrOnline();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("online", handleResumeOrOnline);
      window.addEventListener("focus", handleWindowFocus);
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      if (appStateHandle) {
        appStateHandle.remove();
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleResumeOrOnline);
        window.removeEventListener("focus", handleWindowFocus);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [connectionStatus, invalidateAllQueries, setupChannel]);

  return (
    <RealtimeContext.Provider value={{ isConnected, connectionStatus, reconnect: setupChannel }}>
      {children}
    </RealtimeContext.Provider>
  );
}
