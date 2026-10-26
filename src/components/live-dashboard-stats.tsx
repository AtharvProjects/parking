"use client";

import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { IndianRupee, Star, TrendingUp } from "lucide-react";
import { useReducedMotion } from "@/lib/use-reduced-motion";

interface LiveDashboardStatsProps {
  occupancyPct: number;
  todayRevenueRupees: number;
  todayVehicleCount: number;
  revenueGrowthPct: number;
}

export function LiveDashboardStats({
  occupancyPct,
  todayRevenueRupees,
  todayVehicleCount,
  revenueGrowthPct,
}: LiveDashboardStatsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ringCircleRef = useRef<SVGCircleElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  const [displayPct, setDisplayPct] = useState(0);
  const [displayRevenue, setDisplayRevenue] = useState(0);
  const [displayCount, setDisplayCount] = useState(0);
  const prevPropsRef = useRef({ occupancyPct: -1, todayRevenueRupees: -1, todayVehicleCount: -1 });
  const hasInitRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();

  const ringCircumference = 263.89; // r=42

  useEffect(() => {
    const prev = prevPropsRef.current;
    const shouldAnimate =
      !prefersReducedMotion &&
      (prev.occupancyPct !== occupancyPct ||
        prev.todayRevenueRupees !== todayRevenueRupees ||
        prev.todayVehicleCount !== todayVehicleCount);

    prevPropsRef.current = { occupancyPct, todayRevenueRupees, todayVehicleCount };

    if (!shouldAnimate && hasInitRef.current) {
      setDisplayPct(occupancyPct);
      setDisplayRevenue(todayRevenueRupees);
      setDisplayCount(todayVehicleCount);
      return;
    }

    hasInitRef.current = true;

    if (prefersReducedMotion) {
      setDisplayPct(occupancyPct);
      setDisplayRevenue(todayRevenueRupees);
      setDisplayCount(todayVehicleCount);
      return;
    }

    const ctx = gsap.context(() => {
      const counts = {
        pct: displayPct,
        revenue: displayRevenue,
        count: displayCount,
      };

      gsap.to(counts, {
        pct: occupancyPct,
        revenue: todayRevenueRupees,
        count: todayVehicleCount,
        duration: 1.4,
        ease: "power3.out",
        onUpdate: () => {
          setDisplayPct(Math.round(counts.pct));
          setDisplayRevenue(Math.round(counts.revenue));
          setDisplayCount(Math.round(counts.count));
        },
      });

      if (ringCircleRef.current) {
        const targetOffset = ringCircumference - (occupancyPct / 100) * ringCircumference;
        gsap.to(ringCircleRef.current, {
          strokeDashoffset: targetOffset,
          duration: 1.4,
          ease: "power3.out",
        });
      }

      if (barsRef.current) {
        gsap.fromTo(
          barsRef.current.children,
          { scaleY: 0, transformOrigin: "bottom" },
          { scaleY: 1, stagger: 0.08, duration: 0.9, ease: "back.out(1.5)" }
        );
      }
    }, containerRef);

    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [occupancyPct, todayRevenueRupees, todayVehicleCount, prefersReducedMotion]);

  const barHeights = [40, 55, 65, 50, 75, 85, 100];

  return (
    <div
      ref={containerRef}
      className="grid grid-cols-1 sm:grid-cols-3 gap-4"
    >
      {/* Card 1: Circular Occupancy Ring */}
      <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col items-center text-center gap-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Space Utilisation
        </span>
        <div className="relative w-24 h-24">
          <svg
            className="w-full h-full transform -rotate-90"
            viewBox="0 0 100 100"
          >
            <circle
              cx="50" cy="50" r="42"
              className="stroke-slate-100"
              strokeWidth="9"
              fill="none"
            />
            <circle
              ref={ringCircleRef}
              cx="50" cy="50" r="42"
              stroke="#f25c27"
              strokeWidth="9"
              strokeLinecap="round"
              fill="none"
              style={{
                strokeDasharray: ringCircumference,
                strokeDashoffset: prefersReducedMotion
                  ? ringCircumference - (occupancyPct / 100) * ringCircumference
                  : ringCircumference,
              }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {displayPct}%
            </span>
            <span className="text-[10px] text-slate-400 font-semibold uppercase">
              Occupied
            </span>
          </div>
        </div>
      </div>

      {/* Card 2: Today's Revenue with Rising Bars */}
      <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Today's Revenue
          </span>
          <div className="flex items-baseline gap-0.5 mt-2 text-3xl font-black text-slate-900 font-mono">
            <IndianRupee className="w-6 h-6 text-[#f25c27] self-start mt-1" />
            <span>{displayRevenue.toLocaleString("en-IN")}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-emerald-600 font-semibold">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>
              {revenueGrowthPct >= 0 ? "+" : ""}
              {revenueGrowthPct}% vs yesterday
            </span>
          </div>
        </div>
        <div
          ref={barsRef}
          className="flex items-end justify-between gap-1 h-12 mt-4 border-b border-slate-100"
        >
          {barHeights.map((h, i) => (
            <div
              key={i}
              style={{ height: `${h}%` }}
              className={`w-full rounded-t-sm ${
                i === 6 ? "bg-[#f25c27]" : "bg-slate-100"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Card 3: Vehicle Count with Star */}
      <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Vehicles Today
          </span>
          <div className="flex items-center gap-0.5 text-orange-500">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-3 h-3 fill-current" />
            ))}
          </div>
        </div>
        <div className="my-3">
          <span className="text-4xl font-black text-slate-900 font-mono">
            {displayCount.toLocaleString("en-IN")}
          </span>
          <div className="text-xs text-slate-400 mt-1 font-medium">
            vehicles processed at this site
          </div>
        </div>
        <div className="pt-3 border-t border-slate-100 text-xs text-emerald-600 font-semibold flex items-center gap-1">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Avg gate time &lt; 5s per vehicle</span>
        </div>
      </div>
    </div>
  );
}
