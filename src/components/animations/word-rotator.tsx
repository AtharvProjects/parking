"use client";

import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { Sparkles } from "lucide-react";

interface WordRotatorProps {
  fixedStart?: string;
  words?: string[];
  fixedEnd?: string;
  intervalSeconds?: number;
  pillColorClass?: string;
}

export function WordRotator({
  fixedStart = "We manage",
  words = ["2-Wheelers", "Cars & SUVs", "VIP Passes", "Commercial Fleets"],
  fixedEnd = "with zero gate friction.",
  intervalSeconds = 2.2,
  pillColorClass = "bg-gradient-to-r from-orange-500 to-amber-500",
}: WordRotatorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  // We duplicate the first word at the end for infinite seamless wrap
  const displayWords = [...words, words[0]];
  const rowHeight = 56; // pixel height of the pill row

  useEffect(() => {
    if (prefersReducedMotion || !listRef.current) return;

    let currentIndex = 0;
    const totalWords = words.length;

    const interval = setInterval(() => {
      currentIndex++;
      const targetY = -currentIndex * rowHeight;

      tweenRef.current = gsap.to(listRef.current, {
        y: targetY,
        duration: 0.75,
        ease: "back.inOut(1.4)",
        onComplete: () => {
          if (currentIndex >= totalWords) {
            // Instantly reset to top without animation
            gsap.set(listRef.current, { y: 0 });
            currentIndex = 0;
            setActiveIndex(0);
          } else {
            setActiveIndex(currentIndex % totalWords);
          }
        },
      });

      setActiveIndex(currentIndex % totalWords);
    }, intervalSeconds * 1000);

    return () => {
      clearInterval(interval);
      if (tweenRef.current) tweenRef.current.kill();
    };
  }, [words, intervalSeconds, prefersReducedMotion, rowHeight]);

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-3xl mx-auto px-4 py-12 flex flex-col items-center text-center select-none"
    >


      <div className="flex flex-col items-center justify-center gap-3 md:gap-4 text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-foreground">
        {/* Line 1: Fixed Start */}
        <span className="text-foreground/90">{fixedStart}</span>

        {/* Line 2: Rotating Pill */}
        <div className="relative my-1">
          <div
            className={`h-[56px] px-6 rounded-2xl ${pillColorClass} text-white shadow-xl shadow-orange-500/20 flex items-center justify-center overflow-hidden border border-white/20`}
            style={{ minWidth: "260px" }}
          >
            <div ref={listRef} className="flex flex-col">
              {displayWords.map((word, idx) => (
                <div
                  key={idx}
                  className="h-[56px] flex items-center justify-center font-bold tracking-tight text-2xl sm:text-3xl md:text-4xl whitespace-nowrap"
                >
                  {word}
                </div>
              ))}
            </div>
          </div>

          {/* Progress Dots under the pill */}
          <div className="flex items-center justify-center gap-2 mt-3">
            {words.map((_, idx) => (
              <span
                key={idx}
                className={`transition-all duration-300 rounded-full ${
                  activeIndex === idx
                    ? "w-6 h-1.5 bg-orange-500"
                    : "w-1.5 h-1.5 bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Line 3: Fixed End */}
        <span className="text-muted-foreground font-semibold text-2xl sm:text-4xl md:text-5xl mt-2">
          {fixedEnd}
        </span>
      </div>
    </div>
  );
}
