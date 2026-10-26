"use client";

import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { CheckCircle2, Clock, QrCode, Sparkles, ScanLine } from "lucide-react";
import { useReducedMotion } from "@/lib/use-reduced-motion";

const STEPS = [
  {
    icon: ScanLine,
    label: "Scan & Enter",
    sub: "Attendant scans vehicle & prints thermal slip in < 1s",
    color: "#f97316",
    bg: "bg-orange-500/10 border-orange-500/20 text-orange-500",
  },
  {
    icon: QrCode,
    label: "Smart Track",
    sub: "Slot auto-assigned, live occupancy counter updates instantly",
    color: "#a855f7",
    bg: "bg-purple-500/10 border-purple-500/20 text-purple-500",
  },
  {
    icon: Clock,
    label: "Tap & Exit",
    sub: "Scan exit QR, fee computed, gate opened in under 4 seconds",
    color: "#10b981",
    bg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-500",
  },
];

export function ProcessDraw() {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgPathRefs = useRef<(SVGPathElement | null)[]>([]);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const checkRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hasAnimatedRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry.isIntersecting || hasAnimatedRef.current) return;
        hasAnimatedRef.current = true;

        const ctx = gsap.context(() => {
          // Set initial states
          gsap.set(nodeRefs.current, { scale: 0, opacity: 0 });
          gsap.set(labelRefs.current, { y: 15, opacity: 0 });
          gsap.set(checkRefs.current, { scale: 0, opacity: 0 });
          svgPathRefs.current.forEach((path) => {
            if (!path) return;
            const length = path.getTotalLength();
            gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
          });

          const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

          STEPS.forEach((_, idx) => {
            // Pop node in
            tl.to(
              nodeRefs.current[idx],
              { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(2)" },
              idx * 0.8
            )
              // Animate label text
              .to(labelRefs.current[idx], { y: 0, opacity: 1, duration: 0.4 }, `+=-0.1`)
              // Draw connector line to next step
              .add(() => {
                const path = svgPathRefs.current[idx];
                if (!path) return;
                const length = path.getTotalLength();
                gsap.to(path, { strokeDashoffset: 0, duration: 0.65, ease: "power2.out" });
              }, `+=-0.05`)
              // Pop check icon
              .to(
                checkRefs.current[idx],
                { scale: 1, opacity: 1, duration: 0.35, ease: "back.out(2.5)" },
                `+=0.25`
              );
          });
        }, containerRef);

        return () => ctx.revert();
      },
      { threshold: 0.3 }
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  return (
    <div ref={containerRef} className="w-full max-w-4xl mx-auto px-4 py-16 select-none">
      <div className="text-center mb-14">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-xs font-semibold tracking-wide uppercase mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>08 · Process Draw</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
          3-step flow. Zero confusion.
        </h2>
        <p className="text-muted-foreground mt-2 max-w-lg mx-auto text-sm sm:text-base">
          From vehicle arrival to gate release — the entire cycle drawn live as you scroll.
        </p>
      </div>

      {/* Steps with SVG Connectors */}
      <div className="relative flex flex-col md:flex-row items-center justify-between gap-10 md:gap-0">
        {/* Connector SVG lines (desktop, horizontal) */}
        <svg
          className="absolute top-1/2 left-0 w-full h-12 -translate-y-1/2 hidden md:block pointer-events-none"
          viewBox="0 0 700 40"
          preserveAspectRatio="none"
          style={{ zIndex: 0 }}
        >
          {[0, 1].map((idx) => (
            <path
              key={idx}
              ref={(el) => { svgPathRefs.current[idx] = el; }}
              d={idx === 0 ? "M 230,20 Q 280,5 350,20" : "M 350,20 Q 420,5 480,20"}
              fill="none"
              stroke={STEPS[idx + 1].color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="8 6"
            />
          ))}
        </svg>

        {/* Connector SVG lines (mobile, vertical) */}
        <svg
          className="absolute left-1/2 top-0 h-full w-12 -translate-x-1/2 md:hidden pointer-events-none"
          viewBox="0 0 40 500"
          preserveAspectRatio="none"
          style={{ zIndex: 0 }}
        >
          {[0, 1].map((idx) => (
            <path
              key={idx}
              ref={(el) => { if (!svgPathRefs.current[idx]) svgPathRefs.current[idx] = el; }}
              d={idx === 0 ? "M 20,140 Q 5,180 20,220" : "M 20,300 Q 5,340 20,380"}
              fill="none"
              stroke={STEPS[idx + 1].color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="8 6"
            />
          ))}
        </svg>

        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          return (
            <div
              key={idx}
              className="relative flex flex-col items-center text-center gap-4 w-full md:w-1/3 z-10"
            >
              {/* Node Circle */}
              <div
                ref={(el) => { nodeRefs.current[idx] = el; }}
                className={`w-24 h-24 rounded-full ${step.bg} border-2 flex items-center justify-center shadow-xl`}
                style={{ willChange: "transform, opacity" }}
              >
                <Icon className="w-10 h-10" />
              </div>

              {/* Check Bubble */}
              <div
                ref={(el) => { checkRefs.current[idx] = el; }}
                className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-emerald-500 border-2 border-card text-white flex items-center justify-center shadow-lg"
                style={{ willChange: "transform, opacity", opacity: 0 }}
              >
                <CheckCircle2 className="w-4 h-4 fill-white stroke-emerald-500" />
              </div>

              {/* Step Label */}
              <div ref={(el) => { labelRefs.current[idx] = el; }}>
                <div className="text-lg font-bold text-foreground">{step.label}</div>
                <div className="text-xs text-muted-foreground max-w-[180px] leading-relaxed">{step.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Tag */}
      <div className="text-center mt-12">
        <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-bold">
          <CheckCircle2 className="w-4 h-4" />
          Fastest Turnaround — Guaranteed
        </span>
      </div>
    </div>
  );
}
