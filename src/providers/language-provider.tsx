"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { 
  type Language, 
  type TranslationKey, 
  type TranslationFunction, 
  createTranslationProxy 
} from "@/lib/i18n";

const STORAGE_KEY = "swp_lang";
const DEFAULT_LANG: Language = "en";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationFunction;
}

const defaultTranslation = createTranslationProxy(DEFAULT_LANG);

const LanguageContext = createContext<LanguageContextValue>({
  language: DEFAULT_LANG,
  setLanguage: () => {},
  t: defaultTranslation,
});

function getInitialLanguage(): Language {
  if (typeof window === "undefined") return DEFAULT_LANG;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "mr" || stored === "hi") return stored;
  } catch {}
  return DEFAULT_LANG;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANG);
  const [mounted, setMounted] = useState(false);

  // Hydrate from localStorage after mount
  useEffect(() => {
    setLanguageState(getInitialLanguage());
    setMounted(true);
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch {}
    }
    // Update the HTML lang attribute
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang === "mr" ? "mr" : lang === "hi" ? "hi" : "en";
    }
  }, []);

  const t = useMemo(() => {
    return createTranslationProxy(language);
  }, [language]);

  // On initial mount, set the html lang attribute
  useEffect(() => {
    if (mounted && typeof document !== "undefined") {
      document.documentElement.lang = language === "mr" ? "mr" : language === "hi" ? "hi" : "en";
    }
  }, [mounted, language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
