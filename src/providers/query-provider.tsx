"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect, type ReactNode } from "react";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 2,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  useEffect(() => {
    const handleSyncCompleted = (e: any) => {
      const tables = e.detail?.tables as string[] | undefined;
      if (!tables) {
        // Fallback: invalidate all if we don't know what changed
        client.invalidateQueries();
        return;
      }

      if (tables.includes('sites')) {
        client.invalidateQueries({ queryKey: ['site'] });
        client.invalidateQueries({ queryKey: ['sites'] });
        client.invalidateQueries({ queryKey: ['all-sites'] });
      }
      if (tables.includes('rate_cards')) {
        client.invalidateQueries({ queryKey: ['active-rates'] });
      }
      if (tables.includes('employees')) {
        client.invalidateQueries({ queryKey: ['employees'] });
        client.invalidateQueries({ queryKey: ['all-employees'] });
      }
      if (tables.includes('parking_sessions') || tables.includes('payments')) {
        client.invalidateQueries({ queryKey: ['active-vehicles'] });
        client.invalidateQueries({ queryKey: ['active-sessions'] });
        client.invalidateQueries({ queryKey: ['dashboard-stats'] });
        client.invalidateQueries({ queryKey: ['reports'] });
        client.invalidateQueries({ queryKey: ['search'] });
      }
    };

    window.addEventListener("sync_completed", handleSyncCompleted);
    return () => window.removeEventListener("sync_completed", handleSyncCompleted);
  }, [client]);


  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
