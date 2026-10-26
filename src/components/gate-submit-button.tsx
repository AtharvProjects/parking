"use client";

import React, { useCallback, useRef, useState } from "react";
import gsap from "gsap";
import { Check, Loader2 } from "lucide-react";
import { useReducedMotion } from "@/lib/use-reduced-motion";

interface Particle {
  id: number;
  color: string;
  vx: number;
  vy: number;
  angle: number;
  size: number;
}

const CONFETTI_COLORS = [
  "#f97316", "#fb923c", "#fbbf24", "#34d399",
  "#10b981", "#e5e7eb", "#f472b6",
];

interface GateSubmitButtonProps {
  isPending: boolean;
  isSuccess: boolean;
  disabled: boolean;
  label: string;
  savingLabel: string;
  successLabel: string;
}

export function GateSubmitButton({
  isPending,
  isSuccess,
  disabled,
  label,
  savingLabel,
  successLabel,
}: GateSubmitButtonProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const particlesSpawnedRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();

  const spawnConfetti = useCallback(() => {
    if (prefersReducedMotion || particlesSpawnedRef.current) return;
    particlesSpawnedRef.current = true;

    const newParticles: Particle[] = Array.from({ length: 24 }, (_, i) => {
      const angle = (i / 24) * 360 + Math.random() * 20;
      const speed = 2.5 + Math.random() * 5;
      const rad = (angle * Math.PI) / 180;
      return {
        id: i,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        vx: Math.cos(rad) * speed,
        vy: Math.sin(rad) * speed,
        angle: Math.random() * 360,
        size: 5 + Math.random() * 5,
      };
    });
    setParticles(newParticles);

    // Animate each particle after mounting
    setTimeout(() => {
      newParticles.forEach((p) => {
        const el = document.getElementById(`gate-particle-${p.id}`);
        if (!el) return;
        gsap.to(el, {
          x: p.vx * 40,
          y: p.vy * 40,
          opacity: 0,
          rotation: p.angle + 180,
          scale: 0.2,
          duration: 0.9,
          ease: "power2.out",
          onComplete: () => setParticles([]),
        });
      });
    }, 20);

    // Pulse glow on button
    if (btnRef.current) {
      gsap.fromTo(
        btnRef.current,
        { scale: 1 },
        { scale: 1.06, duration: 0.15, yoyo: true, repeat: 1, ease: "power2.out" }
      );
    }
  }, [prefersReducedMotion]);

  // Trigger confetti once on success
  React.useEffect(() => {
    if (isSuccess) {
      spawnConfetti();
    } else {
      particlesSpawnedRef.current = false;
    }
  }, [isSuccess, spawnConfetti]);

  return (
    <div className="relative w-full">
      <button
        ref={btnRef}
        type="submit"
        disabled={disabled || isPending}
        className="w-full vx-btn accent !py-4 !rounded-2xl text-sm font-extrabold shadow-xl disabled:opacity-50 transition-all"
      >
        {isPending ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>{savingLabel}</span>
          </>
        ) : isSuccess ? (
          <>
            <Check className="w-5 h-5 stroke-[3]" />
            <span>{successLabel}</span>
          </>
        ) : (
          <>
            <Check className="w-5 h-5 stroke-[3]" />
            <span>{label}</span>
          </>
        )}
      </button>

      {/* Confetti burst */}
      {particles.map((p) => (
        <div
          id={`gate-particle-${p.id}`}
          key={p.id}
          className="absolute pointer-events-none rounded-sm"
          style={{
            top: "50%",
            left: "50%",
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            transform: "translate(-50%, -50%)",
            zIndex: 50,
          }}
        />
      ))}
    </div>
  );
}
