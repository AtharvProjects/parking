"use client";

import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { useState, useEffect, type ReactNode } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5_000, // 5s ensures rapid sync across multiple devices
            retry: 2,
            refetchOnWindowFocus: true, // Auto refetch when switching back to app
            refetchOnReconnect: true, // Auto refetch when reconnecting to network
          },
        },
      })
  );

  useEffect(() => {
    // Sync React Query focus with native Capacitor App state (iOS, iPadOS, Android)
    if (Capacitor.isNativePlatform()) {
      let handle: any = null;
      CapacitorApp.addListener("appStateChange", ({ isActive }) => {
        focusManager.setFocused(isActive);
      }).then((h) => {
        handle = h;
      }).catch(() => {});

      return () => {
        if (handle) {
          handle.remove();
        }
      };
    }
  }, []);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
