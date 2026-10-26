"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * Hook to animate a numeric value counting up smoothly from 0 to target.
 * Uses gentle easeOutQuad curve over 2.2s so the user clearly sees
 * the numbers increasing slowly and steadily.
 */
export function useAnimatedNumber(
  target: number,
  duration: number = 2200,
  delay: number = 150
): number {
  const [current, setCurrent] = useState(0);
  const currentRef = useRef(0);
  currentRef.current = current;
  const isFirstRun = useRef(true);

  useEffect(() => {
    let startTime: number | null = null;
    let animId: number;
    // On first mount: start from 0. On subsequent updates: start from current value
    const startVal = isFirstRun.current ? 0 : currentRef.current;
    const endVal = target;
    const animDuration = isFirstRun.current ? duration : Math.min(800, duration);
    const animDelay = isFirstRun.current ? delay : 0;
    isFirstRun.current = false;

    const timer = setTimeout(() => {
      const step = (timestamp: number) => {
        if (startTime === null) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(1, elapsed / animDuration);
        // Gentle easeOutQuad: gradual, steady increase that slows smoothly at the end
        const eased = 1 - Math.pow(1 - progress, 2);
        const nextVal = Math.round(startVal + (endVal - startVal) * eased);
        setCurrent(nextVal);

        if (progress < 1) {
          animId = requestAnimationFrame(step);
        } else {
          setCurrent(endVal);
        }
      };
      animId = requestAnimationFrame(step);
    }, animDelay);

    return () => {
      clearTimeout(timer);
      if (animId) cancelAnimationFrame(animId);
    };
  }, [target, duration, delay]);

  return current;
}

interface AnimatedCountProps {
  value: number;
  duration?: number;
  delay?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  formatter?: (val: number) => string;
  className?: string;
}

export function AnimatedCount({
  value,
  duration = 2200,
  delay = 150,
  prefix = "",
  suffix = "",
  decimals = 0,
  formatter,
  className = "",
}: AnimatedCountProps) {
  const animatedVal = useAnimatedNumber(value, duration, delay);

  let formatted: string;
  if (formatter) {
    formatted = formatter(animatedVal);
  } else {
    const formattedNumber =
      decimals > 0
        ? animatedVal.toLocaleString("en-IN", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })
        : animatedVal.toLocaleString("en-IN");
    formatted = `${prefix}${formattedNumber}${suffix}`;
  }

  return <span className={className}>{formatted}</span>;
}
