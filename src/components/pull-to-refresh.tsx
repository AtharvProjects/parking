"use client";

import React, { useState, useRef } from "react";
import { RefreshCw } from "lucide-react";
import { SyncEngine } from "@/sync/engine";

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const MAX_PULL = 70;

  const onTouchStart = (e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      setStartY(e.touches[0].clientY);
      setIsPulling(true);
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isPulling || isRefreshing) return;

    const y = e.touches[0].clientY;
    const dy = y - startY;

    if (dy > 0 && scrollRef.current && scrollRef.current.scrollTop <= 0) {
      setCurrentY(Math.min(dy * 0.45, MAX_PULL));
    }
  };

  const onTouchEnd = async () => {
    if (!isPulling || isRefreshing) return;

    setIsPulling(false);

    if (currentY >= MAX_PULL * 0.7) {
      setIsRefreshing(true);
      setCurrentY(44);

      try {
        const companyId = localStorage.getItem("company_id");
        if (companyId && navigator.onLine) {
          await SyncEngine.pushSync();
          await SyncEngine.pullSync(companyId);
          window.dispatchEvent(new CustomEvent("sync_completed"));
        }
      } catch (err) {
        console.warn("Pull-to-refresh sync notice:", err);
      } finally {
        setIsRefreshing(false);
        setCurrentY(0);
      }
    } else {
      setCurrentY(0);
    }
  };

  // Only apply transform when actively pulling or refreshing to prevent breaking position:fixed inside children
  const isTransformActive = isRefreshing || currentY > 0;

  return (
    <div className="min-h-full flex flex-col relative w-full">
      {/* Pull Indicator */}
      <div
        className="w-full flex justify-center items-center overflow-hidden transition-all duration-200 pointer-events-none"
        style={{
          height: isRefreshing ? 44 : currentY,
          opacity: Math.min(1, currentY / 30),
        }}
      >
        <div className="w-8 h-8 rounded-full bg-card border border-border shadow-md flex items-center justify-center text-primary">
          <RefreshCw
            className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
            style={{ transform: `rotate(${currentY * 4}deg)` }}
          />
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 w-full"
        style={isTransformActive ? { transform: `translateY(${currentY}px)` } : undefined}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
