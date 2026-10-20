"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";

interface BackHandlerRegistration {
  id: string;
  priority: number;
  handler: () => boolean; // return true if handled (consumed)
}

interface BackButtonContextType {
  registerBackHandler: (id: string, priority: number, handler: () => boolean) => () => void;
}

const BackButtonContext = createContext<BackButtonContextType>({
  registerBackHandler: () => () => {},
});

export function useBackButton() {
  return useContext(BackButtonContext);
}

/**
 * Hook for modals, popups, and drawers to close themselves when the Android back button is pressed.
 */
export function useBackHandler(isOpen: boolean, onClose: () => void, priority = 10) {
  const { registerBackHandler } = useBackButton();

  useEffect(() => {
    if (!isOpen) return;

    const id = `back_handler_${Math.random().toString(36).slice(2, 9)}`;
    const unregister = registerBackHandler(id, priority, () => {
      onClose();
      return true;
    });

    return unregister;
  }, [isOpen, onClose, priority, registerBackHandler]);
}

export function BackButtonProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const handlersRef = useRef<BackHandlerRegistration[]>([]);
  const lastBackPressTimeRef = useRef<number>(0);
  const [showExitToast, setShowExitToast] = useState(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const registerBackHandler = useCallback(
    (id: string, priority: number, handler: () => boolean) => {
      const entry = { id, priority, handler };
      handlersRef.current = [...handlersRef.current.filter((h) => h.id !== id), entry].sort(
        (a, b) => b.priority - a.priority
      );

      return () => {
        handlersRef.current = handlersRef.current.filter((h) => h.id !== id);
      };
    },
    []
  );

  const handleBackAction = useCallback(() => {
    // 1. Try registered modal/popup handlers first (highest priority to lowest)
    const sorted = [...handlersRef.current].sort((a, b) => b.priority - a.priority);
    for (const item of sorted) {
      try {
        const handled = item.handler();
        if (handled) {
          return;
        }
      } catch (err) {
        console.warn("Back handler error:", err);
      }
    }

    // 2. DOM Fallback: Check if an open modal/dialog or backdrop is present in the DOM
    const modalCloseButtons = document.querySelectorAll<HTMLButtonElement>(
      '[data-modal-close="true"], [data-drawer-close="true"], .fixed [aria-label="Close"], .fixed button:has(svg.lucide-x)'
    );
    if (modalCloseButtons.length > 0) {
      const topCloseBtn = modalCloseButtons[modalCloseButtons.length - 1];
      if (topCloseBtn && topCloseBtn.offsetParent !== null) {
        topCloseBtn.click();
        return;
      }
    }

    // 3. Navigation handling based on current path
    const cleanPath = (pathname || "").replace(/\/$/, "") || "/";
    const isRootRoute = cleanPath === "/dashboard" || cleanPath === "/login" || cleanPath === "/";

    if (!isRootRoute) {
      // If we are on a child/sub page (e.g. /gate, /gate/active, /employees, /rates, /reports, /search, /settings)
      // Navigate back in history
      if (window.history.length > 1) {
        router.back();
      } else {
        router.push("/dashboard/");
      }
      return;
    }

    // 4. On Root Route: Double back to exit
    const now = Date.now();
    if (now - lastBackPressTimeRef.current < 2000) {
      // Exit app
      if (Capacitor.isNativePlatform()) {
        CapApp.exitApp();
      }
    } else {
      lastBackPressTimeRef.current = now;
      setShowExitToast(true);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => {
        setShowExitToast(false);
      }, 2000);
    }
  }, [pathname, router]);

  useEffect(() => {
    let capListenerHandle: { remove: () => void } | null = null;

    if (Capacitor.isNativePlatform()) {
      CapApp.addListener("backButton", (event) => {
        handleBackAction();
      }).then((handle) => {
        capListenerHandle = handle;
      });
    }

    // Also support browser back button on Web / PWA
    const handlePopState = (e: PopStateEvent) => {
      // If a modal was open, consume the popstate
      if (handlersRef.current.length > 0) {
        const sorted = [...handlersRef.current].sort((a, b) => b.priority - a.priority);
        const topHandler = sorted[0];
        if (topHandler) {
          topHandler.handler();
        }
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      if (capListenerHandle) {
        capListenerHandle.remove();
      }
      window.removeEventListener("popstate", handlePopState);
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, [handleBackAction]);

  return (
    <BackButtonContext.Provider value={{ registerBackHandler }}>
      {children}
      {/* Sleek Android "Press back again to exit" toast */}
      {showExitToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="bg-foreground/90 text-background text-xs font-semibold px-4 py-2.5 rounded-full shadow-2xl backdrop-blur-md flex items-center gap-2 border border-background/20">
            <span>Press back again to exit</span>
          </div>
        </div>
      )}
    </BackButtonContext.Provider>
  );
}
