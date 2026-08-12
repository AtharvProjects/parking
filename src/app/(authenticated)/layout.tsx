"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useSite } from "@/providers/site-provider";
import { SiteSwitcherModal } from "@/components/site-switcher-modal";
import {
  Plus,
  Car,
  BarChart3,
  Activity,
  ParkingCircle,
  Settings,
  WifiOff,
  ChevronDown,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { hasPermission, type AppFeature, ROLE_CONFIG, SHIFT_CONFIG } from "@/lib/constants";
import type { EmployeeRole, ShiftType } from "@/lib/database.types";
import { OperatorSwitchModal } from "@/components/operator-switch-modal";

const NAV_ITEMS: { href: string; icon: any; label: string; isAction?: boolean; requiredFeature?: AppFeature }[] = [
  { href: "/dashboard", icon: Activity, label: "Activity", requiredFeature: "DASHBOARD" },
  { href: "/search", icon: ParkingCircle, label: "Parking", requiredFeature: "SEARCH" },
  { href: "/gate", icon: Plus, label: "Entry", isAction: true, requiredFeature: "GATE_ENTRY" },
  { href: "/gate/active", icon: Car, label: "Vehicles", requiredFeature: "VEHICLES" },
  { href: "/reports", icon: BarChart3, label: "Analytics", requiredFeature: "REPORTS" },
];

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { status, employee, isOffline } = useAuth();
  const { currentSite, currentSiteId, isAdmin } = useSite();
  const router = useRouter();
  const pathname = usePathname();
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [isSiteModalOpen, setIsSiteModalOpen] = useState(false);

  const visibleNavItems = NAV_ITEMS.filter(item =>
    !item.requiredFeature || hasPermission(employee?.role, item.requiredFeature)
  );

  const siteDisplayName = currentSiteId === "ALL" 
    ? "All Sites (Combined)" 
    : (currentSite?.name || "Select Parking Site");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") return null;

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden relative font-sans">
      {/* Top Header / Site & Operator Status Bar */}
      <header className="pt-[max(env(safe-area-inset-top),0.75rem)] px-3 sm:px-4 pb-2.5 bg-card/95 backdrop-blur-md border-b border-border/80 flex items-center justify-between gap-2 z-30 shrink-0">
        
        {/* Left: Professional Site Switcher */}
        <button
          type="button"
          onClick={() => setIsSiteModalOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/15 border border-primary/25 transition-all active:scale-95 text-left max-w-[180px] sm:max-w-[240px] truncate shadow-sm"
        >
          <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] uppercase tracking-wider font-bold text-primary/80 leading-none">
              Current Site
            </span>
            <span className="text-xs font-bold text-foreground leading-tight truncate flex items-center gap-1">
              <span className="truncate">{siteDisplayName}</span>
              <ChevronDown className="w-3 h-3 text-primary shrink-0" />
            </span>
          </div>
        </button>

        {/* Right: Operator Badge & Settings */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Operator Handover Trigger */}
          <button
            type="button"
            onClick={() => setIsSwitchModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-muted/80 hover:bg-muted border border-border/80 transition-all active:scale-95 text-left shadow-sm"
          >
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-orange-600 text-white flex items-center justify-center text-[11px] font-bold shadow-sm">
              {employee?.name?.charAt(0).toUpperCase() || "U"}
            </div>
            <span className="text-xs font-semibold text-foreground hidden sm:inline leading-none">
              {employee?.name?.split(" ")[0] || "Staff"}
            </span>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>

          {isOffline && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold border border-amber-500/30 animate-pulse">
              <WifiOff className="w-3 h-3" />
              <span className="hidden sm:inline">Offline</span>
            </div>
          )}

          <Link
            href="/settings"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-muted/80 border border-border/80 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-sm"
          >
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Main Scrollable Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <PullToRefresh>
          {children}
        </PullToRefresh>
      </main>

      {/* Site Switcher Modal */}
      <SiteSwitcherModal
        isOpen={isSiteModalOpen}
        onClose={() => setIsSiteModalOpen(false)}
      />

      {/* Operator Handover & Switch Modal */}
      <OperatorSwitchModal
        isOpen={isSwitchModalOpen}
        onClose={() => setIsSwitchModalOpen(false)}
      />


      {/* Dock Navigation */}
      <div className="fixed bottom-4 inset-x-0 z-40 safe-bottom flex justify-center px-4 pointer-events-none">
        <nav 
          className="w-full max-w-md pointer-events-auto relative rounded-[32px] overflow-visible border border-slate-200/80 dark:border-slate-800 bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl shadow-xl shadow-black/5"
        >
          <div className="flex items-center justify-around h-[72px] px-2 relative z-10">
            {visibleNavItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
              
              if (item.isAction) {
                return (
                  <div key={item.href} className="relative flex justify-center w-[64px] -mt-7">
                    <Link
                      href={item.href}
                      className="flex items-center justify-center w-[58px] h-[58px] rounded-full transition-all duration-300 relative group active:scale-95 bg-gradient-to-br from-primary via-orange-500 to-amber-500 shadow-lg shadow-primary/35 border-2 border-white dark:border-slate-900"
                    >
                      <Plus className="w-7 h-7 text-white drop-shadow group-hover:rotate-90 transition-transform duration-300" strokeWidth={2.5} />
                    </Link>
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center gap-1 min-w-[56px] transition-all duration-200 group pt-1"
                >
                  <div className={cn(
                    "p-2 rounded-xl transition-all duration-200",
                    isActive 
                      ? "bg-primary/10 text-primary font-bold shadow-sm" 
                      : "text-muted-foreground group-hover:text-foreground"
                  )}>
                    <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className={cn(
                    "text-[10px] tracking-wide transition-colors",
                    isActive ? "font-bold text-primary" : "font-medium text-muted-foreground"
                  )}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
