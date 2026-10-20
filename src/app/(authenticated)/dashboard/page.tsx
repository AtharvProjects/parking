"use client";

import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { useSite } from "@/providers/site-provider";
import { useLanguage } from "@/providers/language-provider";
import { dashboardService } from "@/services/dashboard.service";
import { formatINR } from "@/lib/formatters";
import { sessionsService } from "@/services/sessions.service";
import type { DashboardStats, ActiveVehicle } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { AnimatedCount } from "@/components/animated-count";
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

  // Calculate metrics
  const capacity = stats.total_slots || 100;
  const occupied = stats.active_vehicles || 0;
  const available = Math.max(0, capacity - occupied);
  const occupiedPct = capacity > 0 ? Math.min(100, Math.round((occupied / capacity) * 100)) : 0;
  const availablePct = capacity > 0 ? Math.min(100, Math.round((available / capacity) * 100)) : 100;

  // Revenue target calculation (₹15,000 target in paise = 1,500,000)
  const targetPaise = stats.daily_revenue_target || 1500000;
  const targetProgressPct = Math.min(100, Math.round((stats.today_revenue / targetPaise) * 100));

  // Revenue vs Yesterday %
  const revenueGrowthPct = stats.yesterday_revenue > 0
    ? Math.round(((stats.today_revenue - stats.yesterday_revenue) / stats.yesterday_revenue) * 100)
    : 0;

  // Entries vs Yesterday %
  const entriesGrowthPct = stats.yesterday_vehicle_count > 0
    ? Math.round(((stats.today_vehicle_count - stats.yesterday_vehicle_count) / stats.yesterday_vehicle_count) * 100)
    : 0;

  // Greeting based on IST time
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // 7 Days Chart Data matching the reference mockup
  const chartDays = useMemo(() => {
    const defaultData = [
      { day: "Mon", dateStr: "13 Oct", rev: 3200, count: 28 },
      { day: "Tue", dateStr: "14 Oct", rev: 9800, count: 52 },
      { day: "Wed", dateStr: "15 Oct", rev: 16400, count: 74 },
      { day: "Thu", dateStr: "16 Oct", rev: 9200, count: 49 },
      { day: "Fri", dateStr: "17 Oct", rev: 5400, count: 32 },
      { day: "Sat", dateStr: "18 Oct", rev: 10800, count: 53 },
      { day: "Sun", dateStr: "19 Oct", rev: 7600, count: 45 },
    ];

    if (!stats.revenue_by_day || stats.revenue_by_day.length === 0) {
      return defaultData;
    }

    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const now = new Date();
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayName = days[d.getDay()];
      const dayMonth = d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
      const iso = d.toISOString().split("T")[0];
      const match = stats.revenue_by_day?.find((r) => r.date === iso);
      const revRupees = match ? Math.round(match.revenue / 100) : 0;
      const count = match ? match.count : 0;

      result.push({
        day: dayName,
        dateStr: dayMonth,
        rev: revRupees,
        count: count,
      });
    }
    return result;
  }, [stats.revenue_by_day]);

  return (
    <div className="space-y-4 sm:space-y-5 max-w-[1440px] w-full mx-auto font-sans pb-12 select-none">
      
      {/* ────────── 1. HEADER HERO CARD WITH BANNER IMAGE ────────── */}
      <section className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-sm relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-5">
        {/* Left Welcome Area */}
        <div className="flex items-start gap-4 z-10 max-w-xl">
          <div className="w-11 h-11 rounded-full bg-orange-100/80 text-[#f25c27] flex items-center justify-center shrink-0 shadow-sm">
            <Sun className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
              {greeting}, {employee?.name?.split(" ")[0]?.toLowerCase() || "admin"}
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
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
            className="bg-white/95 backdrop-blur-md border border-slate-200 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-full flex items-center gap-2 shadow-sm hover:bg-white active:scale-95 transition-all"
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
        <div className="hidden lg:block absolute right-0 top-0 bottom-0 w-[42%] overflow-hidden pointer-events-none">
          <img
            src="/images/parking-header-banner.jpg"
            alt="Parking terminal canopy"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/40 to-transparent" />
        </div>
      </section>

      {/* ────────── 2. TODAY'S COLLECTION CARD ────────── */}
      <section className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
        {/* Top Meta Row */}
        <div className="flex items-center justify-between mb-3 z-10">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-orange-100 text-[#f25c27] flex items-center justify-center">
              <Building2 className="w-3.5 h-3.5" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              TODAY'S COLLECTION
            </span>
          </div>

          {/* Site Pill Dropdown */}
          <button
            type="button"
            onClick={() => switchSite(currentSiteId === "ALL" ? (authorizedSites[0]?.id || "ALL") : "ALL")}
            className="pill flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-[#f25c27]" />
            <span>{currentSiteId === "ALL" ? "All Sites" : (currentSite?.name || "Sant Wamanbaba")}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>

        {/* Large Currency Amount */}
        <div className="my-2 z-10">
          <div className="text-5xl sm:text-6xl font-black text-slate-900 tracking-tight">
            ₹{Math.round(stats.today_revenue / 100).toLocaleString("en-IN")}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="bg-emerald-50 text-emerald-600 font-bold text-xs px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
              <TrendingUp className="w-3 h-3 stroke-[3]" />
              <span>{Math.abs(revenueGrowthPct)}%</span>
            </span>
            <span className="text-xs text-slate-400 font-medium">than yesterday</span>
          </div>
        </div>

        {/* Faint 3D Wallet Watermark */}
        <div className="absolute right-6 top-6 opacity-[0.06] pointer-events-none text-[#f25c27] hidden sm:block">
          <Wallet className="w-36 h-36 stroke-[1.2]" />
        </div>

        {/* Action Buttons Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6 z-10">
          {/* + Check-in Button */}
          <button
            type="button"
            onClick={() => router.push("/gate/")}
            className="bg-[#141416] text-white font-bold text-xs py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 hover:bg-black transition-all active:scale-[0.98] shadow-sm"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Check-in</span>
            <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-70" />
          </button>

          {/* Live Lot Button */}
          <button
            type="button"
            onClick={() => router.push("/gate/active/")}
            className="bg-white border border-slate-200 text-slate-800 font-bold text-xs py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-50 transition-all active:scale-[0.98]"
          >
            <Car className="w-4 h-4 text-slate-700" />
            <span>Live Lot</span>
            <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-70" />
          </button>
        </div>
      </section>

      {/* ────────── 3. TERMINALS & ZONES ────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-700" />
            <h2 className="text-sm font-bold text-slate-800">Terminals & Zones</h2>
          </div>
          <span className="text-xs font-semibold text-slate-400">
            {authorizedSites?.length || 2} sites
          </span>
        </div>

        {/* 2 Site Cards Matching Reference */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Site Card 1: 3D Booth Graphic */}
          <div 
            onClick={() => switchSite(authorizedSites[0]?.id || "site-1")}
            className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-slate-300 transition-all relative overflow-hidden"
          >
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span>Sant</span>
              </div>
              <div className="text-2xl font-black text-slate-900 mt-1">
                100 bays
              </div>
              <span className="bg-emerald-50 text-emerald-600 font-bold text-[10px] px-2.5 py-0.5 rounded-full inline-block mt-2">
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
            className="bg-white rounded-2xl p-4 sm:p-5 border-2 border-[#f25c27] shadow-sm shadow-orange-500/10 flex items-center justify-between cursor-pointer relative overflow-hidden"
          >
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span>Sant</span>
              </div>
              <div className="text-2xl font-black text-slate-900 mt-1">
                100 bays
              </div>
              <span className="bg-emerald-50 text-emerald-600 font-bold text-[10px] px-2.5 py-0.5 rounded-full inline-block mt-2">
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
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden min-h-[145px]">
          {/* Top Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Calendar className="w-4 h-4 text-slate-600" />
              <span>Today Entries</span>
            </div>
            <div className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Big Number */}
          <div className="my-2">
            <span className="text-4xl font-extrabold text-slate-900">
              {stats.today_vehicle_count}
            </span>
          </div>

          {/* Bottom Badge */}
          <div className="flex items-center gap-2">
            <span className="bg-emerald-50 text-emerald-600 font-bold text-xs px-2 py-0.5 rounded-full">
              +{entriesGrowthPct}%
            </span>
            <span className="text-xs text-slate-400 font-medium">vs yesterday</span>
          </div>

          {/* Soft Peach Mini Bar Graphic */}
          <div className="absolute right-5 bottom-4 flex items-end gap-1.5 h-12 pointer-events-none">
            <div className="w-2.5 rounded-full bg-orange-100/80 h-4" />
            <div className="w-2.5 rounded-full bg-orange-100/90 h-8" />
            <div className="w-2.5 rounded-full bg-orange-100 h-6" />
            <div className="w-2.5 rounded-full bg-orange-200 h-12" />
            <div className="w-2.5 rounded-full bg-orange-100/80 h-9" />
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
              {occupied}
            </span>
          </div>

          {/* Bottom Occupied Pill */}
          <div className="z-10">
            <span className="bg-white/20 backdrop-blur-sm text-white text-[11px] font-bold px-3 py-1 rounded-full inline-block">
              {occupiedPct}% occupied
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
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 shadow-sm flex items-center justify-between min-h-[135px]">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Box className="w-4 h-4 text-slate-600" />
              <span>Available Bays</span>
            </div>
            <div className="text-4xl font-black text-emerald-500 mt-2">
              {available}
            </div>
            <div className="text-xs text-slate-400 font-medium mt-1">
              Ready for entry
            </div>
          </div>

          {/* Radial Circular Progress Gauge */}
          <div className="relative w-18 h-18 sm:w-20 sm:h-20 flex items-center justify-center shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              {/* Background ring */}
              <path
                className="text-emerald-100"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              {/* Foreground progress ring */}
              <path
                className="text-emerald-500"
                strokeDasharray={`${availablePct}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute text-xs font-extrabold text-slate-900">
              {availablePct}%
            </span>
          </div>
        </div>

        {/* Card 2: Target Pace (with Progress Track & Checkered Flag) */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 shadow-sm flex flex-col justify-between min-h-[135px]">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Target className="w-4 h-4 text-slate-600" />
            <span>Target Pace</span>
          </div>

          <div className="text-4xl font-black text-slate-900 my-1">
            {targetProgressPct}%
          </div>

          {/* Goal Text & Progress Track */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-xs text-slate-500 font-semibold">
              ₹{(targetPaise / 100).toLocaleString("en-IN")} goal
            </span>

            {/* Horizontal Track with Orange Scrubber and Checkered Flag */}
            <div className="flex items-center gap-2 flex-1 max-w-[200px]">
              <div className="relative flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-orange-400 to-[#f25c27] rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(6, targetProgressPct)}%` }}
                />
              </div>
              <div className="w-3 h-3 rounded-full bg-[#f25c27] ring-4 ring-orange-100 -ml-2.5 z-10 shrink-0" />
              <span className="text-base select-none leading-none">🏁</span>
            </div>
          </div>
        </div>
      </section>

      {/* ────────── 6. VOLUME & REVENUE CHART (7 DAYS DUAL-AXIS COMBO CHART) ────────── */}
      <section className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-sm space-y-4">
        {/* Chart Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-slate-700" />
              <h3 className="text-base font-bold text-slate-900">Volume & Revenue</h3>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Weekly parking collection and vehicle counts
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Chart Legend */}
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f25c27]" />
                <span>Revenue (₹)</span>
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-black" />
                <span>Vehicles</span>
              </span>
            </div>

            {/* 7 Days Dropdown Pill */}
            <button
              type="button"
              className="border border-slate-200 rounded-full px-3 py-1.5 text-xs font-bold text-slate-700 flex items-center gap-1.5 hover:bg-slate-50 transition-colors"
            >
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>7 Days</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Dual-Axis SVG & Column Chart */}
        <div className="relative pt-4 pb-2">
          {/* Grid Container with Left & Right Y-Axes */}
          <div className="flex gap-2">
            {/* Left Y-Axis: Currency */}
            <div className="flex flex-col justify-between text-[11px] font-semibold text-slate-400 h-44 py-1 text-right w-10 shrink-0">
              <span>₹20k</span>
              <span>₹15k</span>
              <span>₹10k</span>
              <span>₹5k</span>
              <span>₹0</span>
            </div>

            {/* Center Chart Plot Area */}
            <div className="flex-1 relative h-44">
              {/* Dashed Horizontal Grid Lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                <div className="border-b border-dashed border-slate-100 w-full" />
                <div className="border-b border-dashed border-slate-100 w-full" />
                <div className="border-b border-dashed border-slate-100 w-full" />
                <div className="border-b border-dashed border-slate-100 w-full" />
                <div className="border-b border-slate-200 w-full" />
              </div>

              {/* 7 Column Revenue Bars */}
              <div className="absolute inset-0 flex justify-around items-end px-2 z-10">
                {chartDays.map((item, idx) => {
                  // Normalize bar height against ₹20,000 (176px max height)
                  const barHeight = Math.min(150, Math.max(12, Math.round((item.rev / 20000) * 150)));

                  return (
                    <div key={idx} className="flex flex-col items-center group relative h-full justify-end">
                      {/* Tooltip on hover */}
                      <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-md pointer-events-none whitespace-nowrap z-30">
                        ₹{item.rev.toLocaleString("en-IN")} • {item.count} cars
                      </div>

                      {/* Orange Column Bar */}
                      <div
                        className="w-7 sm:w-10 rounded-lg bg-gradient-to-t from-orange-400 to-[#f25c27] transition-all duration-300 group-hover:brightness-105"
                        style={{ height: `${barHeight}px` }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Black Line Chart Overlay for Vehicle Volume */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible" preserveAspectRatio="none">
                {/* SVG Polyline connecting vehicle data points */}
                <polyline
                  fill="none"
                  stroke="#141416"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={chartDays.map((item, idx) => {
                    // Spread points evenly across 7 slots
                    const xPercent = (idx / 6) * 100;
                    // Normalize against 80 vehicles max height
                    const y = 176 - Math.min(160, Math.max(15, Math.round((item.count / 80) * 160)));
                    return `${xPercent}%,${y}`;
                  }).join(" ")}
                />

                {/* Circular Nodes on top of each data point */}
                {chartDays.map((item, idx) => {
                  const xPercent = (idx / 6) * 100;
                  const y = 176 - Math.min(160, Math.max(15, Math.round((item.count / 80) * 160)));

                  return (
                    <g key={idx}>
                      <circle
                        cx={`${xPercent}%`}
                        cy={y}
                        r="4"
                        fill="#141416"
                        stroke="#ffffff"
                        strokeWidth="2"
                      />
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Right Y-Axis: Vehicle Counts */}
            <div className="flex flex-col justify-between text-[11px] font-semibold text-slate-400 h-44 py-1 text-left w-7 shrink-0">
              <span>80</span>
              <span>60</span>
              <span>40</span>
              <span>20</span>
              <span>0</span>
            </div>
          </div>

          {/* Bottom X-Axis Days Labels */}
          <div className="flex justify-around pl-10 pr-7 pt-2.5">
            {chartDays.map((item, idx) => (
              <div key={idx} className="flex flex-col items-center">
                <span className="text-[11px] font-bold text-slate-700 leading-tight">
                  {item.day}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
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
