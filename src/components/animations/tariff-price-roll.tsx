"use client";

import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { BadgePercent, IndianRupee, Sparkles } from "lucide-react";
import { useReducedMotion } from "@/lib/use-reduced-motion";

type Period = "hour" | "day" | "month";

const TARIFFS: Record<Period, { twoWheeler: number; fourWheeler: number; commercial: number; label: string }> = {
  hour:  { twoWheeler: 15,   fourWheeler: 30,    commercial: 80,   label: "Per Hour" },
  day:   { twoWheeler: 80,   fourWheeler: 200,   commercial: 500,  label: "Day Pass" },
  month: { twoWheeler: 600,  fourWheeler: 1800,  commercial: 4500, label: "Monthly Pass" },
};

function OdometerDigit({ value }: { value: number }) {
  const digitRef = useRef<HTMLSpanElement>(null);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (!digitRef.current || value === prevValueRef.current) return;
    gsap.fromTo(
      digitRef.current,
      { y: -24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.45, ease: "back.out(1.7)" }
    );
    prevValueRef.current = value;
  }, [value]);

  return (
    <span
      ref={digitRef}
      className="inline-block text-4xl sm:text-5xl font-black font-mono text-foreground tabular-nums"
    >
      {value}
    </span>
  );
}

function OdometerNumber({ value }: { value: number }) {
  const digits = String(value).split("").map(Number);
  return (
    <span className="inline-flex items-end gap-0.5 overflow-hidden">
      {digits.map((d, i) => (
        <OdometerDigit key={`${i}-${d}`} value={d} />
      ))}
    </span>
  );
}

export function TariffPriceRoll() {
  const [period, setPeriod] = useState<Period>("hour");
  const knobRef = useRef<HTMLDivElement>(null);
  const saveBadgeRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const knobPositions: Record<Period, string> = {
    hour:  "left-0",
    day:   "left-1/3",
    month: "left-2/3",
  };

  const savings: Record<Period, string | null> = {
    hour: null,
    day: "Save 15%",
    month: "Save 25%",
  };

  const tariff = TARIFFS[period];

  const handleToggle = (p: Period) => {
    if (p === period) return;
    setPeriod(p);

    if (!prefersReducedMotion && saveBadgeRef.current && savings[p]) {
      gsap.fromTo(
        saveBadgeRef.current,
        { scale: 0.5, opacity: 0, y: -8 },
        { scale: 1, opacity: 1, y: 0, duration: 0.4, ease: "back.out(2.5)" }
      );
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-16 select-none">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-xs font-semibold tracking-wide uppercase mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>10 · Tariff Price Roll</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
          Transparent tariffs. Configured your way.
        </h2>
        <p className="text-muted-foreground mt-2 max-w-lg mx-auto text-sm sm:text-base">
          Toggle between hourly, day, and monthly rates — digits roll like a live odometer.
        </p>
      </div>

      {/* Period Toggle */}
      <div className="relative w-full max-w-sm mx-auto mb-10">
        <div className="relative flex items-center justify-between bg-muted rounded-2xl p-1 h-12 border border-border">
          {/* Sliding Knob */}
          <div
            ref={knobRef}
            className={`absolute top-1 bottom-1 w-1/3 rounded-xl bg-orange-500 shadow-lg shadow-orange-500/25 transition-all duration-350 ease-in-out ${knobPositions[period]}`}
          />
          {(["hour", "day", "month"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => handleToggle(p)}
              className={`relative z-10 w-1/3 h-full text-xs font-bold rounded-xl transition-colors duration-200 ${
                period === p ? "text-white" : "text-muted-foreground"
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        {/* Save Badge */}
        {savings[period] && (
          <div
            ref={saveBadgeRef}
            className="absolute -top-3 right-2 px-3 py-0.5 rounded-full bg-emerald-500 text-white text-xs font-black shadow-md"
          >
            {savings[period]}
          </div>
        )}
      </div>

      {/* Tariff Cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { type: "2-Wheeler", amount: tariff.twoWheeler, emoji: "🛵", accentColor: "orange" },
          { type: "4-Wheeler", amount: tariff.fourWheeler, emoji: "🚗", accentColor: "purple" },
          { type: "Commercial", amount: tariff.commercial, emoji: "🚛", accentColor: "blue" },
        ].map((item) => (
          <div
            key={item.type}
            className="p-5 rounded-2xl bg-card border border-border shadow-lg flex flex-col items-center gap-3 text-center"
          >
            <span className="text-2xl">{item.emoji}</span>
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {item.type}
            </div>
            <div className="flex items-center gap-0.5">
              <IndianRupee className="w-5 h-5 text-orange-500 shrink-0 self-start mt-1.5" />
              <OdometerNumber value={item.amount} />
            </div>
            <div className="text-[11px] text-muted-foreground">{tariff.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 text-center">
        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground font-medium px-4 py-2 rounded-full bg-muted/60 border border-border">
          <BadgePercent className="w-3.5 h-3.5 text-orange-500" />
          All rates configurable in Settings — no code changes required
        </span>
      </div>
    </div>
  );
}
