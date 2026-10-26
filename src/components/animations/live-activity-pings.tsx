"use client";

import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Car, CheckCircle2, IndianRupee, Sparkles, TrendingUp, Wifi } from "lucide-react";
import { useReducedMotion } from "@/lib/use-reduced-motion";

interface ParkingPing {
  id: string;
  vehicleNo: string;
  type: "2-Wheeler" | "4-Wheeler" | "Commercial";
  gate: string;
  amount: number;
  timeAgo: string;
}

const DEFAULT_PINGS: ParkingPing[] = [
  { id: "1", vehicleNo: "MH 12 AB 4521", type: "4-Wheeler", gate: "Main Gate In", amount: 60, timeAgo: "just now" },
  { id: "2", vehicleNo: "MH 14 CC 8890", type: "2-Wheeler", gate: "East Ramp", amount: 30, timeAgo: "12s ago" },
  { id: "3", vehicleNo: "MH 20 EQ 1004", type: "Commercial", gate: "Cargo Gate", amount: 150, timeAgo: "28s ago" },
  { id: "4", vehicleNo: "MH 12 Z 9999", type: "4-Wheeler", gate: "VIP Bay", amount: 120, timeAgo: "45s ago" },
  { id: "5", vehicleNo: "MH 15 BK 3341", type: "2-Wheeler", gate: "West Exit", amount: 30, timeAgo: "1m ago" },
  { id: "6", vehicleNo: "MH 04 TR 7720", type: "4-Wheeler", gate: "North Gate", amount: 80, timeAgo: "2m ago" },
];

export function LiveActivityPings() {
  const [visiblePings, setVisiblePings] = useState<ParkingPing[]>(DEFAULT_PINGS.slice(0, 3));
  const [totalRevenue, setTotalRevenue] = useState(38420);
  const [totalVehicles, setTotalVehicles] = useState(412);
  const phoneListRef = useRef<HTMLDivElement>(null);
  const sparklineRef = useRef<SVGPathElement>(null);
  const revenueDisplayRef = useRef<HTMLSpanElement>(null);
  const prefersReducedMotion = useReducedMotion();

  // Draw the sparkline on mount
  useEffect(() => {
    if (!sparklineRef.current || prefersReducedMotion) return;

    const length = sparklineRef.current.getTotalLength();
    gsap.set(sparklineRef.current, {
      strokeDasharray: length,
      strokeDashoffset: length,
    });

    gsap.to(sparklineRef.current, {
      strokeDashoffset: 0,
      duration: 2,
      ease: "power2.out",
    });
  }, [prefersReducedMotion]);

  // Drop in a new ping every 2.5 seconds
  useEffect(() => {
    if (prefersReducedMotion) return;

    let index = 3;
    const interval = setInterval(() => {
      const nextPing = {
        ...DEFAULT_PINGS[index % DEFAULT_PINGS.length],
        id: `${Date.now()}-${Math.random()}`,
        timeAgo: "just now",
      };

      setVisiblePings((prev) => [nextPing, ...prev.slice(0, 3)]);
      setTotalRevenue((prev) => prev + nextPing.amount);
      setTotalVehicles((prev) => prev + 1);

      index++;
    }, 2500);

    return () => clearInterval(interval);
  }, [prefersReducedMotion]);

  // Animate newly rendered first item dropping in
  useEffect(() => {
    if (prefersReducedMotion || !phoneListRef.current) return;
    const firstItem = phoneListRef.current.firstElementChild;
    if (firstItem) {
      gsap.fromTo(
        firstItem,
        { y: -25, opacity: 0, scale: 0.9 },
        { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2)" }
      );
    }
  }, [visiblePings, prefersReducedMotion]);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-12 select-none">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-xs font-semibold tracking-wide uppercase mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>03 · Live Activity & Social Proof</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
          Real-time check-ins that prove live demand
        </h2>
        <p className="text-muted-foreground mt-2 max-w-xl mx-auto text-sm sm:text-base">
          Watch real-time vehicle arrivals, automated fee collection, and live occupancy trends as they happen.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        {/* Left: Phone Mockup */}
        <div className="relative mx-auto w-full max-w-[340px] rounded-[40px] bg-zinc-950 p-4 border-[6px] border-zinc-800 shadow-2xl shadow-orange-500/10 text-white">
          {/* Top Notch & Status */}
          <div className="flex items-center justify-between px-4 pt-1 pb-3 text-xs text-zinc-400 font-mono">
            <span className="font-semibold text-white">9:41</span>
            <div className="w-20 h-4 bg-zinc-900 rounded-full mx-auto" />
            <div className="flex items-center gap-1.5 text-emerald-400">
              <Wifi className="w-3 h-3" />
              <span>5G</span>
            </div>
          </div>

          <div className="px-2 pb-2">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-3 px-1">
              <span className="font-medium">Live Terminal Stream</span>
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                Active
              </span>
            </div>

            {/* Notification List */}
            <div ref={phoneListRef} className="flex flex-col gap-2.5 min-h-[290px]">
              {visiblePings.map((ping, idx) => (
                <div
                  key={ping.id}
                  className={`p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 backdrop-blur-sm flex items-center justify-between gap-3 shadow-md transition-opacity duration-300 ${
                    idx === 3 ? "opacity-35" : idx === 2 ? "opacity-70" : "opacity-100"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
                      <Car className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold font-mono text-zinc-100 tracking-wider">
                        {ping.vehicleNo}
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        {ping.gate} · {ping.timeAgo}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-emerald-400 font-mono">
                      +₹{ping.amount}
                    </div>
                    <div className="text-[10px] text-zinc-400">{ping.type}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Revenue & Sparkline Card */}
        <div className="w-full max-w-md mx-auto p-6 sm:p-8 rounded-3xl bg-card border border-border shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Today's Live Revenue
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Verified Auto-Calc
            </span>
          </div>

          <div>
            <div className="flex items-baseline gap-1 text-4xl sm:text-5xl font-black text-foreground font-mono tracking-tight">
              <IndianRupee className="w-8 h-8 sm:w-10 sm:h-10 text-orange-500" />
              <span ref={revenueDisplayRef}>{totalRevenue.toLocaleString()}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span>+18.4% compared to yesterday at this hour</span>
            </p>
          </div>

          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>Hourly Vehicle Velocity</span>
              <span className="font-bold text-foreground font-mono">{totalVehicles} Vehicles</span>
            </div>

            {/* SVG Sparkline */}
            <div className="h-20 w-full overflow-hidden">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 300 70" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="sparklineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#f97316" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,55 Q30,45 60,50 T120,30 T180,38 T240,15 T300,8 L300,70 L0,70 Z"
                  fill="url(#sparklineGrad)"
                />
                <path
                  ref={sparklineRef}
                  d="M0,55 Q30,45 60,50 T120,30 T180,38 T240,15 T300,8"
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
