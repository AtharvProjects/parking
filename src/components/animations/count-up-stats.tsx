"use client";

import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { IndianRupee, Sparkles, Star, TrendingUp } from "lucide-react";
import { useReducedMotion } from "@/lib/use-reduced-motion";

export function CountUpStats() {
  const containerRef = useRef<HTMLDivElement>(null);
  const ringCircleRef = useRef<SVGCircleElement>(null);
  const trendLineRef = useRef<SVGPathElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);

  const [percentVal, setPercentVal] = useState(0);
  const [revenueVal, setRevenueVal] = useState(0);
  const [ratingVal, setRatingVal] = useState("0.0");
  const hasAnimatedRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();

  const targetPercent = 94;
  const targetRevenue = 84500;
  const targetRating = 4.9;

  // Ring circumference for r=42 is 2 * Math.PI * 42 ≈ 263.89
  const ringCircumference = 263.89;

  useEffect(() => {
    if (prefersReducedMotion) {
      setPercentVal(targetPercent);
      setRevenueVal(targetRevenue);
      setRatingVal(targetRating.toFixed(1));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !hasAnimatedRef.current) {
          hasAnimatedRef.current = true;

          const ctx = gsap.context(() => {
            const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

            // 1. Counter tween objects
            const counts = { percent: 0, revenue: 0, rating: 0 };

            tl.to(counts, {
              percent: targetPercent,
              revenue: targetRevenue,
              rating: targetRating,
              duration: 2.0,
              onUpdate: () => {
                setPercentVal(Math.round(counts.percent));
                setRevenueVal(Math.round(counts.revenue));
                setRatingVal(counts.rating.toFixed(1));
              },
            });

            // 2. Animate Circular Progress Ring
            if (ringCircleRef.current) {
              const targetOffset = ringCircumference - (targetPercent / 100) * ringCircumference;
              gsap.fromTo(
                ringCircleRef.current,
                { strokeDashoffset: ringCircumference },
                { strokeDashoffset: targetOffset, duration: 2.0, ease: "power3.out" }
              );
            }

            // 3. Staggered vertical bar heights
            if (barsRef.current) {
              const bars = barsRef.current.children;
              gsap.fromTo(
                bars,
                { scaleY: 0, transformOrigin: "bottom" },
                { scaleY: 1, stagger: 0.1, duration: 1.2, ease: "back.out(1.5)" }
              );
            }

            // 4. Draw trendline with stroke-dashoffset
            if (trendLineRef.current) {
              const lineLength = trendLineRef.current.getTotalLength();
              gsap.fromTo(
                trendLineRef.current,
                { strokeDasharray: lineLength, strokeDashoffset: lineLength },
                { strokeDashoffset: 0, duration: 1.8, ease: "power2.out" }
              );
            }
          }, containerRef);

          return () => ctx.revert();
        }
      },
      { threshold: 0.25 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  return (
    <div
      ref={containerRef}
      className="w-full max-w-5xl mx-auto px-4 py-12 select-none"
    >
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-xs font-semibold tracking-wide uppercase mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>05 · Count-Up Stats</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
          Proven metrics from live parking lots
        </h2>
        <p className="text-muted-foreground mt-2 max-w-lg mx-auto text-sm sm:text-base">
          Triggered dynamically on scroll, highlighting space efficiency, revenue spikes, and customer satisfaction.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Circular Progress Ring */}
        <div className="p-6 rounded-3xl bg-card border border-border shadow-lg flex flex-col items-center text-center justify-between">
          <div className="w-full flex items-center justify-between text-xs text-muted-foreground font-semibold mb-4">
            <span>LOT EFFICIENCY</span>
            <span className="text-emerald-500">Live</span>
          </div>

          <div className="relative w-36 h-36 flex items-center justify-center my-2">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="42"
                className="stroke-muted"
                strokeWidth="8"
                fill="none"
              />
              {/* Animated progress circle */}
              <circle
                ref={ringCircleRef}
                cx="50"
                cy="50"
                r="42"
                stroke="#f97316"
                strokeWidth="8"
                strokeLinecap="round"
                fill="none"
                style={{
                  strokeDasharray: ringCircumference,
                  strokeDashoffset: prefersReducedMotion
                    ? ringCircumference - (targetPercent / 100) * ringCircumference
                    : ringCircumference,
                }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-extrabold text-foreground font-mono">
                {percentVal}%
              </span>
              <span className="text-[11px] text-muted-foreground font-medium uppercase">
                Occupancy
              </span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            Zero vacant spot wastage during peak operating hours.
          </p>
        </div>

        {/* Card 2: Revenue Figure with 7 Rising Bars */}
        <div className="p-6 rounded-3xl bg-card border border-border shadow-lg flex flex-col justify-between">
          <div>
            <div className="text-xs text-muted-foreground font-semibold mb-2">
              DAILY COLLECTION PEAK
            </div>
            <div className="flex items-baseline gap-1 text-3xl font-black text-foreground font-mono">
              <IndianRupee className="w-7 h-7 text-orange-500" />
              <span>{revenueVal.toLocaleString()}</span>
            </div>
          </div>

          {/* 7 Bars Chart */}
          <div
            ref={barsRef}
            className="flex items-end justify-between gap-2 h-28 my-4 pt-4 border-b border-border/60"
          >
            {[40, 55, 65, 50, 75, 85, 100].map((height, i) => (
              <div
                key={i}
                style={{ height: `${height}%` }}
                className={`w-full rounded-t-md transition-colors ${
                  i === 6
                    ? "bg-gradient-to-t from-orange-600 to-amber-500 shadow-md shadow-orange-500/20"
                    : "bg-muted-foreground/20"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Mon - Sat Growth</span>
            <span className="text-emerald-500 font-semibold">+24.3% YoY</span>
          </div>
        </div>

        {/* Card 3: Rating with Auto-Drawing Trendline */}
        <div className="p-6 rounded-3xl bg-card border border-border shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">
              GATE SATISFACTION
            </span>
            <div className="flex items-center gap-0.5 text-orange-500">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-current" />
              ))}
            </div>
          </div>

          <div className="my-2">
            <div className="text-4xl font-black text-foreground font-mono">
              {ratingVal}
              <span className="text-lg text-muted-foreground font-normal"> / 5.0</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <span>99.2% positive fast-exit reviews</span>
            </div>
          </div>

          {/* Animated Trendline SVG */}
          <div className="h-20 w-full overflow-hidden">
            <svg
              className="w-full h-full overflow-visible"
              viewBox="0 0 240 60"
              preserveAspectRatio="none"
            >
              <path
                ref={trendLineRef}
                d="M 0,50 Q 40,40 80,45 T 160,20 T 240,5"
                fill="none"
                stroke="#10b981"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div className="text-xs text-muted-foreground pt-2 border-t border-border/60">
            Average entry exit turnaround &lt; 5 seconds
          </div>
        </div>
      </div>
    </div>
  );
}
