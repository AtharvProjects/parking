"use client";

import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import {
  BarChart3,
  CreditCard,
  Printer,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users2,
  Wifi,
} from "lucide-react";
import { useReducedMotion } from "@/lib/use-reduced-motion";

export function BentoBuild() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [typedText, setTypedText] = useState("");
  const hasAnimatedRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();

  const fullTextToType = "Thermal QR printed in 0.8s...";

  useEffect(() => {
    if (prefersReducedMotion) {
      setTypedText(fullTextToType);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !hasAnimatedRef.current) {
          hasAnimatedRef.current = true;

          const ctx = gsap.context(() => {
            const tiles = gridRef.current?.querySelectorAll(".bento-tile");
            if (!tiles || tiles.length === 0) return;

            const isMobile = window.innerWidth < 768;

            if (isMobile) {
              // Mobile: clean fade up without rotation
              gsap.fromTo(
                tiles,
                { opacity: 0, y: 30 },
                { opacity: 1, y: 0, stagger: 0.12, duration: 0.8, ease: "power2.out" }
              );
            } else {
              // Desktop: fly-in from varied directions with rotation and back.out(1.5)
              const directions = [
                { x: -50, y: -40, rotation: -8 },
                { x: 50, y: -30, rotation: 8 },
                { x: -40, y: 30, rotation: 6 },
                { x: 40, y: 40, rotation: -6 },
                { x: 0, y: 60, rotation: 4 },
              ];

              tiles.forEach((tile, i) => {
                const dir = directions[i % directions.length];
                gsap.fromTo(
                  tile,
                  {
                    x: dir.x,
                    y: dir.y,
                    rotation: dir.rotation,
                    scale: 0.82,
                    opacity: 0,
                  },
                  {
                    x: 0,
                    y: 0,
                    rotation: 0,
                    scale: 1,
                    opacity: 1,
                    duration: 0.85,
                    delay: i * 0.16,
                    ease: "back.out(1.5)",
                    onComplete: () => {
                      // Trigger typing on tile 1
                      if (i === 0) {
                        let charIdx = 0;
                        const typingInterval = setInterval(() => {
                          charIdx++;
                          setTypedText(fullTextToType.slice(0, charIdx));
                          if (charIdx >= fullTextToType.length) {
                            clearInterval(typingInterval);
                          }
                        }, 50);
                      }
                    },
                  }
                );
              });
            }
          }, containerRef);

          return () => ctx.revert();
        }
      },
      { threshold: 0.2 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  return (
    <div
      ref={containerRef}
      className="w-full max-w-5xl mx-auto px-4 py-16 select-none"
    >
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-xs font-semibold tracking-wide uppercase mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>06 · Bento Build Grid</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
          Engineered for relentless gate performance
        </h2>
        <p className="text-muted-foreground mt-2 max-w-xl mx-auto text-sm sm:text-base">
          Every core capability packed into a high-density, interactive feature grid.
        </p>
      </div>

      <div
        ref={gridRef}
        className="grid grid-cols-1 md:grid-cols-2 gap-5"
      >
        {/* Tile 1: Instant QR Entry with Typewriter */}
        <div className="bento-tile p-7 rounded-[28px] bg-card border border-border shadow-lg flex flex-col justify-between overflow-hidden">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center mb-4">
              <QrCode className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-foreground">Instant QR Generation</h3>
            <p className="text-sm text-muted-foreground mt-1">
              High-entropy encrypted thermal QR passes scanned at exit in milliseconds.
            </p>
          </div>
          <div className="mt-6 p-4 rounded-2xl bg-zinc-950 text-emerald-400 font-mono text-xs border border-zinc-800 flex items-center justify-between">
            <span>&gt; {typedText}</span>
            <span className="w-2 h-4 bg-emerald-400 animate-pulse" />
          </div>
        </div>

        {/* Tile 2: Live Analytics with Mini Bar Chart */}
        <div className="bento-tile p-7 rounded-[28px] bg-card border border-border shadow-lg flex flex-col justify-between overflow-hidden">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-foreground">Real-Time Revenue Analytics</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Hourly tariff breakdowns, vehicle split counters, and leak detection alerts.
            </p>
          </div>
          <div className="mt-6 flex items-end justify-between gap-2 h-16 pt-2">
            {[28, 48, 65, 85, 45, 92, 100].map((val, idx) => (
              <div
                key={idx}
                style={{ height: `${val}%` }}
                className={`w-full rounded-md ${
                  idx === 6 ? "bg-orange-500" : "bg-muted-foreground/20"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Tile 3: Hardware Integrations */}
        <div className="bento-tile p-7 rounded-[28px] bg-card border border-border shadow-lg flex flex-col justify-between overflow-hidden">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center mb-4">
              <Printer className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-foreground">Hardware Ready</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Bluetooth thermal printers, barcode scanners, and Android POS handhelds.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {[
              { icon: Printer, label: "58mm / 80mm ESC/POS" },
              { icon: Smartphone, label: "Capacitor Mobile" },
              { icon: CreditCard, label: "UPI QR Dynamic" },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted text-foreground text-xs font-medium border border-border"
                >
                  <Icon className="w-3.5 h-3.5 text-orange-500" />
                  <span>{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tile 4: Shift Handover & Attendants */}
        <div className="bento-tile p-7 rounded-[28px] bg-card border border-border shadow-lg flex flex-col justify-between overflow-hidden">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-500 flex items-center justify-center mb-4">
              <Users2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-foreground">Fast Staff Shift Switch</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Instant 4-digit PIN handover with cash settlement closing reports.
            </p>
          </div>
          <div className="mt-6 flex items-center justify-between">
            <div className="flex -space-x-3">
              {["bg-orange-500", "bg-emerald-500", "bg-indigo-500", "bg-amber-500"].map(
                (bg, i) => (
                  <div
                    key={i}
                    className={`w-9 h-9 rounded-full ${bg} border-2 border-card text-white flex items-center justify-center text-xs font-bold shadow-sm`}
                  >
                    OP{i + 1}
                  </div>
                )
              )}
            </div>
            <span className="text-xs text-muted-foreground font-semibold">
              4 Active Lanes
            </span>
          </div>
        </div>

        {/* Tile 5: Bank-Grade Security & Offline-First (Spans both columns) */}
        <div className="bento-tile md:col-span-2 p-7 rounded-[28px] bg-card border border-border shadow-lg flex flex-col sm:flex-row items-center justify-between gap-6 overflow-hidden">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-semibold mb-1">
                <Wifi className="w-3 h-3" />
                <span>100% Offline Resilience</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-foreground">
                Zero-Downtime Dexie & SQLite Architecture
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                Transactions, ticket numbers, and receipts persist locally on the device and sync to the cloud whenever connectivity resumes.
              </p>
            </div>
          </div>
          <div className="shrink-0 px-5 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono text-sm font-bold flex items-center gap-2">
            <span>AUDIT-LOGGED</span>
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
