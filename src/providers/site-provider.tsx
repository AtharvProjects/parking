"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from "react";
import { useAuth } from "@/providers/auth-provider";
import { sitesService } from "@/services/sites.service";
import type { Site } from "@/lib/database.types";
import { useQueryClient } from "@tanstack/react-query";

export interface SiteContextType {
  currentSite: Site | null;
  currentSiteId: string;
  authorizedSites: Site[];
  isLoadingSites: boolean;
  switchSite: (siteId: string) => void;
  canAccessSite: (siteId: string) => boolean;
  refreshSites: () => Promise<void>;
  isAdmin: boolean;
}

const SiteContext = createContext<SiteContextType>({
  currentSite: null,
  currentSiteId: "",
  authorizedSites: [],
  isLoadingSites: true,
  switchSite: () => {},
  canAccessSite: () => false,
  refreshSites: async () => {},
  isAdmin: false,
});

export function SiteProvider({ children }: { children: ReactNode }) {
  const { employee, status } = useAuth();
  const queryClient = useQueryClient();
  const [authorizedSites, setAuthorizedSites] = useState<Site[]>([]);
  const [currentSiteId, setCurrentSiteId] = useState<string>("");
  const [isLoadingSites, setIsLoadingSites] = useState<boolean>(true);

  const isAdmin = useMemo(() => {
    return employee?.role === "ADMIN" || employee?.role === "SUPER_ADMIN" || employee?.role === "MANAGER";
  }, [employee?.role]);

  const canAccessSite = useCallback((siteId: string) => {
    if (!siteId) return false;
    if (isAdmin) return true; // Admins have company-wide authorization
    if (siteId === "ALL") return isAdmin;
    return authorizedSites.some((s) => s.id === siteId);
  }, [isAdmin, authorizedSites]);

  const loadAuthorizedSites = useCallback(async () => {
    if (!employee || status !== "authenticated") {
      setAuthorizedSites([]);
      setCurrentSiteId("");
      setIsLoadingSites(false);
      return;
    }

    try {
      setIsLoadingSites(true);
      const sites = await sitesService.getAuthorizedSites(employee);
      setAuthorizedSites(sites);

      // Determine active site ID from localStorage or fallback
      const savedSiteId = typeof window !== "undefined" ? localStorage.getItem("active_site_id") : null;
      let targetSiteId = "";

      if (savedSiteId && (savedSiteId === "ALL" ? isAdmin : sites.some(s => s.id === savedSiteId))) {
        targetSiteId = savedSiteId;
      } else if (employee.site_id && sites.some(s => s.id === employee.site_id)) {
        targetSiteId = employee.site_id;
      } else if (sites.length > 0) {
        targetSiteId = sites[0].id;
      } else if (isAdmin) {
        targetSiteId = "ALL";
      }

      setCurrentSiteId(targetSiteId);
      if (targetSiteId && typeof window !== "undefined") {
        localStorage.setItem("active_site_id", targetSiteId);
      }
    } catch (err) {
      console.error("Failed to load authorized sites:", err);
    } finally {
      setIsLoadingSites(false);
    }
  }, [employee, status, isAdmin]);

  useEffect(() => {
    loadAuthorizedSites();
  }, [loadAuthorizedSites]);

  const switchSite = useCallback((siteId: string) => {
    if (siteId !== "ALL" && !canAccessSite(siteId)) {
      console.warn(`Unauthorized attempt to switch to site ${siteId}`);
      return;
    }
    if (siteId === "ALL" && !isAdmin) {
      console.warn("Unauthorized attempt to select all sites");
      return;
    }

    setCurrentSiteId(siteId);
    if (typeof window !== "undefined") {
      localStorage.setItem("active_site_id", siteId);
    }

    // Invalidate all site-dependent queries across the UI
    queryClient.invalidateQueries({ queryKey: ["active-vehicles"] });
    queryClient.invalidateQueries({ queryKey: ["active-sessions"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    queryClient.invalidateQueries({ queryKey: ["active-rates"] });
    queryClient.invalidateQueries({ queryKey: ["reports"] });
    queryClient.invalidateQueries({ queryKey: ["search"] });
  }, [canAccessSite, isAdmin, queryClient]);

  const currentSite = useMemo(() => {
    if (!currentSiteId || currentSiteId === "ALL") return null;
    return authorizedSites.find((s) => s.id === currentSiteId) || null;
  }, [currentSiteId, authorizedSites]);

  return (
    <SiteContext.Provider
      value={{
        currentSite,
        currentSiteId,
        authorizedSites,
        isLoadingSites,
        switchSite,
        canAccessSite,
        refreshSites: loadAuthorizedSites,
        isAdmin,
      }}
    >
      {children}
    </SiteContext.Provider>
  );
}

export const useSite = () => useContext(SiteContext);
