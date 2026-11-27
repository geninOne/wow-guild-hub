import type { NewspaperArticle } from "../model";
import {
  allLanguages, hash, list, MILESTONE_HEADLINE, MILESTONE_TEXT, MILESTONES_HEADLINE, MILESTONES_TEXT, MOTTOS, NEWCOMER_HEADLINE, NEWCOMER_TEXT,
  NEWCOMERS_HEADLINE, NEWCOMERS_TEXT, Picker, GENERIC_PUNCHLINE, RECIPES_HEADLINE, RECIPES_TEXT, QUIET_HEADLINE, QUIET_TEXT, JUMP_HEADLINE,
  JUMP_TEXT, RUSH_HOUR_HEADLINE, RUSH_HOUR_TEXT, TITLE_BONUS, TITLE_HEADLINE, TITLE_HEADLINE_OWN, TITLE_PUNCHLINE, OVERTAKE_HEADLINE, OVERTAKE_TEXT,
  OVERTAKES_HEADLINE, OVERTAKES_TEXT, VALUE_FRAME, NUMBER_TEXT, type AllLanguages,
} from "./phrases";
import { RECORD_KIND, RECORD_ENTRY, RECORD_HEADLINE, RECORD_TEXT, WEATHER, WEATHER_CLOSING, WEATHER_OPENING, WEATHER_PLACE } from "./phrases-extras";
import { factKindOf, factCharacters, factTitle, sectionOf, type NewspaperFact } from "./newspaper-facts";
import type { WeatherSituation } from "./weather";
import { titleDef } from "./titles";
import { activeLanguages, DIALECTS, translationIn, type OtherTranslations, type Language } from "../language";

export { list } from "./phrases";

/** Languages besides standard German that an issue can store as well. */
export type OtherLanguage = Exclude<Language, "de">;

/**
 * Fassungen of a standard German value. They are stored in the existing field `dialekte` (or `mottoDialekte`,
 * `wetterDialekte`), English under `en`; older issues have no English there.
 */
export type StoredTranslations<T> = Partial<Record<OtherLanguage, T>>;

/** Reads a translation from a stored `dialekte` field; undefined if there is none. */
export function storedTranslationIn<T>(stored: OtherTranslations<T> | StoredTranslations<T> | undefined, language: OtherLanguage): T | undefined {
  return (stored as StoredTranslations<T> | undefined)?.[language];
}

/** English always, dialects only when they are offered. */
export function storedTranslations<T>(f: AllLanguages<T>, languages: readonly Language[]): StoredTranslations<T> {
  const out: StoredTranslations<T> = { en: f.en };
  for (const d of DIALECTS) if (languages.includes(d)) out[d] = f[d];
  return out;
}

/** Languages offered by a generator: from the context or from WEBSITE_LANGUAGES (read at runtime). */
export function languagesFor(context: Pick<TextContext, "languages">): Language[] {
  return context.languages ? [...context.languages] : activeLanguages(process.env.WEBSITE_LANGUAGES);
}

/** An earlier issue, as far as a generator needs to know it to avoid repeating itself. */
export interface RecentIssue {
  week: string;
  /** Phrase ids used; empty for issues written by a language model. */
  bausteine: string[];
  headlines: string[];
  texts: string[];
  motto: string;
  /** The same texts in English, Swabian and Bavarian, where available. */
  dialekte?: StoredTranslations<{ headlines: string[]; texts: string[]; motto: string; wetter?: string }>;
  /** Weather report of the issue, if there was one. */
  wetter?: string;
}

/** What a generator needs to know about the week without going to the store. */
export interface TextContext {
  week: string;
  /** Display name of a character. */
  name(characterId: number): string;
  /** Names of all known characters, so a language model text can be checked for foreign names. */
  allNames?: string[];
  /** The latest issues, newest first (at most six). */
  recent?: RecentIssue[];
  /** Weather situation of the week; without it there is no weather report. */
  wetter?: WeatherSituation;
  /** Offered languages; defaults to WEBSITE_LANGUAGES. Dialects are only written when they are listed here. */
  languages?: readonly Language[];
  /** Guild names, main guild first, so a language model can name them. */
  gilden?: string[];
  /** Newspaper name from WEBSITE_NEWSPAPER; defaults to the standard name per language. */
  zeitung?: string;
}

/**
 * Result of a generator: one article per fact in the same order, plus the motto of the week.
 * Standard German is in `headline`, `text` and `motto`, English and the offered dialects in `dialekte`
 * and `mottoDialekte`.
 */
