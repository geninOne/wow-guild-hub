import { setFormatLanguage } from "./format";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { activeLanguages, translationIn, isLanguage, DEFAULT_LANGUAGE, type Translations, type Language } from "../../../src/language";

export { translationIn, LANGUAGE_NAMES, LANGUAGES, type Translations, type Language } from "../../../src/language";

/** localStorage key under which each visitor's choice is remembered (name from the early days, stays). */
export const LANGUAGE_STORAGE_KEY = "wow-guild-hub-sprache";

/** Languages this installation offers (WEBSITE_LANGUAGES, default German and English). */
export function offeredLanguages(): Language[] {
  return activeLanguages(import.meta.env.WEBSITE_LANGUAGES);
}

/**
 * Remembered choice, otherwise the browser language (English if offered and the browser does not speak German),
 * otherwise German. A remembered language that is no longer offered does not count.
 */
export function storedLanguage(): Language {
  const offered = offeredLanguages();
  try {
    const value = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isLanguage(value) && offered.includes(value)) return value;
  } catch {
    // blocked storage: continue with the browser language
  }
  const browser = typeof navigator === "undefined" ? "" : (navigator.language ?? "").toLowerCase();
  if (offered.includes("en") && browser !== "" && !browser.startsWith("de")) return "en";
  return DEFAULT_LANGUAGE;
}

export function storeLanguage(language: Language): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Private window or blocked storage: the choice then only lasts until the next reload.
  }
}

interface LanguageValue {
  language: Language;
  setLanguage(language: Language): void;
  /** Picks the version for the current language. */
  t<T>(versions: Translations<T>): T;
}

const picker = (language: Language) => <T,>(f: Translations<T>): T => translationIn(f, language);

const LanguageContext = createContext<LanguageValue>({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  t: picker(DEFAULT_LANGUAGE),
});

export function LanguageProvider({ children, start }: { children: ReactNode; start?: Language }) {
  const [language, setLanguageState] = useState<Language>(() => start ?? storedLanguage());
  // Before rendering the children, so numbers and dates are in the right language from the first pass.
  setFormatLanguage(language);
  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    storeLanguage(next);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.sprache = language;
    document.documentElement.lang = language === "en" ? "en" : "de";
  }, [language]);
  const value = useMemo(() => ({ language, setLanguage, t: picker(language) }), [language, setLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** Current language, switching, and `t()` for picking a version. Without a provider German applies. */
export function useLanguage(): LanguageValue {
  return useContext(LanguageContext);
}
