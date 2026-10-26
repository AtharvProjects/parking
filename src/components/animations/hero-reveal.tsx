"use client";

import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { ArrowRight, Play, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { useReducedMotion } from "@/lib/use-reduced-motion";

interface HeroRevealProps {
  headline?: string;
  keyword?: string;
  subtext?: string;
  primaryCta?: string;
  secondaryCta?: string;
  proofNumber?: string;
  proofLabel?: string;
  onPrimaryClick?: () => void;
  onSecondaryClick?: () => void;
  replayKey?: number;
}

export function HeroReveal({
  headline = "Smart parking operations that flow while you sleep.",
  keyword = "flow",
  subtext = "High-speed gate check-ins, automated offline sync, and real-time revenue intelligence tailored for modern operators.",
  primaryCta = "Launch Gate Terminal",
  secondaryCta = "Explore Flow",
  proofNumber = "₹4,82,900",
  proofLabel = "Processed this month across 12,400+ vehicles",
  onPrimaryClick,
  onSecondaryClick,
  replayKey = 0,
}: HeroRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subtextRef = useRef<HTMLParagraphElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);
  const proofCardRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!containerRef.current || prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      const words = headlineRef.current?.querySelectorAll(".word-item");
      if (!words || words.length === 0) return;

      // Set initial states
      gsap.set(words, { opacity: 0, y: 40, filter: "blur(12px)" });
      gsap.set(subtextRef.current, { opacity: 0, y: 15 });
      gsap.set(buttonsRef.current, { opacity: 0, y: 15 });
      gsap.set(proofCardRef.current, { opacity: 0, y: 35, scale: 0.95 });

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      // Staggered words reveal
      tl.to(words, {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        stagger: 0.1,
        duration: 0.8,
      })
        // Subtext & Buttons fade in
        .to(
          subtextRef.current,
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
          },
          "-=0.4"
        )
        .to(
          buttonsRef.current,
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
          },
          "-=0.3"
        )
        // Proof card slides up from below
        .to(
          proofCardRef.current,
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.6,
            ease: "back.out(1.4)",
          },
          "-=0.2"
        );
    }, containerRef);

    return () => ctx.revert();
  }, [prefersReducedMotion, replayKey]);

  const words = headline.split(" ");

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-4xl mx-auto px-4 py-8 md:py-16 flex flex-col items-center text-center select-none"
    >
      {/* Category Tag */}
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-xs font-semibold tracking-wide uppercase mb-6 shadow-sm">
        <Sparkles className="w-3.5 h-3.5" />
        <span>01 · Hero Reveal Animation</span>
      </div>

      {/* Main Headline */}
      <h1
        ref={headlineRef}
        className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground leading-[1.15] mb-6"
      >
        {words.map((w, idx) => {
          const cleanWord = w.toLowerCase().replace(/[^a-z0-9]/g, "");
          const isKey = cleanWord === keyword.toLowerCase().replace(/[^a-z0-9]/g, "");
          return (
            <span
              key={idx}
              className={`word-item inline-block mr-2.5 sm:mr-3 ${
                isKey
                  ? "text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 font-black drop-shadow-sm"
                  : ""
              }`}
            >
              {w}
            </span>
          );
        })}
      </h1>

      {/* Subtext */}
      <p
        ref={subtextRef}
        className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl font-normal leading-relaxed mb-8"
      >
        {subtext}
      </p>

      {/* Action Buttons */}
      <div
        ref={buttonsRef}
        className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto mb-10"
      >
        <button
          onClick={onPrimaryClick}
          className="w-full sm:w-auto px-7 py-3.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold text-sm shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <span>{primaryCta}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={onSecondaryClick}
          className="w-full sm:w-auto px-6 py-3.5 rounded-full bg-muted/80 hover:bg-muted text-foreground border border-border/80 font-medium text-sm flex items-center justify-center gap-2 transition-colors"
        >
          <Play className="w-4 h-4 fill-current opacity-80" />
          <span>{secondaryCta}</span>
        </button>
      </div>

      {/* Proof Card */}
      <div
        ref={proofCardRef}
        className="w-full max-w-md p-4 sm:p-5 rounded-2xl bg-card/90 backdrop-blur-md border border-border/80 shadow-xl shadow-black/5 flex items-center justify-between gap-4 text-left"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {proofNumber}
            </div>
            <div className="text-xs text-muted-foreground line-clamp-1">{proofLabel}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold shrink-0">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Live Sync</span>
        </div>
      </div>
    </div>
  );
}
