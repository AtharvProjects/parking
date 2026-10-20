"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggle: (e?: React.MouseEvent | { clientX: number; clientY: number }) => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  toggle: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem("theme") as Theme) || "light";
    setThemeState(stored);
    document.documentElement.classList.toggle("dark", stored === "dark");
    document.documentElement.setAttribute("data-theme", stored);
    setMounted(true);
  }, []);

  const applyTheme = (next: Theme) => {
    setThemeState(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {}
  };

  const toggle = (eventOrCoord?: React.MouseEvent | { clientX: number; clientY: number }) => {
    const next: Theme = theme === "light" ? "dark" : "light";

    let x = typeof window !== "undefined" ? window.innerWidth - 30 : 0;
    let y = 30;

    if (eventOrCoord) {
      if ("clientX" in eventOrCoord) {
        x = eventOrCoord.clientX;
        y = eventOrCoord.clientY;
      }
    }

    if (
      typeof document !== "undefined" &&
      "startViewTransition" in document &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const radius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );
      const transition = (document as any).startViewTransition(() => {
        applyTheme(next);
      });
      transition.ready.then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${radius}px at ${x}px ${y}px)`
            ],
          },
          {
            duration: 750,
            easing: "cubic-bezier(.65, 0, .2, 1)",
            pseudoElement: "::view-transition-new(root)",
          }
        );
      });
    } else {
      applyTheme(next);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme: applyTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
