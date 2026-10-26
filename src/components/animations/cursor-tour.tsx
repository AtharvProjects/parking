"use client";

import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import {
  Car,
  Clock,
  LayoutDashboard,
  Plus,
  QrCode,
  ShieldAlert,
  Sparkles,
  Ticket,
  X,
} from "lucide-react";
import { useReducedMotion } from "@/lib/use-reduced-motion";

export function CursorTour() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const newEntryBtnRef = useRef<HTMLButtonElement>(null);
  const modalSubmitBtnRef = useRef<HTMLButtonElement>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [typedPlate, setTypedPlate] = useState("");
  const [hasNewCard, setHasNewCard] = useState(false);
  const [clickRipple, setClickRipple] = useState<{ x: number; y: number } | null>(null);

  const prefersReducedMotion = useReducedMotion();
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    if (prefersReducedMotion || !containerRef.current || !cursorRef.current) return;

    const runTour = () => {
      const container = containerRef.current;
      const cursor = cursorRef.current;
      const newBtn = newEntryBtnRef.current;

      if (!container || !cursor || !newBtn) return;

      const containerRect = container.getBoundingClientRect();
      const btnRect = newBtn.getBoundingClientRect();

      // Starting position (bottom-right of container)
      const startX = containerRect.width * 0.75;
      const startY = containerRect.height * 0.7;

      // New Entry Button relative target
      const targetBtnX = btnRect.left - containerRect.left + btnRect.width / 2;
      const targetBtnY = btnRect.top - containerRect.top + btnRect.height / 2;

      gsap.set(cursor, { x: startX, y: startY, opacity: 1 });
      setIsModalOpen(false);
      setTypedPlate("");
      setHasNewCard(false);

      const tl = gsap.timeline({
        repeat: -1,
        repeatDelay: 2.0,
      });

      timelineRef.current = tl;

      // 1. Move cursor to "+ New Vehicle" button
      tl.to(cursor, {
        x: targetBtnX,
        y: targetBtnY,
        duration: 1.0,
        ease: "power2.inOut",
      })
        // 2. Click ripple & Open Modal
        .add(() => {
          setClickRipple({ x: targetBtnX, y: targetBtnY });
          setTimeout(() => setClickRipple(null), 400);
          setIsModalOpen(true);
        })
        .to({}, { duration: 0.3 })
        // 3. Move cursor to plate input field
        .to(cursor, {
          x: containerRect.width / 2,
          y: containerRect.height / 2 - 20,
          duration: 0.7,
          ease: "power2.inOut",
        })
        // 4. Type license plate string letter by letter
        .add(() => {
          const text = "MH-14-BT-9900";
          let charIdx = 0;
          const typing = setInterval(() => {
            charIdx++;
            setTypedPlate(text.slice(0, charIdx));
            if (charIdx >= text.length) clearInterval(typing);
          }, 45);
        })
        .to({}, { duration: 0.8 })
        // 5. Move cursor to modal "Issue Ticket" button
        .to(cursor, {
          x: containerRect.width / 2 + 60,
          y: containerRect.height / 2 + 50,
          duration: 0.7,
          ease: "power2.inOut",
        })
        // 6. Click submit, close modal, reveal new ticket card
        .add(() => {
          setClickRipple({
            x: containerRect.width / 2 + 60,
            y: containerRect.height / 2 + 50,
          });
          setTimeout(() => setClickRipple(null), 400);
          setIsModalOpen(false);
          setHasNewCard(true);
        })
        // 7. Move cursor away
        .to(cursor, {
          x: startX,
          y: startY,
          duration: 0.9,
          ease: "power2.inOut",
        });
    };

    // Small delay to ensure layout rendered
    const timeout = setTimeout(runTour, 500);

    return () => {
      clearTimeout(timeout);
      if (timelineRef.current) timelineRef.current.kill();
    };
  }, [prefersReducedMotion]);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-16 select-none">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-xs font-semibold tracking-wide uppercase mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>07 · Interactive Cursor Tour</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
          Demoing the gate workflow without a video
        </h2>
        <p className="text-muted-foreground mt-2 max-w-lg mx-auto text-sm sm:text-base">
          Watch our simulated SVG cursor execute a complete vehicle entry check-in cycle in real time.
        </p>
      </div>

      {/* Simulated SaaS App Window */}
      <div
        ref={containerRef}
        className="relative w-full h-[440px] rounded-3xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col"
      >
        {/* App Header */}
        <div className="px-6 py-3.5 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-400 inline-block" />
              <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" />
              <span className="w-3 h-3 rounded-full bg-green-400 inline-block" />
            </div>
            <div className="h-4 w-px bg-border mx-1" />
            <span className="text-xs font-bold text-foreground">Sant Wamanbhau Terminal · Gate #1</span>
          </div>

          <button
            ref={newEntryBtnRef}
            className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-orange-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Vehicle Entry</span>
          </button>
        </div>

        {/* App Body with Sidebar & Grid */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Mini Sidebar */}
          <div className="w-16 sm:w-44 border-r border-border p-3 flex flex-col gap-1.5 bg-muted/10">
            {[
              { icon: LayoutDashboard, label: "Live Gate", active: true },
              { icon: Ticket, label: "Active Passes", active: false },
              { icon: Clock, label: "Tariff Rates", active: false },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium ${
                    item.active
                      ? "bg-orange-500/10 text-orange-500 font-bold"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">{item.label}</span>
                </div>
              );
            })}
          </div>

          {/* Main Area: Vehicle Cards Grid */}
          <div className="flex-1 p-5 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-muted-foreground uppercase">
                Active Parked Vehicles
              </span>
              <span className="text-xs text-emerald-500 font-semibold">● 14 Spots Free</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {/* Existing Card 1 */}
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-mono font-bold text-foreground">MH 12 AB 1102</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">Parked</span>
                </div>
                <div className="text-[11px] text-muted-foreground">In: 11:24 AM · 4-Wheeler</div>
              </div>

              {/* Existing Card 2 */}
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-mono font-bold text-foreground">MH 14 CC 4390</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">Parked</span>
                </div>
                <div className="text-[11px] text-muted-foreground">In: 11:42 AM · 2-Wheeler</div>
              </div>

              {/* Newly Popped Card from Tour */}
              {hasNewCard && (
                <div className="p-3.5 rounded-2xl bg-orange-500/10 border border-orange-500/30 animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-mono font-bold text-orange-500">MH 14 BT 9900</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500 text-white font-bold">New</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">In: Just Now · Thermal Slip #104</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Overlay during demo */}
        {isModalOpen && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-40 animate-in fade-in duration-200">
            <div className="w-full max-w-xs p-5 rounded-2xl bg-card border border-border shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Quick Gate Check-In</span>
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground font-medium">Plate Number</label>
                <div className="h-9 px-3 rounded-xl bg-muted border border-border flex items-center text-xs font-mono font-bold text-foreground">
                  {typedPlate}
                  <span className="w-1.5 h-3.5 bg-orange-500 ml-1 animate-pulse" />
                </div>
              </div>
              <button
                ref={modalSubmitBtnRef}
                className="w-full py-2 rounded-xl bg-orange-500 text-white font-semibold text-xs shadow-md"
              >
                Issue Pass & Print
              </button>
            </div>
          </div>
        )}

        {/* Click Ripple Indicator */}
        {clickRipple && (
          <div
            style={{ left: clickRipple.x - 16, top: clickRipple.y - 16 }}
            className="absolute w-8 h-8 rounded-full border-2 border-orange-500 bg-orange-500/20 animate-ping pointer-events-none z-50"
          />
        )}

        {/* Simulated SVG Mouse Cursor */}
        <div
          ref={cursorRef}
          className="absolute top-0 left-0 pointer-events-none z-50 drop-shadow-lg transition-transform"
        >
          <svg className="w-6 h-6 text-orange-500 fill-orange-500" viewBox="0 0 24 24">
            <path d="M4 2 L20 12 L12 14 L8 22 Z" stroke="white" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
