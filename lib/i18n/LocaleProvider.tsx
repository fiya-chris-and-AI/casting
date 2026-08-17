"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LOCALE, MESSAGES, SUPPORTED_LOCALES, isSupportedLocale, type LocaleCode } from "./locales";
import { translate } from "./translate";

const STORAGE_KEY = "casting-locale";

interface LocaleContextValue {
  locale: LocaleCode;
  setLocale: (code: LocaleCode) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(DEFAULT_LOCALE);

  // Default is English with no query param/storage — Devpost requires English
  // materials. ?lang= wins over a stored preference so a shared link is authoritative.
  useEffect(() => {
    const fromQuery = new URLSearchParams(window.location.search).get("lang");
    const fromStorage = window.localStorage.getItem(STORAGE_KEY);
    const resolved = isSupportedLocale(fromQuery) ? fromQuery : isSupportedLocale(fromStorage) ? fromStorage : DEFAULT_LOCALE;
    setLocaleState(resolved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((code: LocaleCode) => {
    setLocaleState(code);
    window.localStorage.setItem(STORAGE_KEY, code);
    const url = new URL(window.location.href);
    if (code === DEFAULT_LOCALE) url.searchParams.delete("lang");
    else url.searchParams.set("lang", code);
    window.history.replaceState(null, "", url);
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function useT() {
  const { locale } = useLocale();
  const messages = MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];
  const fallback = MESSAGES[DEFAULT_LOCALE];
  return useCallback((key: string, vars?: Record<string, string | number>) => translate(messages, fallback, key, vars), [messages, fallback]);
}

export { SUPPORTED_LOCALES };
export type { LocaleCode };
