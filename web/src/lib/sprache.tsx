import { setFormatLanguage } from "./format";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { aktiveSprachen, fassungIn, istSprache, STANDARD_SPRACHE, type Fassungen, type Sprache } from "../../../src/sprache";

export { fassungIn, SPRACH_NAMEN, SPRACHEN, type Fassungen, type Sprache } from "../../../src/sprache";

/** Schlüssel im localStorage, unter dem die Wahl je Besucher gemerkt wird (Name aus der Anfangszeit, bleibt). */
export const SPRACH_SCHLUESSEL = "wow-guild-hub-sprache";

/** Sprachen, die diese Installation anbietet (WEBSITE_LANGUAGES, Standard Deutsch und Englisch). */
export function angeboteneSprachen(): Sprache[] {
  return aktiveSprachen(import.meta.env.WEBSITE_LANGUAGES);
}

/**
 * Gemerkte Wahl, sonst die Sprache des Browsers (Englisch, wenn angeboten und der Browser nicht Deutsch spricht),
 * sonst Deutsch. Eine gemerkte Sprache, die nicht mehr angeboten wird, zählt nicht.
 */
export function gemerkteSprache(): Sprache {
  const angeboten = angeboteneSprachen();
  try {
    const wert = window.localStorage.getItem(SPRACH_SCHLUESSEL);
    if (istSprache(wert) && angeboten.includes(wert)) return wert;
  } catch {
    // gesperrter Speicher: weiter mit der Browsersprache
  }
  const browser = typeof navigator === "undefined" ? "" : (navigator.language ?? "").toLowerCase();
  if (angeboten.includes("en") && browser !== "" && !browser.startsWith("de")) return "en";
  return STANDARD_SPRACHE;
}

export function spracheMerken(sprache: Sprache): void {
  try {
    window.localStorage.setItem(SPRACH_SCHLUESSEL, sprache);
  } catch {
    // Privates Fenster oder gesperrter Speicher: Die Wahl gilt dann nur bis zum Neuladen.
  }
}

interface SprachWert {
  sprache: Sprache;
  setSprache(sprache: Sprache): void;
  /** Wählt die Fassung der aktuellen Sprache. */
  t<T>(fassungen: Fassungen<T>): T;
}

const waehle = (sprache: Sprache) => <T,>(f: Fassungen<T>): T => fassungIn(f, sprache);

const SprachKontext = createContext<SprachWert>({
  sprache: STANDARD_SPRACHE,
  setSprache: () => {},
  t: waehle(STANDARD_SPRACHE),
});

export function SpracheProvider({ children, start }: { children: ReactNode; start?: Sprache }) {
  const [sprache, setzen] = useState<Sprache>(() => start ?? gemerkteSprache());
  // Vor dem Rendern der Kinder, damit Zahlen und Daten schon im ersten Durchgang in der richtigen Sprache stehen.
  setFormatLanguage(sprache);
  const setSprache = useCallback((neu: Sprache) => {
    setzen(neu);
    spracheMerken(neu);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.sprache = sprache;
    document.documentElement.lang = sprache === "en" ? "en" : "de";
  }, [sprache]);
  const wert = useMemo(() => ({ sprache, setSprache, t: waehle(sprache) }), [sprache, setSprache]);
  return <SprachKontext.Provider value={wert}>{children}</SprachKontext.Provider>;
}

/** Aktuelle Sprache, Umschalten und `t()` zum Wählen einer Fassung. Ohne Provider gilt Deutsch. */
export function useSprache(): SprachWert {
  return useContext(SprachKontext);
}