export interface TextResult {
  articles: NewspaperArticle[];
  motto: string;
  mottoDialekte?: StoredTranslations<string>;
  /** Who wrote it: `bausteine` or `claude`. */
  generator: string;
  /** Phrase ids used (phrases only), so the next issues pick different ones. */
  bausteine?: string[];
  /** Model, if a language model wrote the issue. */
  model?: string;
  /** Why it fell back to the phrases, if a language model was configured. */
  fallback?: string;
  /** Weather report in standard German; only with a weather situation in the context. */
  wetter?: string;
  wetterDialekte?: StoredTranslations<string>;
}

/**
 * Turns facts into articles. The built-in implementation uses fixed phrases; `claude-text.ts` serves the same
 * interface with the Claude API and falls back to this one on problems.
 */
export type TextGenerator = (facts: NewspaperFact[], context: TextContext) => Promise<TextResult>;

export const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
export const WEEKDAY_NAMES: AllLanguages<string[]> = {
  de: WEEKDAYS,
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  schwaebisch: ["Mendig", "Dienschdig", "Mittwoch", "Donnerschdig", "Freidig", "Samschdig", "Sonndig"],
  bayrisch: WEEKDAYS,
};

/** Fixed phrase per key (without memory). */
export function pick<T>(options: T[], seed: string): T {
  return options[hash(seed) % options.length];
}

interface Text {
  headline: string;
  text: string;
}

const AMOUNT: AllLanguages<{ dat(n: number): string; akk(n: number): string }> = {
  de: {
    dat: (n) => (n === 1 ? "einem neuen Rezept" : `${n} neuen Rezepten`),
    akk: (n) => (n === 1 ? "ein neues Rezept" : `${n} neue Rezepte`),
  },
  en: {
    dat: (n) => (n === 1 ? "one new recipe" : `${n} new recipes`),
    akk: (n) => (n === 1 ? "one new recipe" : `${n} new recipes`),
  },
  schwaebisch: {
    dat: (n) => (n === 1 ? "oim neie Rezept" : `${n} neie Rezept`),
    akk: (n) => (n === 1 ? "a neis Rezept" : `${n} neie Rezept`),
  },
  bayrisch: {
    dat: (n) => (n === 1 ? "oam neien Rezept" : `${n} neien Rezepte`),
    akk: (n) => (n === 1 ? "a neis Rezept" : `${n} neie Rezepte`),
  },
};

const NOW_LEVEL: AllLanguages<(level: number) => string> = {
  de: (l) => `jetzt Level ${l}`,
  en: (l) => `now level ${l}`,
  schwaebisch: (l) => `jetzt Level ${l}`,
  bayrisch: (l) => `jetzad Level ${l}`,
};
const PASSED: AllLanguages<string> = { de: "an", en: "past", schwaebisch: "an", bayrisch: "an" };

/** Builds the texts of all languages from the chosen phrases and the arguments per language. */
function apply<A>(made: AllLanguages<(a: A) => string>, args: (s: Language) => A): AllLanguages<string> {
  return allLanguages((s) => made[s](args(s)));
}

function texts(headline: AllLanguages<string>, text: AllLanguages<string>): AllLanguages<Text> {
  return allLanguages((s) => ({ headline: headline[s], text: text[s] }));
}

