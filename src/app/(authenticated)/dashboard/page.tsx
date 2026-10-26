"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { useSite } from "@/providers/site-provider";
import { useLanguage } from "@/providers/language-provider";
import { dashboardService } from "@/services/dashboard.service";
import { formatINR } from "@/lib/formatters";
import { sessionsService } from "@/services/sessions.service";
import type { DashboardStats, ActiveVehicle } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { AnimatedCount, useAnimatedNumber } from "@/components/animated-count";
import {
  Car,
  ChevronRight,
  TrendingUp,
  Clock,
  ArrowUpRight,
  Building2,
  Plus,
  Users,
  Search,
  Calendar,
  CheckCircle2,
  ChevronDown,
  RefreshCw,
  Wallet,
  Sun,
  Layers,
  Target,
  BarChart3,
  Box,
  Compass
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const { employee } = useAuth();
  const { currentSite, currentSiteId, authorizedSites, switchSite } = useSite();
  const { t } = useLanguage();

  const querySiteId = currentSiteId === "ALL" ? "" : currentSiteId;

  const fallbackStats: DashboardStats = {
    total_slots: currentSite?.total_slots || 100,
    active_vehicles: 0,
    today_revenue: 0,
    yesterday_revenue: 0,
    today_vehicle_count: 0,
    yesterday_vehicle_count: 0,
    avg_duration_minutes: 0,
    daily_revenue_target: currentSite?.daily_revenue_target || 1500000,
    overstaying_count: 0,
    vehicle_type_breakdown: [],
    revenue_by_day: [],
    peak_hours: [],
  };

  const { data: stats = fallbackStats, isLoading, refetch } = useQuery({
    queryKey: ["dashboard-stats", querySiteId, employee?.company_id],
    queryFn: () => dashboardService.getStats(querySiteId),
    refetchInterval: 20_000,
    placeholderData: fallbackStats,
  });

  const { data: activeVehicles = [] } = useQuery({
    queryKey: ["active-sessions", querySiteId, employee?.company_id],
    queryFn: () => sessionsService.getActiveSessions(querySiteId),
    refetchInterval: 20_000,
  });

  // Revenue vs Yesterday %
  const revenueGrowthPct = stats.yesterday_revenue > 0
    ? Math.round(((stats.today_revenue - stats.yesterday_revenue) / stats.yesterday_revenue) * 100)
    : 0;

  // Entries vs Yesterday %
  const entriesGrowthPct = stats.yesterday_vehicle_count > 0
    ? Math.round(((stats.today_vehicle_count - stats.yesterday_vehicle_count) / stats.yesterday_vehicle_count) * 100)
    : 0;

  // Real Database Metrics (100% fresh from Supabase)
  const capacity = currentSiteId === "ALL"
    ? (authorizedSites.reduce((sum, s) => sum + (s.total_slots || 100), 0) || stats.total_slots || 200)
    : (currentSite?.total_slots || 100);

  const occupied = stats.active_vehicles || 0;
  const available = Math.max(0, capacity - occupied);
  const occupiedPct = capacity > 0 ? Math.min(100, Math.round((occupied / capacity) * 100)) : 0;
  const availablePct = capacity > 0 ? Math.min(100, Math.round((available / capacity) * 100)) : 100;

  const todayRevenuePaise = stats.today_revenue || 0;
  const todayRevenueRupees = Math.round(todayRevenuePaise / 100);
  const todayVehicleCount = stats.today_vehicle_count || 0;

  // Revenue target calculation (₹15,100 target in paise = 1,510,000)
  const targetPaise = stats.daily_revenue_target || 1510000;
  const targetProgressPct = targetPaise > 0 ? Math.min(100, Math.round((todayRevenuePaise / targetPaise) * 100)) : 0;

  // Animated slow count-up hooks for all metrics (gradual 2.2s easeOutQuad)
  const animRevenue = useAnimatedNumber(todayRevenueRupees, 1600, 100);
  const animRevenueGrowth = useAnimatedNumber(Math.abs(revenueGrowthPct), 1400, 150);
  const animTodayEntries = useAnimatedNumber(todayVehicleCount, 1600, 100);
  const animEntriesGrowth = useAnimatedNumber(Math.abs(entriesGrowthPct), 1400, 150);
  const animOccupied = useAnimatedNumber(occupied, 1600, 100);
  const animOccupiedPct = useAnimatedNumber(occupiedPct, 1600, 100);
  const animAvailable = useAnimatedNumber(available, 1600, 100);
  const animAvailablePct = useAnimatedNumber(availablePct, 1600, 100);
  const animTargetProgressPct = useAnimatedNumber(targetProgressPct, 1600, 150);

  const site1Bays = authorizedSites[0]?.total_slots || 100;
  const site2Bays = authorizedSites[1]?.total_slots || 100;
  const animSite1Bays = useAnimatedNumber(site1Bays, 1500, 100);
  const animSite2Bays = useAnimatedNumber(site2Bays, 1500, 100);

  // Timeframe selector state: "7" | "14" | "30" | "today"
  const [rangeOption, setRangeOption] = useState<"7" | "14" | "30" | "today">("7");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const rangeDays = rangeOption === "14" ? 14 : rangeOption === "30" ? 30 : 7;

  // Real database historical chart query
  const { data: rawChartData = [] } = useQuery({
    queryKey: ["revenue-chart", querySiteId, employee?.company_id, rangeDays],
    queryFn: () => dashboardService.getRevenueChart(querySiteId, rangeDays),
    refetchInterval: 20_000,
  });

  // Dynamic past days calculation ending with Today
  const chartDays = useMemo(() => {
    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const now = new Date();

    if (rangeOption === "today") {
      // Real hourly breakdown for Today
      const standardHours = [8, 10, 12, 14, 16, 18, 20, 22];
      return standardHours.map((hr) => {
        const label = hr > 12 ? `${hr - 12} PM` : hr === 12 ? "12 PM" : `${hr} AM`;
        const match = stats.peak_hours?.find((p) => p.hour === hr);
        return {
          day: label,
          dateStr: "Today",
          rev: 0,
          count: match ? match.count : 0,
          isToday: true,
        };
      });
    }

    const results = [];
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayName = daysOfWeek[d.getDay()];
      const dayMonth = d.toLocaleDateString("en-US", { day: "numeric", month: "short" });

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const iso = `${year}-${month}-${day}`;

      const match = rawChartData.find((r) => r.date === iso);
      const revRupees = match ? Math.round(match.revenue / 100) : 0;
      const count = match ? match.count : 0;

      results.push({
        day: i === 0 ? "Today" : dayName,
        dateStr: dayMonth,
        rev: revRupees,
        count: count,
        isToday: i === 0,
      });
    }

    return results;
  }, [rawChartData, rangeOption, rangeDays, stats.peak_hours]);

  // Dynamic scale maximums based on actual database data
  const maxRev = useMemo(() => {
    const highest = Math.max(0, ...chartDays.map((d) => d.rev));
    if (highest === 0) return 10000;
    return Math.ceil(highest / 5000) * 5000;
  }, [chartDays]);

  const maxCount = useMemo(() => {
    const highest = Math.max(0, ...chartDays.map((d) => d.count));
    if (highest === 0) return 50;
    return Math.ceil(highest / 20) * 20;
  }, [chartDays]);

  // Greeting based on IST time
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-4 sm:space-y-5 max-w-[1440px] w-full mx-auto font-sans pb-12 select-none">
      
      {/* ────────── 1. HEADER HERO CARD WITH BANNER IMAGE ────────── */}
      <section className="bg-white dark:bg-zinc-900 rounded-3xl p-5 sm:p-6 border border-slate-100 dark:border-zinc-800 shadow-sm relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-5">
        {/* Left Welcome Area */}
        <div className="flex items-start gap-4 z-10 max-w-xl">
          <div className="w-11 h-11 rounded-full bg-orange-100/80 dark:bg-orange-950/40 text-[#f25c27] flex items-center justify-center shrink-0 shadow-sm">
            <Sun className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
              {greeting}, {employee?.name?.split(" ")[0]?.toLowerCase() || "admin"}
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 font-medium leading-relaxed">
              Stay on top of vehicle flow, track revenue in real-time, and monitor parking bays.
            </p>
          </div>
        </div>

        {/* Right Banner Photo & Action Buttons */}
        <div className="flex items-center gap-3 z-10 shrink-0 self-end md:self-center">
          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => refetch()}
            className="bg-white/95 dark:bg-zinc-800/95 backdrop-blur-md border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 font-bold text-xs px-4 py-2.5 rounded-full flex items-center gap-2 shadow-sm hover:bg-slate-50 dark:hover:bg-zinc-700 active:scale-95 transition-all"
            title="Refresh Live Data"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin text-[#f25c27]")} />
            <span>Refresh</span>
          </button>

          {/* + New Check-in Button */}
          <button
            type="button"
            onClick={() => router.push("/gate/")}
            className="bg-gradient-to-r from-[#f25c27] to-[#e64a19] text-white font-bold text-xs px-5 py-2.5 rounded-full flex items-center gap-2 shadow-md shadow-orange-500/25 hover:opacity-95 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>New Check-in</span>
          </button>
        </div>

        {/* Realistic Banner Graphic on Right (Faded into Background) */}
        <div className="hidden lg:block absolute right-0 top-0 bottom-0 w-[42%] overflow-hidden pointer-events-none opacity-90 dark:opacity-40">
          <img
            src="/images/parking-header-banner.jpg"
            alt="Parking terminal canopy"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/40 to-transparent dark:from-zinc-900 dark:via-zinc-900/60 dark:to-transparent" />
        </div>
      </section>

      {/* ────────── 2. TODAY'S COLLECTION CARD ────────── */}
      <section className="bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-7 border border-slate-100 dark:border-zinc-800 shadow-sm relative overflow-hidden flex flex-col justify-between">
        {/* Top Meta Row */}
        <div className="flex items-center justify-between mb-3 z-10">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-950/40 text-[#f25c27] flex items-center justify-center">
              <Building2 className="w-3.5 h-3.5" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              TODAY'S COLLECTION
            </span>
          </div>

          {/* Site Pill Dropdown */}
          <button
            type="button"
            onClick={() => switchSite(currentSiteId === "ALL" ? (authorizedSites[0]?.id || "ALL") : "ALL")}
            className="pill flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-zinc-200 bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 border border-slate-200/80 dark:border-zinc-700 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-[#f25c27]" />
            <span>{currentSiteId === "ALL" ? "All Sites" : (currentSite?.name || "Sant Wamanbaba")}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
          </button>
        </div>

        {/* Large Currency Amount */}
        <div className="my-2 z-10">
          <div className="text-5xl sm:text-6xl font-black text-slate-900 dark:text-white tracking-tight">
            ₹{animRevenue.toLocaleString("en-IN")}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold text-xs px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 border border-emerald-500/20">
              <TrendingUp className="w-3 h-3 stroke-[3]" />
              <span>+{animRevenueGrowth}%</span>
            </span>
            <span className="text-xs text-slate-400 dark:text-zinc-500 font-medium">than yesterday</span>
          </div>
        </div>

        {/* Faint 3D Wallet Watermark */}
        <div className="absolute right-6 top-6 opacity-[0.06] dark:opacity-[0.04] pointer-events-none text-[#f25c27] hidden sm:block">
          <Wallet className="w-36 h-36 stroke-[1.2]" />
        </div>

        {/* Action Buttons Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6 z-10">
          {/* + Check-in Button */}
          <button
            type="button"
            onClick={() => router.push("/gate/")}
            className="bg-[#141416] dark:bg-zinc-800 text-white font-bold text-xs py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 hover:bg-black dark:hover:bg-zinc-700 transition-all active:scale-[0.98] shadow-sm border border-transparent dark:border-zinc-700"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Check-in</span>
            <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-70" />
          </button>

          {/* Live Lot Button */}
          <button
            type="button"
            onClick={() => router.push("/gate/active/")}
            className="bg-white dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 font-bold text-xs py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-all active:scale-[0.98]"
          >
            <Car className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
            <span>Live Lot</span>
            <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-70" />
          </button>
        </div>
      </section>

      {/* ────────── 3. TERMINALS & ZONES ────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-zinc-200">Terminals & Zones</h2>
          </div>
          <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500">
            {authorizedSites?.length || 2} sites
          </span>
        </div>

        {/* 2 Site Cards Matching Reference */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Site Card 1: 3D Booth Graphic */}
          <div 
            onClick={() => switchSite(authorizedSites[0]?.id || "site-1")}
            className="bg-white dark:bg-zinc-900 rounded-2xl p-4 sm:p-5 border border-slate-100 dark:border-zinc-800 shadow-sm flex items-center justify-between cursor-pointer hover:border-slate-300 dark:hover:border-zinc-700 transition-all relative overflow-hidden"
          >
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-zinc-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span>Sant</span>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {animSite1Bays} bays
              </div>
              <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] px-2.5 py-0.5 rounded-full inline-block mt-2 border border-emerald-500/20">
                Active
              </span>
            </div>

            {/* 3D Booth Illustration */}
            <div className="w-28 sm:w-36 h-20 flex items-center justify-end">
              <img
                src="/images/booth-3d.jpg"
                alt="3D Parking Kiosk Booth"
                className="max-h-full object-contain rounded-xl"
              />
            </div>
          </div>

          {/* Site Card 2: Modern Canopy Photo (Active with Orange Border) */}
          <div 
            onClick={() => switchSite(authorizedSites[1]?.id || authorizedSites[0]?.id || "site-2")}
            className="bg-white dark:bg-zinc-900 rounded-2xl p-4 sm:p-5 border-2 border-[#f25c27] shadow-sm shadow-orange-500/10 flex items-center justify-between cursor-pointer relative overflow-hidden"
          >
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-zinc-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span>Sant</span>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {animSite2Bays} bays
              </div>
              <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] px-2.5 py-0.5 rounded-full inline-block mt-2 border border-emerald-500/20">
                Active
              </span>
            </div>

            {/* Modern Covered Garage Image */}
            <div className="w-32 sm:w-44 h-20 flex items-center justify-end">
              <img
                src="/images/terminal-canopy.jpg"
                alt="Covered Parking Structure"
                className="w-full h-full object-cover rounded-xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ────────── 4. TWO STATS CARDS (TODAY ENTRIES & PARKED LIVE) ────────── */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Today Entries */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 sm:p-6 border border-slate-100 dark:border-zinc-800 shadow-sm flex flex-col justify-between relative overflow-hidden min-h-[145px]">
          {/* Top Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-zinc-300">
              <Calendar className="w-4 h-4 text-slate-600 dark:text-zinc-400" />
              <span>Today Entries</span>
            </div>
            <div className="w-6 h-6 rounded-full bg-slate-50 dark:bg-zinc-800 flex items-center justify-center text-slate-400 dark:text-zinc-500">
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Big Number */}
          <div className="my-2">
            <span className="text-4xl font-extrabold text-slate-900 dark:text-white">
              {animTodayEntries}
            </span>
          </div>

          {/* Bottom Badge */}
          <div className="flex items-center gap-2">
            <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold text-xs px-2 py-0.5 rounded-full border border-emerald-500/20">
              +{animEntriesGrowth}%
            </span>
            <span className="text-xs text-slate-400 dark:text-zinc-500 font-medium">vs yesterday</span>
          </div>

          {/* Soft Peach Mini Bar Graphic */}
          <div className="absolute right-5 bottom-4 flex items-end gap-1.5 h-12 pointer-events-none">
            <div className="w-2.5 rounded-full bg-orange-100/80 dark:bg-orange-950/50 h-4" />
            <div className="w-2.5 rounded-full bg-orange-100/90 dark:bg-orange-950/60 h-8" />
            <div className="w-2.5 rounded-full bg-orange-100 dark:bg-orange-950/50 h-6" />
            <div className="w-2.5 rounded-full bg-orange-200 dark:bg-orange-900/60 h-12" />
            <div className="w-2.5 rounded-full bg-orange-100/80 dark:bg-orange-950/50 h-9" />
          </div>
        </div>

        {/* Card 2: Parked Live (Solid Orange Gradient Card) */}
        <div 
          onClick={() => router.push("/gate/active/")}
          className="bg-gradient-to-br from-[#f25c27] to-[#e64a19] text-white rounded-2xl p-5 sm:p-6 shadow-lg shadow-orange-500/20 relative overflow-hidden flex flex-col justify-between cursor-pointer hover:opacity-95 transition-opacity min-h-[145px]"
        >
          {/* Top Row */}
          <div className="flex items-center justify-between z-10">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Car className="w-4 h-4 text-white" />
              <span>Parked Live</span>
            </div>
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-white">
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Big Number */}
          <div className="my-2 z-10">
            <span className="text-4xl font-extrabold text-white">
              {animOccupied}
            </span>
          </div>

          {/* Bottom Occupied Pill */}
          <div className="z-10">
            <span className="bg-white/20 backdrop-blur-sm text-white text-[11px] font-bold px-3 py-1 rounded-full inline-block">
              {animOccupiedPct}% occupied
            </span>
          </div>

          {/* White Car Watermark in Background */}
          <div className="absolute -right-2 -bottom-2 text-white/15 pointer-events-none">
            <Car className="w-24 h-24 stroke-[1.2]" />
          </div>
        </div>
      </section>

      {/* ────────── 5. TWO METRIC CARDS (AVAILABLE BAYS & TARGET PACE) ────────── */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Available Bays (with Circular Progress Gauge) */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 sm:p-6 border border-slate-100 dark:border-zinc-800 shadow-sm flex items-center justify-between min-h-[135px]">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-zinc-300">
              <Box className="w-4 h-4 text-slate-600 dark:text-zinc-400" />
              <span>Available Bays</span>
            </div>
            <div className="text-4xl font-black text-emerald-500 mt-2">
              {animAvailable}
            </div>
            <div className="text-xs text-slate-400 dark:text-zinc-500 font-medium mt-1">
              Ready for entry
            </div>
          </div>

          {/* Radial Circular Progress Gauge */}
          <div className="relative w-18 h-18 sm:w-20 sm:h-20 flex items-center justify-center shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              {/* Background ring */}
              <path
                className="text-emerald-100 dark:text-emerald-950/60"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              {/* Foreground progress ring */}
              <path
                className="text-emerald-500 transition-all duration-300"
                strokeDasharray={`${animAvailablePct}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute text-xs font-extrabold text-slate-900 dark:text-white">
              {animAvailablePct}%
            </span>
          </div>
        </div>

        {/* Card 2: Target Pace (with Progress Track & Checkered Flag) */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 sm:p-6 border border-slate-100 dark:border-zinc-800 shadow-sm flex flex-col justify-between min-h-[135px]">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-zinc-300">
            <Target className="w-4 h-4 text-slate-600 dark:text-zinc-400" />
            <span>Target Pace</span>
          </div>

          <div className="text-4xl font-black text-slate-900 dark:text-white my-1">
            {animTargetProgressPct}%
          </div>

          {/* Goal Text & Progress Track */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-xs text-slate-500 dark:text-zinc-400 font-semibold">
              ₹{(targetPaise / 100).toLocaleString("en-IN")} goal
            </span>

            {/* Horizontal Track with Orange Scrubber and Checkered Flag */}
            <div className="flex items-center gap-2 flex-1 max-w-[200px]">
              <div className="relative flex-1 h-2 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-orange-400 to-[#f25c27] rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(6, animTargetProgressPct))}%` }}
                />
              </div>
              <div className="w-3 h-3 rounded-full bg-[#f25c27] ring-4 ring-orange-100 dark:ring-orange-950/40 -ml-2.5 z-10 shrink-0" />
              <span className="text-base select-none leading-none">🏁</span>
            </div>
          </div>
        </div>
      </section>

      {/* ────────── 6. VOLUME & REVENUE CHART (7 DAYS DUAL-AXIS COMBO CHART) ────────── */}
      <section className="bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-7 border border-slate-100 dark:border-zinc-800 shadow-sm space-y-4">
        {/* Chart Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Volume & Revenue</h3>
            </div>
            <p className="text-xs text-slate-400 dark:text-zinc-500 font-medium mt-0.5">
              Weekly parking collection and vehicle counts
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Chart Legend */}
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-300">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f25c27]" />
                <span>Revenue (₹)</span>
              </span>
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-300">
                <span className="w-2.5 h-2.5 rounded-full bg-black dark:bg-white" />
                <span>Vehicles</span>
              </span>
            </div>

            {/* Working Timeframe Dropdown Pill */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                className="border border-slate-200 dark:border-zinc-700 rounded-full px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-zinc-200 flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors bg-white dark:bg-zinc-800 shadow-xs cursor-pointer active:scale-95"
              >
                <Calendar className="w-3.5 h-3.5 text-[#f25c27]" />
                <span>
                  {rangeOption === "7" ? "7 Days" : rangeOption === "14" ? "14 Days" : rangeOption === "30" ? "30 Days" : "Today"}
                </span>
                <ChevronDown className={cn("w-3 h-3 text-slate-400 dark:text-zinc-500 transition-transform duration-200", isDropdownOpen && "rotate-180")} />
              </button>

              {isDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40"
                    onClick={() => setIsDropdownOpen(false)}
                  />
                  <div 
                    className="absolute right-0 top-full mt-2 w-44 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-slate-100 dark:border-zinc-800 py-1.5 z-50 text-xs font-semibold overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                  >
                    {[
                      { id: "7", label: "7 Days (Weekly)" },
                      { id: "14", label: "14 Days" },
                      { id: "30", label: "30 Days (Monthly)" },
                      { id: "today", label: "Today (Hourly)" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setRangeOption(opt.id as any);
                          setIsDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full text-left px-3.5 py-2 flex items-center justify-between hover:bg-orange-50 dark:hover:bg-zinc-800 hover:text-[#f25c27] transition-colors cursor-pointer",
                          rangeOption === opt.id ? "bg-orange-50/80 dark:bg-zinc-800 text-[#f25c27] font-bold" : "text-slate-700 dark:text-zinc-300"
                        )}
                      >
                        <span>{opt.label}</span>
                        {rangeOption === opt.id && <CheckCircle2 className="w-3.5 h-3.5 text-[#f25c27]" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Dual-Axis SVG & Column Chart */}
        <div className="relative pt-4 pb-2">
          {/* Grid Container with Left & Right Y-Axes */}
          <div className="flex gap-2">
            {/* Left Y-Axis: Currency */}
            <div className="flex flex-col justify-between text-[11px] font-semibold text-slate-400 dark:text-zinc-500 h-44 py-1 text-right w-12 shrink-0">
              <span>₹{maxRev >= 1000 ? `${Math.round(maxRev / 1000)}k` : maxRev}</span>
              <span>₹{Math.round((maxRev * 0.75) / 1000)}k</span>
              <span>₹{Math.round((maxRev * 0.5) / 1000)}k</span>
              <span>₹{Math.round((maxRev * 0.25) / 1000)}k</span>
              <span>₹0</span>
            </div>

            {/* Center Chart Plot Area */}
            <div className="flex-1 relative h-44">
              {/* Dashed Horizontal Grid Lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                <div className="border-b border-dashed border-slate-100 dark:border-zinc-800 w-full" />
                <div className="border-b border-dashed border-slate-100 dark:border-zinc-800 w-full" />
                <div className="border-b border-dashed border-slate-100 dark:border-zinc-800 w-full" />
                <div className="border-b border-dashed border-slate-100 dark:border-zinc-800 w-full" />
                <div className="border-b border-slate-200 dark:border-zinc-700 w-full" />
              </div>

              {/* Column Revenue Bars */}
              <div className="absolute inset-0 flex justify-around items-end px-2 z-10">
                {chartDays.map((item, idx) => {
                  const barHeight = item.rev > 0
                    ? Math.min(150, Math.max(10, Math.round((item.rev / maxRev) * 150)))
                    : 4; // Baseline indicator for zero revenue

                  return (
                    <div key={idx} className="flex flex-col items-center group relative h-full justify-end">
                      {/* Tooltip on hover/touch */}
                      <div className="absolute -top-10 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity bg-slate-900 dark:bg-zinc-800 text-white text-[10px] font-bold px-2.5 py-1 rounded-md shadow-lg pointer-events-none whitespace-nowrap z-30 border border-transparent dark:border-zinc-700">
                        {item.dateStr}: ₹{item.rev.toLocaleString("en-IN")} • {item.count} {item.count === 1 ? "vehicle" : "vehicles"}
                      </div>

                      {/* Column Bar */}
                      <div
                        className={cn(
                          "w-5 sm:w-8 rounded-lg transition-all duration-300 group-hover:scale-y-105 origin-bottom",
                          item.rev > 0
                            ? "bg-gradient-to-t from-orange-400 to-[#f25c27] shadow-sm shadow-orange-500/20"
                            : "bg-slate-100 dark:bg-zinc-800",
                          item.isToday && "ring-2 ring-[#f25c27]/40 ring-offset-1 dark:ring-offset-zinc-900"
                        )}
                        style={{ height: `${barHeight}px` }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Line Chart Overlay for Vehicle Volume */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible" preserveAspectRatio="none">
                {/* SVG Polyline connecting vehicle data points */}
                <polyline
                  fill="none"
                  className="stroke-[#141416] dark:stroke-zinc-100"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={chartDays.map((item, idx) => {
                    const xPercent = (idx / (chartDays.length - 1 || 1)) * 100;
                    const y = item.count > 0
                      ? 176 - Math.min(160, Math.max(12, Math.round((item.count / maxCount) * 160)))
                      : 176;
                    return `${xPercent}%,${y}`;
                  }).join(" ")}
                />

                {/* Circular Nodes on top of each data point */}
                {chartDays.map((item, idx) => {
                  const xPercent = (idx / (chartDays.length - 1 || 1)) * 100;
                  const y = item.count > 0
                    ? 176 - Math.min(160, Math.max(12, Math.round((item.count / maxCount) * 160)))
                    : 176;

                  return (
                    <g key={idx}>
                      <circle
                        cx={`${xPercent}%`}
                        cy={y}
                        r={item.count > 0 ? "4" : "3"}
                        className={item.count > 0 ? "fill-slate-900 dark:fill-white stroke-white dark:stroke-zinc-900" : "fill-slate-300 dark:fill-zinc-600 stroke-white dark:stroke-zinc-900"}
                        strokeWidth="1.5"
                      />
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Right Y-Axis: Vehicle Counts */}
            <div className="flex flex-col justify-between text-[11px] font-semibold text-slate-400 dark:text-zinc-500 h-44 py-1 text-left w-7 shrink-0">
              <span>{maxCount}</span>
              <span>{Math.round(maxCount * 0.75)}</span>
              <span>{Math.round(maxCount * 0.5)}</span>
              <span>{Math.round(maxCount * 0.25)}</span>
              <span>0</span>
            </div>
          </div>

          {/* Bottom X-Axis Days Labels */}
          <div className="flex justify-around pl-12 pr-7 pt-2.5">
            {chartDays.map((item, idx) => (
              <div key={idx} className="flex flex-col items-center">
                <span className={cn(
                  "text-[11px] font-bold leading-tight",
                  item.isToday ? "text-[#f25c27]" : "text-slate-700 dark:text-zinc-300"
                )}>
                  {item.day}
                </span>
                <span className={cn(
                  "text-[10px] font-medium",
                  item.isToday ? "text-[#f25c27] font-semibold" : "text-slate-400 dark:text-zinc-500"
                )}>
                  {item.dateStr}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
