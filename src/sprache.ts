// Sprachen der Seite: Deutsch (Standard) und Englisch für alle, Schwäbisch und Bayrisch als einschaltbare Dialekte.
// Welche davon eine Installation anbietet, steht in SITE_LANGUAGES (kommagetrennt, Deutsch immer dabei).
// Gemeinsam für Server (Zeitung, Titel, Statistik) und Oberfläche.

export const SPRACHEN = ["de", "en", "schwaebisch", "bayrisch"] as const;
export type Sprache = (typeof SPRACHEN)[number];

/** Die Dialekte neben Hochdeutsch, nur auf Wunsch (SITE_LANGUAGES). */
export const DIALEKTE = ["schwaebisch", "bayrisch"] as const;
export type Dialekt = (typeof DIALEKTE)[number];

/** Ein Text (oder eine Textfunktion): Deutsch und Englisch immer, Dialekte nur, wo es sie gibt. */
export type Fassungen<T = string> = { de: T; en: T } & Partial<Record<Dialekt, T>>;

export const STANDARD_SPRACHE: Sprache = "de";

/** Ohne SITE_LANGUAGES gibt es Deutsch und Englisch. */
export const STANDARD_SPRACHEN: readonly Sprache[] = ["de", "en"];

export const SPRACH_NAMEN: Record<Sprache, string> = {
  de: "Deutsch",
  en: "English",
  schwaebisch: "Schwäbisch",
  bayrisch: "Bayrisch",
};

export function istSprache(wert: unknown): wert is Sprache {
  return typeof wert === "string" && (SPRACHEN as readonly string[]).includes(wert);
}

export function istDialekt(sprache: Sprache): sprache is Dialekt {
  return (DIALEKTE as readonly string[]).includes(sprache);
}

/**
 * Angebotene Sprachen aus SITE_LANGUAGES, in der Reihenfolge der Angabe. Deutsch ist immer dabei und steht vorn,
 * Unbekanntes fällt weg. Leer oder fehlend heißt Deutsch und Englisch.
 */
export function aktiveSprachen(raw: string | undefined | null): Sprache[] {
  const genannt = (raw ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(istSprache);
  if (genannt.length === 0) return [...STANDARD_SPRACHEN];
  return ["de", ...new Set(genannt.filter((s) => s !== "de"))];
}

/**
 * Wählt die Fassung einer Sprache. Fehlt sie (Dialekt nicht übersetzt, alte gespeicherte Daten ohne Englisch),
 * gilt Deutsch. Nachsichtig mit alten API-Antworten: Kommt statt Fassungen ein einfacher Wert, bleibt er.
 */
export function fassungIn<T>(f: Fassungen<T>, sprache: Sprache): T {
  if (f === null || typeof f !== "object" || Array.isArray(f) || !("de" in f)) return f as unknown as T;
  const wert = (f as Partial<Record<Sprache, T>>)[sprache];
  return wert === undefined ? f.de : wert;
}

/**
 * Gespeicherte Fassungen neben Deutsch (Englisch und Dialekte) in Ausgaben der Wochenzeitung. Der Feldname
 * `dialekte` stammt aus der Zeit vor Englisch und bleibt wegen des Speicherformats. Fehlt bei alten Daten.
 */
export type Dialekte<T> = Partial<Record<Exclude<Sprache, "de">, T>>;

/** Deutscher Wert plus gespeicherte Fassungen; fehlendes Englisch fällt auf Deutsch zurück. */
export function mitDialekten<T>(de: T, dialekte: Dialekte<T> | undefined, en: T = dialekte?.en ?? de): Fassungen<T> {
  const out: Fassungen<T> = { de, en };
  for (const d of DIALEKTE) if (dialekte?.[d] !== undefined) out[d] = dialekte[d];
  return out;
}

/** Derselbe Wert für alle Sprachen, etwa für amtliche Namen oder alte Daten ohne Übersetzung. */
export function ueberall<T>(wert: T): Fassungen<T> {
  return { de: wert, en: wert, schwaebisch: wert, bayrisch: wert };
}

/** Baut die Fassungen aus einer Funktion je Sprache, für die angegebenen Sprachen (Standard: alle). */
export function jeSprache<T>(bau: (sprache: Sprache) => T, sprachen: readonly Sprache[] = SPRACHEN): Fassungen<T> {
  const out = { de: bau("de"), en: bau("en") } as Fassungen<T>;
  for (const d of DIALEKTE) if (sprachen.includes(d)) out[d] = bau(d);
  return out;
}

/** Text aus einer Konfiguration: ein String für alle oder ein Objekt mit `de` und optional weiteren Sprachen. */
export type KonfigText = string | ({ de: string } & Partial<Record<Exclude<Sprache, "de">, string>>);

/** Macht aus einem Konfigurationstext Fassungen; fehlendes Englisch fällt auf Deutsch zurück. */
export function ausKonfig(text: KonfigText): Fassungen;
export function ausKonfig(text: KonfigText | undefined | null): Fassungen | null;
export function ausKonfig(text: KonfigText | undefined | null): Fassungen | null {
  if (text === undefined || text === null) return null;
  if (typeof text === "string") return ueberall(text);
  const out: Fassungen = { de: text.de, en: text.en ?? text.de };
  for (const d of DIALEKTE) if (text[d] !== undefined) out[d] = text[d];
  return out;
}