function write(fact: NewspaperFact, ctx: TextContext, p: Picker, seed: string): AllLanguages<Text> {
  const n = (id: number) => ctx.name(id);
  const bonus = (titleId: string | null): AllLanguages<string> => {
    if (!titleId) return allLanguages(() => "");
    const def = titleDef(titleId);
    const made = p.chooseAll(`bonus-${titleId}`, TITLE_BONUS, seed, (i) => `bonus:${i}`);
    return allLanguages((s) => ` ${made[s]({ t: def ? translationIn(def.name, s) : titleId })}`);
  };
  const plus = (a: AllLanguages<string>, b: AllLanguages<string>): AllLanguages<string> => allLanguages((s) => a[s] + b[s]);
  switch (fact.kind) {
    case "sprung": {
      const a = { n: n(fact.characterId), levels: fact.levels, from: fact.from, to: fact.to };
      return texts(
        apply(p.chooseAll("sprung-kopf", JUMP_HEADLINE, seed), () => a),
        plus(apply(p.chooseAll("sprung-text", JUMP_TEXT, seed), () => a), bonus(fact.title)),
      );
    }
    case "meilensteine": {
      if (fact.entries.length === 1) {
        const a = { n: n(fact.entries[0].characterId), level: fact.entries[0].level };
        return texts(
          apply(p.chooseAll("meilenstein-kopf", MILESTONE_HEADLINE, seed), () => a),
          apply(p.chooseAll("meilenstein-text", MILESTONE_TEXT, seed), () => a),
        );
      }
      const a = (s: Language) => ({ l: list(fact.entries.map((e) => `${n(e.characterId)} (${e.level})`), s), k: fact.entries.length });
      return texts(
        apply(p.chooseAll("meilensteine-kopf", MILESTONES_HEADLINE, seed), a),
        apply(p.chooseAll("meilensteine-text", MILESTONES_TEXT, seed), a),
      );
    }
    case "ueberholungen": {
      if (fact.entries.length === 1) {
        const e = fact.entries[0];
        const a = { a: n(e.characterId), b: n(e.passedId), level: e.level };
        return texts(
          apply(p.chooseAll("ueberholung-kopf", OVERTAKE_HEADLINE, seed), () => a),
          apply(p.chooseAll("ueberholung-text", OVERTAKE_TEXT, seed), () => a),
        );
      }
      const a = (s: Language) => ({
        l: list(fact.entries.map((e) => `${n(e.characterId)} ${PASSED[s]} ${n(e.passedId)} (${NOW_LEVEL[s](e.level)})`), s),
      });
      return texts(
        apply(p.chooseAll("ueberholungen-kopf", OVERTAKES_HEADLINE, seed), a),
        apply(p.chooseAll("ueberholungen-text", OVERTAKES_TEXT, seed), a),
      );
    }
    case "titel": {
      const who = n(fact.characterId);
      const def = titleDef(fact.titleId);
      const t = (s: Language) => (def ? translationIn(def.name, s) : fact.titleId);
      const v = (s: Language) => (def ? translationIn(def.valueText(fact.value), s) : String(fact.value));
      // Frames and headlines are remembered per title, but used only once within an issue.
      const own = TITLE_HEADLINE_OWN[fact.titleId];
      const headline = own
        ? apply(p.chooseAll(`titel-kopf-${fact.titleId}`, own, seed), (s) => ({ t: t(s), n: who }))
        : apply(p.chooseAll(`titel-kopf-${fact.titleId}`, TITLE_HEADLINE, seed, (i) => `titel-kopf:${i}`), (s) => ({ t: t(s), n: who }));
      const frame = apply(p.chooseAll(`wert-${fact.titleId}`, VALUE_FRAME, seed, (i) => `wert:${i}`), (s) => ({ v: v(s) }));
      const punchline = apply(p.chooseAll(`pointe-${fact.titleId}`, TITLE_PUNCHLINE[fact.titleId] ?? GENERIC_PUNCHLINE, seed), () => ({ n: who }));
      return texts(headline, allLanguages((s) => `${frame[s]} ${punchline[s]}`));
    }
    case "neuzugang": {
      if (fact.characterIds.length === 1) {
        const a = { n: n(fact.characterIds[0]) };
        return texts(apply(p.chooseAll("neu-kopf", NEWCOMER_HEADLINE, seed), () => a), apply(p.chooseAll("neu-text", NEWCOMER_TEXT, seed), () => a));
      }
      const a = (s: Language) => ({ l: list(fact.characterIds.map(n), s), k: fact.characterIds.length });
      return texts(apply(p.chooseAll("neue-kopf", NEWCOMERS_HEADLINE, seed), a), apply(p.chooseAll("neue-text", NEWCOMERS_TEXT, seed), a));
    }
    case "rezepte": {
      const a = (s: Language) => ({
        n: n(fact.characterId),
        total: fact.total,
        dat: AMOUNT[s].dat(fact.count),
        akk: AMOUNT[s].akk(fact.count),
      });
      return texts(
        apply(p.chooseAll("rezepte-kopf", RECIPES_HEADLINE, seed), a),
        plus(apply(p.chooseAll("rezepte-text", RECIPES_TEXT, seed), a), bonus(fact.title)),
      );
    }
    case "stosszeit": {
      const a = (s: Language) => ({ day: WEEKDAY_NAMES[s][fact.weekday], hour: fact.hour, next: (fact.hour + 1) % 24, count: fact.count });
      return texts(apply(p.chooseAll("stoss-kopf", RUSH_HOUR_HEADLINE, seed), a), apply(p.chooseAll("stoss-text", RUSH_HOUR_TEXT, seed), a));
    }
    case "zahl":
      return texts(allLanguages(() => String(fact.value)), p.chooseAll(`zahl-${fact.what}`, NUMBER_TEXT[fact.what] ?? NUMBER_TEXT.level, seed));
    case "ruhig":
      return texts(p.chooseAll("ruhig-kopf", QUIET_HEADLINE, seed), p.chooseAll("ruhig-text", QUIET_TEXT, seed));
    case "rekord": {
      const a = (s: Language) => ({
        l: list(
          fact.entries.map((e) =>
            RECORD_ENTRY[s]({ n: e.characterId === null ? null : n(e.characterId), v: e.value, art: RECORD_KIND[s][e.art], p: e.previous }),
          ),
          s,
        ),
      });
      return texts(p.chooseAll("rekord-kopf", RECORD_HEADLINE, seed), apply(p.chooseAll("rekord-text", RECORD_TEXT, seed), a));
    }
    case "extension": {
      // Missing dialects fall back to German.
      const f = fact.write({ name: n, picker: p, seed });
      return allLanguages((s) => translationIn(f, s));
    }
  }
}

