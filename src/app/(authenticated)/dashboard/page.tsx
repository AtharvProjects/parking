"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { useSite } from "@/providers/site-provider";
import { dashboardService } from "@/services/dashboard.service";
import { formatINR } from "@/lib/formatters";
import { sessionsService } from "@/services/sessions.service";
import { cn } from "@/lib/utils";
import {
  Car,
  ChevronRight,
  TrendingUp,
  Clock,
  Layers,
  ArrowUpRight,
  Building2,
  Shield,
  Plus
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const { employee } = useAuth();
  const { currentSite, currentSiteId, authorizedSites, switchSite, isAdmin } = useSite();

  const querySiteId = currentSiteId === "ALL" ? "" : currentSiteId;

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats", querySiteId, employee?.company_id],
    queryFn: () => dashboardService.getStats(querySiteId),
    refetchInterval: 20_000,
  });

  const { data: activeVehicles } = useQuery({
    queryKey: ["active-sessions", querySiteId, employee?.company_id],
    queryFn: () => sessionsService.getActiveSessions(querySiteId),
    refetchInterval: 20_000,
  });

  if (isLoading || !stats) {
    return (
      <div className="p-4 space-y-5 pb-32 max-w-xl mx-auto font-sans">
        <div className="h-48 rounded-3xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-28 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
          <div className="h-28 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
        </div>
        <div className="h-40 rounded-3xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
      </div>
    );
  }

  const available = Math.max(0, stats.total_slots - stats.active_vehicles);
  const occupied = stats.active_vehicles;
  const capacity = stats.total_slots;

  const occupiedPct = capacity > 0 ? Math.min(100, Math.round((occupied / capacity) * 100)) : 0;
  const todayDate = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  });

  const activeSiteName = currentSiteId === "ALL"
    ? "All Sites (Enterprise Combined)"
    : (currentSite?.name || "Terminal");

  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto space-y-5 pb-36 font-sans">
      
      {/* ────────── SITE SELECTOR CHIPS (FOR MULTI-SITE OPERATORS & ADMINS) ────────── */}
      {authorizedSites && (authorizedSites.length > 1 || isAdmin) && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
          {isAdmin && (
            <button
              type="button"
              onClick={() => switchSite("ALL")}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 border",
                currentSiteId === "ALL"
                  ? "bg-primary text-white border-primary shadow-sm"
                  : "bg-card text-muted-foreground border-border hover:bg-muted"
              )}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>All Sites Combined</span>
            </button>
          )}
          {authorizedSites.map((site) => (
            <button
              key={site.id}
              type="button"
              onClick={() => switchSite(site.id)}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all border flex items-center gap-1.5",
                currentSiteId === site.id
                  ? "bg-primary text-white border-primary shadow-sm"
                  : "bg-card text-muted-foreground border-border hover:bg-muted"
              )}
            >
              <Building2 className="w-3 h-3" />
              <span>{site.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* ────────── HERO REVENUE BANNER ────────── */}
      <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-primary via-orange-600 to-amber-600 text-white p-6 shadow-xl shadow-primary/20">
        {/* Subtle background vehicle watermark */}
        <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none">
          <Car className="w-52 h-52 text-white" strokeWidth={1} />
        </div>

        {/* Top Meta info */}
        <div className="flex items-center justify-between relative z-10 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-white/90 truncate max-w-[200px]">
              {activeSiteName}
            </span>
          </div>
          <div className="px-3 py-1 rounded-full bg-black/20 backdrop-blur-md text-[11px] font-semibold text-white/90">
            {todayDate}
          </div>
        </div>

        {/* Revenue Display */}
        <div className="relative z-10 space-y-1 my-2">
          <p className="text-xs font-semibold text-white/80 uppercase tracking-wider">
            Today's Total Collection
          </p>
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight drop-shadow-sm">
            {formatINR(stats.today_revenue)}
          </h2>
        </div>

        {/* Quick Footer Pills */}
        <div className="relative z-10 pt-4 flex items-center gap-3 border-t border-white/15 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-300" />
            <span>{stats.today_vehicle_count} entries today</span>
          </div>
          <span className="text-white/40">•</span>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-white/80" />
            <span>{capacity} total capacity</span>
          </div>
        </div>
      </div>

      {/* ────────── HORIZONTAL METRIC CARDS ────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        
        {/* Card 1: Available Slots */}
        <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Available</span>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Car className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-foreground">{available}</div>
            <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3" /> Ready for entry
            </p>
          </div>
        </div>

        {/* Card 2: Occupied Slots */}
        <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Occupied</span>
            <div className="w-7 h-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-primary">{occupied}</div>
            <p className="text-[11px] font-semibold text-muted-foreground mt-1">
              {occupiedPct}% occupied
            </p>
          </div>
        </div>

        {/* Card 3: Today Entries */}
        <div className="col-span-2 sm:col-span-1 bg-card border border-border/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Entries Today</span>
            <div className="w-7 h-7 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-foreground">{stats.today_vehicle_count}</div>
            <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 mt-1">
              Active tracking
            </p>
          </div>
        </div>

      </div>

      {/* ────────── QUICK ACTIONS ────────── */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => router.push("/gate")}
          className="p-4 rounded-2xl bg-primary text-white flex items-center gap-3 shadow-lg shadow-primary/20 hover:opacity-95 transition-all active:scale-95"
        >
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Plus className="w-6 h-6 stroke-[3]" />
          </div>
          <div className="text-left">
            <span className="text-xs font-bold block leading-none">Vehicle Entry</span>
            <span className="text-[10px] text-white/80 mt-1 block">Check in vehicle</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => router.push("/gate/active")}
          className="p-4 rounded-2xl bg-card border border-border/80 hover:bg-muted text-foreground flex items-center gap-3 shadow-sm transition-all active:scale-95"
        >
          <div className="w-10 h-10 rounded-xl bg-muted text-foreground flex items-center justify-center">
            <Car className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left">
            <span className="text-xs font-bold block leading-none">Active Vehicles</span>
            <span className="text-[10px] text-muted-foreground mt-1 block">{occupied} parked</span>
          </div>
        </button>
      </div>

      {/* ────────── RECENT ACTIVE VEHICLE PILL (IF PRESENT) ────────── */}
      {activeVehicles && activeVehicles.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-xl flex items-center justify-center shrink-0">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-mono font-bold text-foreground text-sm tracking-wide">
                {activeVehicles[0].vehicle_number}
              </h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Checked in by {activeVehicles[0].entry_operator_name?.split(" ")[0] || "Staff"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push("/gate/active")}
            className="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-white text-xs font-bold transition-all flex items-center gap-1"
          >
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ────────── PARKING CAPACITY OVERVIEW CARD ────────── */}
      <div 
        onClick={() => router.push("/gate/active")}
        className="bg-card border border-border rounded-[28px] p-5 shadow-sm cursor-pointer hover:border-primary/40 transition-all group"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-foreground tracking-tight">Capacity & Slot Overview</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Live parking space utilization</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:text-foreground group-hover:bg-primary/10 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-xs font-bold text-foreground">
            <span>Occupancy</span>
            <span>{occupiedPct}%</span>
          </div>
          <div className="h-3.5 w-full bg-muted rounded-full overflow-hidden flex p-0.5 border border-border">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${Math.max(4, occupiedPct)}%` }}
            />
          </div>
        </div>

        {/* 3 Metric Columns */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border text-center">
          <div>
            <span className="text-[11px] font-medium text-muted-foreground block">Total</span>
            <span className="text-lg font-black text-foreground">{capacity}</span>
          </div>
          <div>
            <span className="text-[11px] font-medium text-muted-foreground block">Parked</span>
            <span className="text-lg font-black text-primary">{occupied}</span>
          </div>
          <div>
            <span className="text-[11px] font-medium text-muted-foreground block">Available</span>
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{available}</span>
          </div>
        </div>
      </div>

    </div>
  );
}
