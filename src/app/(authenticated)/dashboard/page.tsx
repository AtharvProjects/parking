"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { dashboardService } from "@/services/dashboard.service";
import { formatINR } from "@/lib/formatters";
import { sessionsService } from "@/services/sessions.service";
import { cn } from "@/lib/utils";
import {
  Car,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  X,
  Check,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const { employee } = useAuth();
  const siteId = employee?.site_id;

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats", siteId],
    queryFn: () => dashboardService.getStats(siteId),
    enabled: !!siteId,
    refetchInterval: 60_000,
  });

  const { data: activeVehicles } = useQuery({
    queryKey: ["active-vehicles", siteId],
    queryFn: () => sessionsService.getActiveSessions(siteId),
    enabled: !!siteId,
    refetchInterval: 30_000,
  });

  if (isLoading || !stats) {
    return (
      <div className="p-4 space-y-6">
        <div className="skeleton h-64 rounded-b-[40px] -mx-4 -mt-4" />
        <div className="flex gap-4 px-4 overflow-hidden">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-32 min-w-[140px] rounded-[24px]" />)}
        </div>
      </div>
    );
  }

  const available = Math.max(0, stats.total_slots - stats.active_vehicles);
  const occupied = stats.active_vehicles;
  const capacity = stats.total_slots;
  
  const occupiedPct = capacity > 0 ? (occupied / capacity) * 100 : 0;
  const availablePct = capacity > 0 ? (available / capacity) * 100 : 0;
  const todayDate = new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" });

  return (
    <div className="pb-8">
      {/* Top Purple Section */}
      <div className="bg-primary text-white pt-10 pb-32 px-6 rounded-b-[40px] relative">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <Car className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">My Parking</h1>
              <p className="text-sm text-white/80">Current status</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-white/20 px-3 py-1.5 rounded-full text-sm font-medium backdrop-blur-sm hidden sm:block">
              {todayDate}
            </div>
            <Link href="/settings" className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors">
              <Settings className="w-5 h-5 text-white" />
            </Link>
          </div>
        </div>

        <div className="space-y-1">
          <h2 className="text-5xl font-extrabold tracking-tight">{formatINR(stats.today_revenue)}</h2>
          <p className="text-white/80 font-medium">Today's Revenue</p>
        </div>
      </div>

      {/* Main Content Container Overlapping Header */}
      <div className="relative -mt-20 px-4 space-y-6">
        
        {/* Horizontal Scroll Cards */}
        <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2 pt-2 -mx-4 px-4">
          
          {/* Card 1: Available Slots */}
          <div className="bg-white rounded-[24px] p-5 shadow-sm min-w-[150px] flex-shrink-0">
            <div className="flex justify-between items-start mb-6">
              <span className="text-4xl font-extrabold text-gray-900">{available}</span>
              <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                <Car className="w-4 h-4 text-emerald-500" />
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-2">Available Slots</p>
            <p className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Operating Normally
            </p>
          </div>

          {/* Card 2: Occupied */}
          <div className="bg-white rounded-[24px] p-5 shadow-sm min-w-[150px] flex-shrink-0">
            <div className="flex justify-between items-start mb-6">
              <span className="text-4xl font-extrabold text-gray-900">{occupied}</span>
              <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center">
                <Car className="w-4 h-4 text-primary" />
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-2">Occupied</p>
            <p className="text-xs font-semibold text-destructive flex items-center gap-1">
              <TrendingDown className="w-3 h-3" /> Peak Hours
            </p>
          </div>

          {/* Card 3: Today Entries */}
          <div className="bg-white rounded-[24px] p-5 shadow-sm min-w-[150px] flex-shrink-0">
            <div className="flex justify-between items-start mb-6">
              <span className="text-4xl font-extrabold text-gray-900">{stats.today_vehicle_count}</span>
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                <Car className="w-4 h-4 text-blue-500" />
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-2">Today's Entries</p>
            <p className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> 12% vs y'day
            </p>
          </div>

        </div>

        {/* Scroll Indicator */}
        <div className="flex justify-center -mt-2">
          <div className="w-32 h-1.5 bg-gray-200 rounded-full" />
        </div>

        {/* Active Vehicle Pill */}
        {activeVehicles && activeVehicles.length > 0 && (
          <div className="bg-white rounded-[28px] p-3 pl-4 flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-50 rounded-[14px] flex items-center justify-center shrink-0">
                <Car className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 leading-tight">{activeVehicles[0].vehicle_number}</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Slot A-21 • by {activeVehicles[0].entry_operator_name.split(' ')[0]}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="font-bold text-gray-900 leading-tight">₹40</p>
                <p className="text-[10px] text-gray-500">Cash</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => router.push('/gate/active')}
                  className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => router.push('/gate/active')}
                  className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
                >
                  <Check className="w-5 h-5" strokeWidth={3} />
                </button>
              </div>
            </div>
          </div>
        )}

        <div 
          className="bg-white rounded-[32px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => router.push('/gate/active')}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[22px] font-bold text-gray-900 tracking-tight">Parking overview</h2>
            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center">
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
          </div>

          <div className="grid grid-cols-3 mb-6">
            <div>
              <p className="text-[13px] font-medium text-gray-400 mb-1">Capacity</p>
              <p className="text-2xl font-bold text-primary">{capacity}</p>
            </div>
            <div>
              <p className="text-[13px] font-medium text-gray-400 mb-1">Occupied</p>
              <p className="text-2xl font-bold text-[#38BDF8]">{occupied}</p>
            </div>
            <div>
              <p className="text-[13px] font-medium text-gray-400 mb-1">Available</p>
              <p className="text-2xl font-bold text-gray-900">{available}</p>
            </div>
          </div>

          <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden flex mb-4">
            <div className="h-full bg-primary" style={{ width: `${occupiedPct}%` }} />
            <div className="h-full bg-[#38BDF8]" style={{ width: `${availablePct}%` }} />
          </div>

          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-500">
            <Check className="w-4 h-4" />
            Parking Operating Normally!
          </div>
        </div>

      </div>
    </div>
  );
}
