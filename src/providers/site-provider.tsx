"use client";

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
import { useAuth } from "./auth-provider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseSitesService } from "@/services/supabase-sites.service";
import type { Site } from "@/lib/database.types";

interface SiteContextType {
  currentSiteId: string;
  currentSite: Site | null;
  authorizedSites: Site[];
  isAdmin: boolean;
  isLoading: boolean;
  switchSite: (siteId: string) => void;
  refreshSites: () => void;
}

const SiteContext = createContext<SiteContextType>({
  currentSiteId: "",
  currentSite: null,
  authorizedSites: [],
  isAdmin: false,
  isLoading: true,
  switchSite: () => {},
  refreshSites: () => {},
});

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

export function SiteProvider({ children }: { children: ReactNode }) {
  const { employee, status } = useAuth();
  const queryClient = useQueryClient();
  const [selectedSiteId, setSelectedSiteId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("active_site_id") || "";
    }
    return "";
  });

  const companyId = employee?.company_id || "";
  const isAdmin = ADMIN_ROLES.includes(employee?.role || "");

  // Fetch all authorized sites from Supabase
  const { data: sites = [], isLoading: isSitesLoading } = useQuery({
    queryKey: ["authorized-sites", companyId],
    queryFn: () => supabaseSitesService.getAuthorizedSites(companyId),
    enabled: !!companyId && status === "authenticated",
    staleTime: 60_000,
  });

  // Declaratively compute active site ID
  const currentSiteId = useMemo(() => {
    if (selectedSiteId === "ALL" && isAdmin) {
      return "ALL";
    }
    if (selectedSiteId && sites.some(s => s.id === selectedSiteId)) {
      return selectedSiteId;
    }
    if (employee?.site_id && sites.some(s => s.id === employee.site_id)) {
      return employee.site_id;
    }
    return sites[0]?.id || "";
  }, [selectedSiteId, isAdmin, sites, employee?.site_id]);

  // Derive current site object
  const currentSite = useMemo(() => {
    return currentSiteId && currentSiteId !== "ALL"
      ? sites.find(s => s.id === currentSiteId) || null
      : null;
  }, [currentSiteId, sites]);

  const switchSite = useCallback((siteId: string) => {
    setSelectedSiteId(siteId);
    if (typeof window !== "undefined") {
      localStorage.setItem("active_site_id", siteId);
    }
    // Invalidate all site-scoped queries immediately
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    queryClient.invalidateQueries({ queryKey: ["active-vehicles"] });
    queryClient.invalidateQueries({ queryKey: ["active-sessions"] });
    queryClient.invalidateQueries({ queryKey: ["reports"] });
    queryClient.invalidateQueries({ queryKey: ["search"] });
    queryClient.invalidateQueries({ queryKey: ["active-rates"] });
  }, [queryClient]);

  const refreshSites = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["authorized-sites"] });
  }, [queryClient]);

  return (
    <SiteContext.Provider
      value={{
        currentSiteId,
        currentSite,
        authorizedSites: sites,
        isAdmin,
        isLoading: isSitesLoading,
        switchSite,
        refreshSites,
      }}
    >
      {children}
    </SiteContext.Provider>
  );
}

export const useSite = () => useContext(SiteContext);
