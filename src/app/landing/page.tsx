"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { Car, ChevronUp, ExternalLink, RotateCcw } from "lucide-react";
import { HeroReveal } from "@/components/animations/hero-reveal";
import { WordRotator } from "@/components/animations/word-rotator";
import { LiveActivityPings } from "@/components/animations/live-activity-pings";
import { ReviewShuffle } from "@/components/animations/review-shuffle";
import { CountUpStats } from "@/components/animations/count-up-stats";
import { BentoBuild } from "@/components/animations/bento-build";
import { CursorTour } from "@/components/animations/cursor-tour";
import { ProcessDraw } from "@/components/animations/process-draw";
import { BeforeAfterSlider } from "@/components/animations/before-after-slider";
import { TariffPriceRoll } from "@/components/animations/tariff-price-roll";
import { UsVsThem } from "@/components/animations/us-vs-them";
import { ClickSuccessButton } from "@/components/animations/click-success-button";

const NAV_ITEMS = [
  { id: "hero", label: "01 Hero" },
  { id: "rotator", label: "02 Rotator" },
  { id: "pings", label: "03 Live Pings" },
  { id: "reviews", label: "04 Reviews" },
  { id: "stats", label: "05 Stats" },
  { id: "bento", label: "06 Bento" },
  { id: "cursor", label: "07 Cursor" },
  { id: "process", label: "08 Process" },
  { id: "compare", label: "09 Compare" },
  { id: "tariff", label: "10 Tariff" },
  { id: "vsthem", label: "11 Vs Them" },
  { id: "cta", label: "12 CTA" },
];

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="w-full flex items-center gap-4 py-4 px-4 max-w-5xl mx-auto">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

export default function LandingPage() {
  const [heroReplayKey, setHeroReplayKey] = useState(0);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const scrollTo = (id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const setRef = (id: string) => (el: HTMLElement | null) => {
    sectionRefs.current[id] = el;
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      {/* ─── Top Navbar ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-xl bg-background/80 border-b border-border/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center">
              <Car className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-sm tracking-tight text-foreground hidden sm:inline">
              Sant Wamanbhau Parking
            </span>
          </div>

          {/* Mini section nav */}
          <nav className="hidden lg:flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors whitespace-nowrap"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setHeroReplayKey((k) => k + 1)}
              title="Replay Hero Animation"
              className="p-2 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors text-xs flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-medium">Replay Hero</span>
            </button>
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-orange-500/20 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Staff Login</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Main Content ────────────────────────────────────────── */}
      <main className="w-full overflow-x-hidden">

        {/* 01 — Hero Reveal */}
        <section ref={setRef("hero")} id="hero" className="scroll-mt-14">
          <HeroReveal replayKey={heroReplayKey} />
        </section>

        <SectionDivider label="02 Word Rotator" />

        {/* 02 — Word Rotator */}
        <section ref={setRef("rotator")} id="rotator" className="scroll-mt-14">
          <WordRotator />
        </section>

        <SectionDivider label="03 Live Activity Pings" />

        {/* 03 — Live Activity */}
        <section ref={setRef("pings")} id="pings" className="scroll-mt-14 bg-muted/20">
          <LiveActivityPings />
        </section>

        <SectionDivider label="04 Review Shuffle" />

        {/* 04 — Review Shuffle */}
        <section ref={setRef("reviews")} id="reviews" className="scroll-mt-14">
          <ReviewShuffle />
        </section>

        <SectionDivider label="05 Count-Up Stats" />

        {/* 05 — Count-Up Stats */}
        <section ref={setRef("stats")} id="stats" className="scroll-mt-14 bg-muted/20">
          <CountUpStats />
        </section>

        <SectionDivider label="06 Bento Build" />

        {/* 06 — Bento Build */}
        <section ref={setRef("bento")} id="bento" className="scroll-mt-14">
          <BentoBuild />
        </section>

        <SectionDivider label="07 Cursor Tour" />

        {/* 07 — Cursor Tour */}
        <section ref={setRef("cursor")} id="cursor" className="scroll-mt-14 bg-muted/20">
          <CursorTour />
        </section>

        <SectionDivider label="08 Process Draw" />

        {/* 08 — Process Draw */}
        <section ref={setRef("process")} id="process" className="scroll-mt-14">
          <ProcessDraw />
        </section>

        <SectionDivider label="09 Before / After" />

        {/* 09 — Before / After Slider */}
        <section ref={setRef("compare")} id="compare" className="scroll-mt-14 bg-muted/20">
          <BeforeAfterSlider />
        </section>

        <SectionDivider label="10 Tariff Price Roll" />

        {/* 10 — Tariff Price Roll */}
        <section ref={setRef("tariff")} id="tariff" className="scroll-mt-14">
          <TariffPriceRoll />
        </section>

        <SectionDivider label="11 Us vs Them" />

        {/* 11 — Us vs Them */}
        <section ref={setRef("vsthem")} id="vsthem" className="scroll-mt-14 bg-muted/20">
          <UsVsThem />
        </section>

        <SectionDivider label="12 Click → Success CTA" />

        {/* 12 — Click Success CTA */}
        <section ref={setRef("cta")} id="cta" className="scroll-mt-14 pb-24">
          <ClickSuccessButton />
        </section>
      </main>

      {/* ─── Back to Top ─────────────────────────────────────────── */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to top"
        className="fixed bottom-6 right-5 z-50 w-11 h-11 rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-xl shadow-orange-500/30 flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
      >
        <ChevronUp className="w-5 h-5" />
      </button>

      {/* ─── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-muted/30">
        <div className="max-w-5xl mx-auto px-4 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-orange-500 flex items-center justify-center">
              <Car className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-black text-foreground">Sant Wamanbhau Parking</span>
          </div>
          <p className="text-xs text-muted-foreground text-center sm:text-right">
            12 interactive animations — GSAP 3 · Next.js 16 · Capacitor · Supabase
          </p>
        </div>
      </footer>
    </div>
  );
}
