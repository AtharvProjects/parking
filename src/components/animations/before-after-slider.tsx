"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { AlertCircle, CheckCircle2, Clock, FileText, Sparkles, TrendingUp } from "lucide-react";
import { useReducedMotion } from "@/lib/use-reduced-motion";

export function BeforeAfterSlider() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const afterClipRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const [sliderPct, setSliderPct] = useState(50);
  const hasSweptRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();

  const updateSlider = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const pct = Math.min(Math.max(((clientX - rect.left) / rect.width) * 100, 4), 96);
    setSliderPct(pct);
    if (afterClipRef.current) {
      afterClipRef.current.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
    }
    if (sliderRef.current) {
      sliderRef.current.style.left = `${pct}%`;
    }
  }, []);

  // Intro sweep animation
  useEffect(() => {
    if (prefersReducedMotion || hasSweptRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || hasSweptRef.current) return;
        hasSweptRef.current = true;

        const obj = { pct: 100 };

        // Sweep from right to 50%
        gsap.to(obj, {
          pct: 50,
          duration: 1.4,
          ease: "power2.inOut",
          delay: 0.4,
          onUpdate() {
            setSliderPct(obj.pct);
            if (afterClipRef.current) {
              afterClipRef.current.style.clipPath = `inset(0 ${100 - obj.pct}% 0 0)`;
            }
            if (sliderRef.current) {
              sliderRef.current.style.left = `${obj.pct}%`;
            }
          },
        });
      },
      { threshold: 0.3 }
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  // Mouse/Touch events
  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging.current) return;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      updateSlider(clientX);
    };
    const onUp = () => { isDragging.current = false; };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [updateSlider]);

  const BEFORE_ITEMS = [
    { icon: FileText, label: "Paper slip entry", detail: "Legible errors, lost receipts" },
    { icon: AlertCircle, label: "Cash leakage risk", detail: "No audit trail per shift" },
    { icon: Clock, label: "40s avg gate time", detail: "Queue builds fast at peak" },
  ];
  const AFTER_ITEMS = [
    { icon: CheckCircle2, label: "Thermal QR slip < 1s", detail: "Tamper-proof, scannable" },
    { icon: TrendingUp, label: "Auto cash settlement", detail: "Per-session audit report" },
    { icon: CheckCircle2, label: "4s avg gate time", detail: "10× faster turnaround" },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-16 select-none">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-xs font-semibold tracking-wide uppercase mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>09 · Before / After Slider</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
          The transformation is undeniable
        </h2>
        <p className="text-muted-foreground mt-2 max-w-lg mx-auto text-sm sm:text-base">
          Drag the divider to compare manual operations with the Sant Wamanbhau smart parking experience.
        </p>
      </div>

      {/* Comparison Container */}
      <div
        ref={containerRef}
        className="relative w-full h-[360px] rounded-3xl overflow-hidden border border-border shadow-2xl cursor-col-resize touch-none"
        onMouseDown={(e) => { isDragging.current = true; updateSlider(e.clientX); }}
        onTouchStart={(e) => { isDragging.current = true; updateSlider(e.touches[0].clientX); }}
      >
        {/* BEFORE (base layer) */}
        <div className="absolute inset-0 flex flex-col justify-center gap-4 px-10 bg-zinc-950">
          <div className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-1">
            ← BEFORE — Traditional Parking
          </div>
          {BEFORE_ITEMS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="flex items-center gap-3 text-zinc-400">
                <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-zinc-200">{item.label}</div>
                  <div className="text-xs text-zinc-500">{item.detail}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* AFTER (clip layer on top) */}
        <div
          ref={afterClipRef}
          className="absolute inset-0 flex flex-col justify-center gap-4 px-10 bg-gradient-to-br from-zinc-900 to-zinc-950"
          style={{ clipPath: `inset(0 ${100 - sliderPct}% 0 0)` }}
        >
          <div className="text-xs font-black uppercase tracking-widest text-orange-500 mb-1">
            AFTER — Sant Wamanbhau →
          </div>
          {AFTER_ITEMS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{item.label}</div>
                  <div className="text-xs text-zinc-400">{item.detail}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Drag Handle */}
        <div
          ref={sliderRef}
          className="absolute top-0 bottom-0 z-20 flex flex-col items-center justify-center pointer-events-none"
          style={{ left: `${sliderPct}%`, transform: "translateX(-50%)" }}
        >
          <div className="h-full w-0.5 bg-orange-500/80" />
          <div className="absolute w-10 h-10 rounded-full bg-orange-500 border-4 border-white shadow-xl flex items-center justify-center text-white font-bold text-xs">
            ↔
          </div>
        </div>
      </div>
    </div>
  );
}