/** Weather report from phrases in all languages: opening, one sentence per weather element, closing. */
export function writeWeather(situation: WeatherSituation, p: Picker): AllLanguages<string> {
  const opening = p.chooseAll("wetter-einstieg", WEATHER_OPENING, "wetter");
  const sentences = situation.elemente.map((el, i) => {
    const made = p.chooseAll(`wetter-${el.art}`, WEATHER[el.art], `wetter:${i}`);
    return allLanguages((s) => made[s]({ u: WEATHER_PLACE[s](el.ueber) }));
  });
  const closing = p.chooseAll("wetter-ausklang", WEATHER_CLOSING, "wetter");
  return allLanguages((s) => [opening[s], ...sentences.map((x) => x[s]), closing[s]].join(" "));
}

/**
 * Article with the standard German version on top, English and the offered dialects under `dialekte`.
 * Without `languages`, WEBSITE_LANGUAGES applies.
 */
export function articleOf(
  base: Omit<NewspaperArticle, "headline" | "text" | "dialekte">,
  f: AllLanguages<Text>,
  languages: readonly Language[] = languagesFor({}),
): NewspaperArticle {
  return { ...base, headline: f.de.headline, text: f.de.text, dialekte: storedTranslations(f, languages) };
}

/**
 * Writes an issue from phrases: standard German, English and the offered dialects. Avoids what was in the latest
 * issues. The weather report comes back in all languages.
 */
export function writeIssue(
  facts: NewspaperFact[],
  context: TextContext,
): { articles: NewspaperArticle[]; motto: string; mottoDialekte: StoredTranslations<string>; bausteine: string[]; wetter?: AllLanguages<string> } {
  const languages = languagesFor(context);
  const picker = new Picker(context.week, (context.recent ?? []).map((r) => r.bausteine));
  const articles = facts.map((fact, i) => {
    const seed = `${factKindOf(fact)}:${factCharacters(fact).join(",")}:${i}`;
    const titleId = factTitle(fact);
    const f = write(fact, context, picker, seed);
    return articleOf(
      { kind: factKindOf(fact), section: sectionOf(fact), characterIds: factCharacters(fact), ...(titleId ? { titleId } : {}) },
      f,
      languages,
    );
  });
  const mottos = picker.chooseAll("spruch", MOTTOS, "spruch");
  const weather = context.wetter ? writeWeather(context.wetter, picker) : undefined;
  return {
    articles,
    motto: mottos.de,
    mottoDialekte: storedTranslations(mottos, languages),
    bausteine: picker.chosen,
    ...(weather ? { wetter: weather } : {}),
  };
}

/** Articles from fixed phrases, without randomness. */
export function phraseArticles(facts: NewspaperFact[], context: TextContext): NewspaperArticle[] {
  return writeIssue(facts, context).articles;
}

/** Motto of the week without memory (for callers without earlier issues), in standard German. */
export function motto(week: string): string {
  return pick(MOTTOS.de, `spruch:${week}`);
}

/** Texts from fixed phrases in all offered languages, without randomness and without a language model. */
export const phraseGenerator: TextGenerator = async (facts, context) => {
  const { articles, motto: mottoDe, mottoDialekte, bausteine, wetter: weather } = writeIssue(facts, context);
  return {
    articles,
    motto: mottoDe,
    mottoDialekte,
    generator: "bausteine",
    bausteine,
    ...(weather ? { wetter: weather.de, wetterDialekte: storedTranslations(weather, languagesFor(context)) } : {}),
  };
};
