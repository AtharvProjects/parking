"use client";

import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { Check, Sparkles, X } from "lucide-react";
import { useReducedMotion } from "@/lib/use-reduced-motion";

const FEATURES = [
  "Offline-First Operation",
  "Real-Time Revenue Analytics",
  "Thermal Ticket Printing",
  "Shift Handover with Settlement",
  "Multi-Gate Support",
  "Automated Audit Trail",
  "UPI / QR Payment Support",
  "Role-Based Staff Access",
];

const THEM: boolean[] = [false, false, false, false, false, true, false, false];
const US: boolean[] = [true, true, true, true, true, true, true, true];

export function UsVsThem() {
  const containerRef = useRef<HTMLDivElement>(null);
  const usColumnRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hasAnimatedRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || hasAnimatedRef.current) return;
        hasAnimatedRef.current = true;

        const ctx = gsap.context(() => {
          // Rows slide in from left
          gsap.fromTo(
            rowRefs.current,
            { x: -30, opacity: 0 },
            { x: 0, opacity: 1, stagger: 0.1, duration: 0.6, ease: "power2.out" }
          );

          // "Us" column glowing pulse
          gsap.fromTo(
            usColumnRef.current,
            { boxShadow: "0 0 0 0 rgba(249,115,22,0)", scale: 1 },
            {
              boxShadow: "0 0 40px 8px rgba(249,115,22,0.18)",
              scale: 1.01,
              duration: 0.9,
              ease: "power2.out",
              delay: FEATURES.length * 0.1 + 0.2,
              yoyo: false,
            }
          );
        }, containerRef);

        return () => ctx.revert();
      },
      { threshold: 0.2 }
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  return (
    <div ref={containerRef} className="w-full max-w-3xl mx-auto px-4 py-16 select-none">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-xs font-semibold tracking-wide uppercase mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>11 · Us vs Them</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
          There's really no comparison
        </h2>
        <p className="text-muted-foreground mt-2 max-w-lg mx-auto text-sm sm:text-base">
          Why thousands of parking operators switched to Sant Wamanbhau.
        </p>
      </div>

      <div className="rounded-3xl overflow-hidden border border-border shadow-xl">
        {/* Header */}
        <div className="grid grid-cols-3 bg-muted/60 border-b border-border px-2 py-4">
          <div className="col-span-1 text-xs font-bold text-muted-foreground uppercase tracking-wider pl-4">
            Capability
          </div>
          <div className="col-span-1 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Traditional
          </div>
          <div
            ref={usColumnRef}
            className="col-span-1 text-center text-xs font-black text-orange-500 uppercase tracking-wider rounded-xl bg-orange-500/10 border border-orange-500/20 py-1"
          >
            Sant Wamanbhau ✦
          </div>
        </div>

        {/* Feature Rows */}
        {FEATURES.map((feature, idx) => (
          <div
            key={idx}
            ref={(el) => { rowRefs.current[idx] = el; }}
            className={`grid grid-cols-3 items-center px-2 py-3.5 border-b border-border/60 last:border-0 transition-colors ${
              idx % 2 === 0 ? "bg-card" : "bg-muted/20"
            }`}
          >
            <div className="col-span-1 text-sm font-medium text-foreground pl-4">{feature}</div>

            {/* Them */}
            <div className="col-span-1 flex justify-center">
              {THEM[idx] ? (
                <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <X className="w-3.5 h-3.5 text-red-400" />
                </div>
              )}
            </div>

            {/* Us */}
            <div className="col-span-1 flex justify-center">
              {US[idx] ? (
                <div className="w-6 h-6 rounded-full bg-orange-500/15 border border-orange-500/30 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-orange-500" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center">
                  <X className="w-3.5 h-3.5 text-red-400" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
