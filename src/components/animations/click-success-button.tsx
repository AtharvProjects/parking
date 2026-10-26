"use client";

import React, { useCallback, useRef, useState } from "react";
import gsap from "gsap";
import { Check, Loader2, Sparkles } from "lucide-react";
import { useReducedMotion } from "@/lib/use-reduced-motion";

type ButtonState = "idle" | "loading" | "success";

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  angle: number;
  size: number;
}

const CONFETTI_COLORS = [
  "#f97316", "#fb923c", "#fbbf24", "#34d399",
  "#10b981", "#6366f1", "#a78bfa", "#f472b6",
];

interface ClickSuccessButtonProps {
  label?: string;
  successLabel?: string;
  subLabel?: string;
  onSuccess?: () => Promise<void> | void;
  className?: string;
}

export function ClickSuccessButton({
  label = "Get Free Gate Demo",
  successLabel = "You're on the list!",
  subLabel = "Operator account setup — no credit card needed",
  onSuccess,
  className = "",
}: ClickSuccessButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [state, setState] = useState<ButtonState>("idle");
  const [particles, setParticles] = useState<Particle[]>([]);
  const prefersReducedMotion = useReducedMotion();

  const generateParticles = useCallback((): Particle[] => {
    return Array.from({ length: 28 }, (_, i) => {
      const angle = (i / 28) * 360 + Math.random() * 30;
      const speed = 3 + Math.random() * 6;
      const rad = (angle * Math.PI) / 180;
      return {
        id: i,
        x: 0,
        y: 0,
        vx: Math.cos(rad) * speed,
        vy: Math.sin(rad) * speed,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        angle: Math.random() * 360,
        size: 5 + Math.random() * 6,
      };
    });
  }, []);

  const handleClick = useCallback(async () => {
    if (state !== "idle" || !btnRef.current) return;
    setState("loading");

    // Simulate async API call
    await new Promise<void>((resolve) => setTimeout(resolve, 1600));
    if (onSuccess) await onSuccess();

    setState("success");

    if (!prefersReducedMotion && btnRef.current) {
      const btn = btnRef.current;

      // 1. Success pulse glow
      gsap.fromTo(
        btn,
        { boxShadow: "0 0 0 0 rgba(52,211,153,0)" },
        {
          boxShadow: "0 0 0 24px rgba(52,211,153,0)",
          duration: 0.6,
          ease: "power2.out",
        }
      );

      // 2. Scale bump
      gsap.fromTo(
        btn,
        { scale: 1 },
        { scale: 1.07, duration: 0.18, yoyo: true, repeat: 1, ease: "power2.out" }
      );

      // 3. Spawn confetti
      const newParticles = generateParticles();
      setParticles(newParticles);

      // Animate each particle via GSAP
      newParticles.forEach((p) => {
        const el = document.getElementById(`particle-${p.id}`);
        if (!el) return;
        gsap.to(el, {
          x: p.vx * 40,
          y: p.vy * 40,
          opacity: 0,
          rotation: p.angle + 180,
          scale: 0.3,
          duration: 1.0,
          ease: "power2.out",
          onComplete: () => {
            setParticles([]);
          },
        });
      });
    }
  }, [state, prefersReducedMotion, generateParticles, onSuccess]);

  const handleReset = () => {
    setState("idle");
    setParticles([]);
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-16 select-none">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-xs font-semibold tracking-wide uppercase mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>12 · Click → Success CTA</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
          One click to transform your parking ops
        </h2>
        <p className="text-muted-foreground mt-2 max-w-lg mx-auto text-sm sm:text-base">
          Click the button to experience the morph animation with confetti burst.
        </p>
      </div>

      <div
        ref={containerRef}
        className={`flex flex-col items-center justify-center gap-4 ${className}`}
      >
        {/* The Button */}
        <div className="relative">
          <button
            ref={btnRef}
            onClick={handleClick}
            disabled={state !== "idle"}
            className={`relative px-10 py-4 rounded-full font-bold text-base transition-all overflow-hidden shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500 ${
              state === "idle"
                ? "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white hover:scale-[1.03] active:scale-[0.98] shadow-orange-500/30 cursor-pointer"
                : state === "loading"
                ? "bg-muted text-muted-foreground cursor-wait w-48"
                : "bg-emerald-500 text-white cursor-default w-48"
            }`}
          >
            <span
              ref={labelRef}
              className="flex items-center justify-center gap-2"
            >
              {state === "idle" && label}
              {state === "loading" && (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying…</span>
                </>
              )}
              {state === "success" && (
                <>
                  <Check className="w-4 h-4" />
                  <span>{successLabel}</span>
                </>
              )}
            </span>
          </button>

          {/* Confetti particles */}
          {particles.map((p) => (
            <div
              id={`particle-${p.id}`}
              key={p.id}
              className="absolute pointer-events-none rounded-sm"
              style={{
                top: "50%",
                left: "50%",
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
                transform: `translate(-50%, -50%)`,
              }}
            />
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center max-w-xs">{subLabel}</p>

        {state === "success" && (
          <button
            onClick={handleReset}
            className="mt-2 text-xs text-muted-foreground underline hover:text-foreground transition-colors"
          >
            Reset demo ↺
          </button>
        )}
      </div>
    </div>
  );
}
