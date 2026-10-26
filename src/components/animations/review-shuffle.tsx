"use client";

import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Sparkles, Star } from "lucide-react";
import { useReducedMotion } from "@/lib/use-reduced-motion";

interface Review {
  id: string;
  name: string;
  role: string;
  quote: string;
  avatarBg: string;
}

const REVIEWS: Review[] = [
  {
    id: "1",
    name: "Rajesh S.",
    role: "Municipal Parking Contractor",
    quote:
      "“Cash discrepancies dropped to absolute zero within our first week of deploying Sant Wamanbhau POS terminals. The offline sync is rock-solid.”",
    avatarBg: "bg-orange-500",
  },
  {
    id: "2",
    name: "Vikram P.",
    role: "Commercial Complex Supervisor",
    quote:
      "“Attendants took less than 2 minutes to learn the app. Gate entry turnaround went from 40 seconds to under 4 seconds per vehicle.”",
    avatarBg: "bg-emerald-500",
  },
  {
    id: "3",
    name: "Sunil K.",
    role: "Railway Station Plaza Manager",
    quote:
      "“Even when our gate lost cellular internet for three hours during peak rains, offline billing printed passes without a hiccup.”",
    avatarBg: "bg-amber-500",
  },
];

export function ReviewShuffle() {
  const [deck, setDeck] = useState<Review[]>(REVIEWS);
  const isHoveredRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return;

    const interval = setInterval(() => {
      if (isHoveredRef.current) return;

      const topCard = cardRefs.current[0];
      const secondCard = cardRefs.current[1];
      const thirdCard = cardRefs.current[2];

      if (!topCard || !secondCard || !thirdCard) return;

      const tl = gsap.timeline({
        onComplete: () => {
          // Reorder array: top card moves to back
          setDeck((prev) => {
            const next = [...prev];
            const first = next.shift();
            if (first) next.push(first);
            return next;
          });
          // Reset inline styles
          gsap.set([topCard, secondCard, thirdCard], { clearProps: "all" });
        },
      });

      // 1. Throw top card off to left with -18 deg rotation
      tl.to(topCard, {
        x: -240,
        y: -40,
        rotation: -18,
        opacity: 0,
        duration: 0.55,
        ease: "power2.in",
      })
        // 2. Move 2nd card to 1st card position
        .to(
          secondCard,
          {
            y: 0,
            scale: 1,
            opacity: 1,
            duration: 0.55,
            ease: "back.out(1.4)",
          },
          "-=0.3"
        )
        // 3. Move 3rd card to 2nd card position
        .to(
          thirdCard,
          {
            y: 34,
            scale: 0.94,
            opacity: 0.75,
            duration: 0.55,
            ease: "back.out(1.4)",
          },
          "-=0.4"
        );
    }, 2800);

    return () => clearInterval(interval);
  }, [prefersReducedMotion]);

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-12 select-none text-center">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-xs font-semibold tracking-wide uppercase mb-4">
        <Sparkles className="w-3.5 h-3.5" />
        <span>04 · Review Shuffle Deck</span>
      </div>

      <h2 className="text-3xl font-extrabold text-foreground mb-2">
        Trusted by frontline operators
      </h2>
      <p className="text-sm text-muted-foreground mb-10">
        Hover any card to pause and inspect feedback.
      </p>

      {/* Cards Deck Container */}
      <div
        ref={containerRef}
        onMouseEnter={() => {
          isHoveredRef.current = true;
        }}
        onMouseLeave={() => {
          isHoveredRef.current = false;
        }}
        className="relative h-[240px] w-full max-w-md mx-auto flex items-center justify-center cursor-pointer"
      >
        {deck.map((review, idx) => {
          // Deck depth visual defaults
          const yOffset = idx === 0 ? 0 : idx === 1 ? 34 : 68;
          const scale = idx === 0 ? 1 : idx === 1 ? 0.94 : 0.88;
          const opacity = idx === 0 ? 1 : idx === 1 ? 0.75 : 0.45;
          const zIndex = 30 - idx * 10;

          return (
            <div
              key={review.id}
              ref={(el) => {
                cardRefs.current[idx] = el;
              }}
              style={{
                transform: `translateY(${yOffset}px) scale(${scale})`,
                opacity: opacity,
                zIndex: zIndex,
              }}
              className="absolute top-0 w-full p-6 rounded-2xl bg-card border border-border shadow-2xl shadow-black/10 text-left transition-shadow duration-300 hover:shadow-orange-500/10"
            >
              {/* Star Rating */}
              <div className="flex items-center gap-1 mb-3 text-orange-500">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-current" />
                ))}
              </div>

              {/* Quote */}
              <p className="text-foreground font-serif italic text-sm sm:text-base leading-relaxed line-clamp-3 mb-4">
                {review.quote}
              </p>

              {/* Author & Badge */}
              <div className="flex items-center gap-3 pt-2 border-t border-border/60">
                <div
                  className={`w-9 h-9 rounded-full ${review.avatarBg} text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-sm`}
                >
                  {review.name.charAt(0)}
                </div>
                <div className="text-xs">
                  <div className="font-bold text-foreground">{review.name}</div>
                  <div className="text-emerald-500 font-medium">{review.role} · Verified</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Under Deck Rating Counter */}
      <div className="mt-20 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/60 border border-border text-xs text-muted-foreground font-medium">
        <span className="text-orange-500 font-bold">★ 4.9</span>
        <span>average score across 1,240+ parking operators</span>
      </div>
    </div>
  );
}
