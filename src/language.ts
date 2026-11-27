// Languages of the site: German (default) and English for everyone, Swabian and Bavarian as optional dialects.
// Which of them an installation offers is set in WEBSITE_LANGUAGES (comma-separated, German always included).
// Shared by the server (newspaper, titles, statistics) and the web interface.

export const LANGUAGES = ["de", "en", "schwaebisch", "bayrisch"] as const;
export type Language = (typeof LANGUAGES)[number];

/** The dialects next to standard German, only on request (WEBSITE_LANGUAGES). */
export const DIALECTS = ["schwaebisch", "bayrisch"] as const;
export type Dialect = (typeof DIALECTS)[number];

/** A text (or a text function): German and English always, dialects only where they exist. */
export type Translations<T = string> = { de: T; en: T } & Partial<Record<Dialect, T>>;

export const DEFAULT_LANGUAGE: Language = "de";

/** Without WEBSITE_LANGUAGES there are German and English. */
export const DEFAULT_LANGUAGES: readonly Language[] = ["de", "en"];

export const LANGUAGE_NAMES: Record<Language, string> = {
  de: "Deutsch",
  en: "English",
  schwaebisch: "Schwäbisch",
  bayrisch: "Bayrisch",
};

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

export function isDialect(language: Language): language is Dialect {
  return (DIALECTS as readonly string[]).includes(language);
}

/**
 * Offered languages from WEBSITE_LANGUAGES, in the given order. German is always included and comes first,
 * unknown entries are dropped. Empty or missing means German and English.
 */
export function activeLanguages(raw: string | undefined | null): Language[] {
  const named = (raw ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(isLanguage);
  if (named.length === 0) return [...DEFAULT_LANGUAGES];
  return ["de", ...new Set(named.filter((s) => s !== "de"))];
}

/**
 * Picks the version for a language. If it is missing (dialect not translated, old stored data without English),
 * German applies. Lenient with old API responses: if a plain value comes instead of translations, it is kept.
 */
export function translationIn<T>(f: Translations<T>, language: Language): T {
  if (f === null || typeof f !== "object" || Array.isArray(f) || !("de" in f)) return f as unknown as T;
  const value = (f as Partial<Record<Language, T>>)[language];
  return value === undefined ? f.de : value;
}

/**
 * Stored versions next to German (English and dialects) in issues of the weekly newspaper. The field name
 * `dialekte` dates from before English and stays because of the storage format. Missing in old data.
 */
export type OtherTranslations<T> = Partial<Record<Exclude<Language, "de">, T>>;

/** German value plus stored versions; missing English falls back to German. */
export function withDialects<T>(de: T, others: OtherTranslations<T> | undefined, en: T = others?.en ?? de): Translations<T> {
  const out: Translations<T> = { de, en };
  for (const d of DIALECTS) if (others?.[d] !== undefined) out[d] = others[d];
  return out;
}

/** The same value for all languages, for example for official names or old data without translation. */
export function sameInAll<T>(value: T): Translations<T> {
  return { de: value, en: value, schwaebisch: value, bayrisch: value };
}

/** Builds the translations from a function per language, for the given languages (default: all). */
export function perLanguage<T>(build: (language: Language) => T, languages: readonly Language[] = LANGUAGES): Translations<T> {
  const out = { de: build("de"), en: build("en") } as Translations<T>;
  for (const d of DIALECTS) if (languages.includes(d)) out[d] = build(d);
  return out;
}

/** Text from a configuration: one string for all or an object with `de` and optionally further languages. */
export type ConfigText = string | ({ de: string } & Partial<Record<Exclude<Language, "de">, string>>);

/** Turns a configuration text into translations; missing English falls back to German. */
export function fromConfig(text: ConfigText): Translations;
export function fromConfig(text: ConfigText | undefined | null): Translations | null;
export function fromConfig(text: ConfigText | undefined | null): Translations | null {
  if (text === undefined || text === null) return null;
  if (typeof text === "string") return sameInAll(text);
  const out: Translations = { de: text.de, en: text.en ?? text.de };
  for (const d of DIALECTS) if (text[d] !== undefined) out[d] = text[d];
  return out;
}
