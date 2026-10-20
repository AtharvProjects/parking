"use client";

import React, { useEffect, useRef, useState } from "react";

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
  duration = 1500,
  delay = 100,
  prefix = "",
  suffix = "",
  decimals = 0,
  formatter,
  className = "",
}: AnimatedCountProps) {
  const [displayValue, setDisplayValue] = useState<string>(() => {
    if (formatter) return formatter(0);
    return `${prefix}0${suffix}`;
  });

  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    let startTime: number | null = null;
    let animId: number;
    let timerId: NodeJS.Timeout;

    const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

    const run = () => {
      const target = valueRef.current;
      const step = (timestamp: number) => {
        if (startTime === null) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(1, Math.max(0, elapsed / duration));
        const eased = easeOutExpo(progress);
        const current = target * eased;

        if (formatter) {
          setDisplayValue(formatter(current));
        } else {
          const formattedNumber = decimals > 0
            ? current.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
            : Math.round(current).toLocaleString("en-IN");
          setDisplayValue(`${prefix}${formattedNumber}${suffix}`);
        }

        if (progress < 1) {
          animId = requestAnimationFrame(step);
        } else {
          if (formatter) {
            setDisplayValue(formatter(target));
          } else {
            const formattedNumber = decimals > 0
              ? target.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
              : Math.round(target).toLocaleString("en-IN");
            setDisplayValue(`${prefix}${formattedNumber}${suffix}`);
          }
        }
      };
      animId = requestAnimationFrame(step);
    };

    timerId = setTimeout(run, delay);

    return () => {
      clearTimeout(timerId);
      if (animId) cancelAnimationFrame(animId);
    };
  }, [value, duration, delay, prefix, suffix, decimals, formatter]);

  return <span className={className}>{displayValue}</span>;
}
