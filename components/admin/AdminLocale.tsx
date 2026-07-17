"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Locale = "ko" | "en";
type LocaleContextValue = { locale: Locale; setLocale: (locale: Locale) => void; toggleLocale: () => void };

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function AdminLocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ko");

  useEffect(() => {
    const saved = window.localStorage.getItem("gy-admin-locale");
    if (saved === "ko" || saved === "en") window.setTimeout(() => setLocaleState(saved), 0);
  }, []);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem("gy-admin-locale", next);
    document.documentElement.lang = next === "ko" ? "ko" : "en";
  };

  const value = useMemo(() => ({ locale, setLocale, toggleLocale: () => setLocale(locale === "ko" ? "en" : "ko") }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useAdminLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useAdminLocale must be used inside AdminLocaleProvider");
  return value;
}
