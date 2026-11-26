import type { ZeitungArticle } from "../model";
import {
  alle, hash, list, MEILENSTEIN_KOPF, MEILENSTEIN_TEXT, MEILENSTEINE_KOPF, MEILENSTEINE_TEXT, MOTTOS, NEU_KOPF, NEU_TEXT,
  NEUE_KOPF, NEUE_TEXT, Picker, POINTE_ALLGEMEIN, REZEPTE_KOPF, REZEPTE_TEXT, RUHIG_KOPF, RUHIG_TEXT, SPRUNG_KOPF,
  SPRUNG_TEXT, STOSS_KOPF, STOSS_TEXT, TITEL_BONUS, TITEL_KOPF, TITEL_KOPF_EIGEN, TITEL_POINTE, UEBERHOLUNG_KOPF, UEBERHOLUNG_TEXT,
  UEBERHOLUNGEN_KOPF, UEBERHOLUNGEN_TEXT, WERT_RAHMEN, ZAHL_TEXT, type Alle,
} from "./bausteine";
import { REKORD_ART, REKORD_EINTRAG, REKORD_KOPF, REKORD_TEXT, WETTER, WETTER_AUSKLANG, WETTER_EINSTIEG, WETTER_ORT } from "./bausteine-woche";
import { artOf, factCharacters, factTitle, sectionOf, type ZeitungFact } from "./zeitung-facts";
import type { WetterLage } from "./wetter";
import { titleDef } from "./titles";
import { aktiveSprachen, DIALEKTE, fassungIn, type Dialekte, type Sprache } from "../sprache";

export { list } from "./bausteine";

/** Sprachen neben Hochdeutsch, die eine Ausgabe zusätzlich speichern kann. */
export type Fremdsprache = Exclude<Sprache, "de">;

/**
 * Übersetzungen zu einem hochdeutschen Wert. Gespeichert werden sie im bestehenden Feld `dialekte` (bzw.
 * `mottoDialekte`, `wetterDialekte`), Englisch unter `en`; ältere Ausgaben haben dort kein Englisch.
 */
export type Uebersetzungen<T> = Partial<Record<Fremdsprache, T>>;

/** Liest eine Übersetzung aus einem gespeicherten `dialekte`-Feld; undefined, wenn es sie nicht gibt. */
export function uebersetzungIn<T>(gespeichert: Dialekte<T> | Uebersetzungen<T> | undefined, sprache: Fremdsprache): T | undefined {
  return (gespeichert as Uebersetzungen<T> | undefined)?.[sprache];
}

/** Englisch immer, Dialekte nur, wenn sie angeboten werden. */
export function uebersetzungen<T>(f: Alle<T>, sprachen: readonly Sprache[]): Uebersetzungen<T> {
  const out: Uebersetzungen<T> = { en: f.en };
  for (const d of DIALEKTE) if (sprachen.includes(d)) out[d] = f[d];
  return out;
}

/** Angebotene Sprachen eines Texters: aus dem Kontext oder aus WEBSITE_LANGUAGES (zur Laufzeit gelesen). */
export function sprachenFuer(context: Pick<TextContext, "sprachen">): Sprache[] {
  return context.sprachen ? [...context.sprachen] : aktiveSprachen(process.env.WEBSITE_LANGUAGES);
}

/** Eine frühere Ausgabe, soweit ein Texter sie kennen muss, um sich nicht zu wiederholen. */
export interface RecentIssue {
  week: string;
  /** Verwendete Baustein-Kennungen; leer bei Ausgaben eines Sprachmodells. */
  bausteine: string[];
  headlines: string[];
  texts: string[];
  motto: string;
  /** Dieselben Texte auf Englisch, Schwäbisch und Bayrisch, soweit vorhanden. */
  dialekte?: Uebersetzungen<{ headlines: string[]; texts: string[]; motto: string; wetter?: string }>;
  /** Wetterbericht der Ausgabe, falls es einen gab. */
  wetter?: string;
}

/** Was ein Texter über die Woche wissen muss, ohne an den Speicher zu gehen. */
export interface TextContext {
  week: string;
  /** Anzeigename eines Charakters. */
  name(characterId: number): string;
  /** Namen aller bekannten Charaktere, damit ein Sprachmodell-Text auf fremde Namen geprüft werden kann. */
  allNames?: string[];
  /** Die letzten Ausgaben, die jüngste zuerst (höchstens sechs). */
  recent?: RecentIssue[];
  /** Wetterlage der Woche; ohne sie gibt es keinen Wetterbericht. */
  wetter?: WetterLage;
  /** Angebotene Sprachen; ohne Angabe gilt WEBSITE_LANGUAGES. Dialekte werden nur geschrieben, wenn sie hier stehen. */
  sprachen?: readonly Sprache[];
  /** Namen der Gilden, Hauptgilde zuerst, damit ein Sprachmodell sie nennen kann. */
  gilden?: string[];
  /** Name der Zeitung aus WEBSITE_NEWSPAPER; ohne Angabe der Standardname je Sprache. */
  zeitung?: string;
}

/**
 * Ergebnis eines Texters: ein Artikel je Fakt in derselben Reihenfolge, dazu der Spruch der Woche.
 * Hochdeutsch steht in `headline`, `text` und `motto`, Englisch und die angebotenen Dialekte in `dialekte`
 * und `mottoDialekte`.
 */
export interface TextResult {
  articles: ZeitungArticle[];
  motto: string;
  mottoDialekte?: Uebersetzungen<string>;
  /** Wer geschrieben hat: `bausteine` oder `claude`. */
  generator: string;
  /** Verwendete Baustein-Kennungen (nur bei Satzbausteinen), damit die nächsten Ausgaben andere wählen. */
  bausteine?: string[];
  /** Modell, falls ein Sprachmodell geschrieben hat. */
  model?: string;
  /** Warum auf die Satzbausteine zurückgefallen wurde, falls ein Sprachmodell eingestellt war. */
  fallback?: string;
  /** Wetterbericht, hochdeutsch; nur mit Wetterlage im Kontext. */
  wetter?: string;
  wetterDialekte?: Uebersetzungen<string>;
}

/**
 * Macht aus Fakten Artikel. Die mitgelieferte Umsetzung nutzt feste Satzbausteine; `claude-text.ts`
 * bedient dieselbe Schnittstelle mit der Claude API und fällt bei Problemen hierauf zurück.
 */
export type TextGenerator = (facts: ZeitungFact[], context: TextContext) => Promise<TextResult>;

export const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
export const WOCHENTAGE: Alle<string[]> = {
  de: WEEKDAYS,
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  schwaebisch: ["Mendig", "Dienschdig", "Mittwoch", "Donnerschdig", "Freidig", "Samschdig", "Sonndig"],
  bayrisch: WEEKDAYS,
};

/** Fester Baustein je Schlüssel (ohne Gedächtnis). */
export function pick<T>(options: T[], seed: string): T {
  return options[hash(seed) % options.length];
}

interface Text {
  headline: string;
  text: string;
}

const MENGE: Alle<{ dat(n: number): string; akk(n: number): string }> = {
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

const JETZT_LEVEL: Alle<(level: number) => string> = {
  de: (l) => `jetzt Level ${l}`,
  en: (l) => `now level ${l}`,
  schwaebisch: (l) => `jetzt Level ${l}`,
  bayrisch: (l) => `jetzad Level ${l}`,
};
const AN: Alle<string> = { de: "an", en: "past", schwaebisch: "an", bayrisch: "an" };

/** Baut aus den gewählten Bausteinen und den Argumenten je Sprache die Texte aller Sprachen. */
function apply<A>(made: Alle<(a: A) => string>, args: (s: Sprache) => A): Alle<string> {
  return alle((s) => made[s](args(s)));
}

function texts(headline: Alle<string>, text: Alle<string>): Alle<Text> {
  return alle((s) => ({ headline: headline[s], text: text[s] }));
}

function write(fact: ZeitungFact, ctx: TextContext, p: Picker, seed: string): Alle<Text> {
  const n = (id: number) => ctx.name(id);
  const bonus = (titleId: string | null): Alle<string> => {
    if (!titleId) return alle(() => "");
    const def = titleDef(titleId);
    const made = p.chooseAll(`bonus-${titleId}`, TITEL_BONUS, seed, (i) => `bonus:${i}`);
    return alle((s) => ` ${made[s]({ t: def ? fassungIn(def.name, s) : titleId })}`);
  };
  const plus = (a: Alle<string>, b: Alle<string>): Alle<string> => alle((s) => a[s] + b[s]);
  switch (fact.kind) {
    case "sprung": {
      const a = { n: n(fact.characterId), levels: fact.levels, from: fact.from, to: fact.to };
      return texts(
        apply(p.chooseAll("sprung-kopf", SPRUNG_KOPF, seed), () => a),
        plus(apply(p.chooseAll("sprung-text", SPRUNG_TEXT, seed), () => a), bonus(fact.title)),
      );
    }
    case "meilensteine": {
      if (fact.entries.length === 1) {
        const a = { n: n(fact.entries[0].characterId), level: fact.entries[0].level };
        return texts(
          apply(p.chooseAll("meilenstein-kopf", MEILENSTEIN_KOPF, seed), () => a),
          apply(p.chooseAll("meilenstein-text", MEILENSTEIN_TEXT, seed), () => a),
        );
      }
      const a = (s: Sprache) => ({ l: list(fact.entries.map((e) => `${n(e.characterId)} (${e.level})`), s), k: fact.entries.length });
      return texts(
        apply(p.chooseAll("meilensteine-kopf", MEILENSTEINE_KOPF, seed), a),
        apply(p.chooseAll("meilensteine-text", MEILENSTEINE_TEXT, seed), a),
      );
    }
    case "ueberholungen": {
      if (fact.entries.length === 1) {
        const e = fact.entries[0];
        const a = { a: n(e.characterId), b: n(e.passedId), level: e.level };
        return texts(
          apply(p.chooseAll("ueberholung-kopf", UEBERHOLUNG_KOPF, seed), () => a),
          apply(p.chooseAll("ueberholung-text", UEBERHOLUNG_TEXT, seed), () => a),
        );
      }
      const a = (s: Sprache) => ({
        l: list(fact.entries.map((e) => `${n(e.characterId)} ${AN[s]} ${n(e.passedId)} (${JETZT_LEVEL[s](e.level)})`), s),
      });
      return texts(
        apply(p.chooseAll("ueberholungen-kopf", UEBERHOLUNGEN_KOPF, seed), a),
        apply(p.chooseAll("ueberholungen-text", UEBERHOLUNGEN_TEXT, seed), a),
      );
    }
    case "titel": {
      const who = n(fact.characterId);
      const def = titleDef(fact.titleId);
      const t = (s: Sprache) => (def ? fassungIn(def.name, s) : fact.titleId);
      const v = (s: Sprache) => (def ? fassungIn(def.valueText(fact.value), s) : String(fact.value));
      // Rahmen und Schlagzeilen werden je Titel gemerkt, innerhalb einer Ausgabe aber nur einmal verwendet.
      const eigen = TITEL_KOPF_EIGEN[fact.titleId];
      const headline = eigen
        ? apply(p.chooseAll(`titel-kopf-${fact.titleId}`, eigen, seed), (s) => ({ t: t(s), n: who }))
        : apply(p.chooseAll(`titel-kopf-${fact.titleId}`, TITEL_KOPF, seed, (i) => `titel-kopf:${i}`), (s) => ({ t: t(s), n: who }));
      const frame = apply(p.chooseAll(`wert-${fact.titleId}`, WERT_RAHMEN, seed, (i) => `wert:${i}`), (s) => ({ v: v(s) }));
      const pointe = apply(p.chooseAll(`pointe-${fact.titleId}`, TITEL_POINTE[fact.titleId] ?? POINTE_ALLGEMEIN, seed), () => ({ n: who }));
      return texts(headline, alle((s) => `${frame[s]} ${pointe[s]}`));
    }
    case "neuzugang": {
      if (fact.characterIds.length === 1) {
        const a = { n: n(fact.characterIds[0]) };
        return texts(apply(p.chooseAll("neu-kopf", NEU_KOPF, seed), () => a), apply(p.chooseAll("neu-text", NEU_TEXT, seed), () => a));
      }
      const a = (s: Sprache) => ({ l: list(fact.characterIds.map(n), s), k: fact.characterIds.length });
      return texts(apply(p.chooseAll("neue-kopf", NEUE_KOPF, seed), a), apply(p.chooseAll("neue-text", NEUE_TEXT, seed), a));
    }
    case "rezepte": {
      const a = (s: Sprache) => ({
        n: n(fact.characterId),
        total: fact.total,
        dat: MENGE[s].dat(fact.count),
        akk: MENGE[s].akk(fact.count),
      });
      return texts(
        apply(p.chooseAll("rezepte-kopf", REZEPTE_KOPF, seed), a),
        plus(apply(p.chooseAll("rezepte-text", REZEPTE_TEXT, seed), a), bonus(fact.title)),
      );
    }
    case "stosszeit": {
      const a = (s: Sprache) => ({ day: WOCHENTAGE[s][fact.weekday], hour: fact.hour, next: (fact.hour + 1) % 24, count: fact.count });
      return texts(apply(p.chooseAll("stoss-kopf", STOSS_KOPF, seed), a), apply(p.chooseAll("stoss-text", STOSS_TEXT, seed), a));
    }
    case "zahl":
      return texts(alle(() => String(fact.value)), p.chooseAll(`zahl-${fact.what}`, ZAHL_TEXT[fact.what] ?? ZAHL_TEXT.level, seed));
    case "ruhig":
      return texts(p.chooseAll("ruhig-kopf", RUHIG_KOPF, seed), p.chooseAll("ruhig-text", RUHIG_TEXT, seed));
    case "rekord": {
      const a = (s: Sprache) => ({
        l: list(
          fact.entries.map((e) =>
            REKORD_EINTRAG[s]({ n: e.characterId === null ? null : n(e.characterId), v: e.value, art: REKORD_ART[s][e.art], p: e.previous }),
          ),
          s,
        ),
      });
      return texts(p.chooseAll("rekord-kopf", REKORD_KOPF, seed), apply(p.chooseAll("rekord-text", REKORD_TEXT, seed), a));
    }
    case "erweiterung": {
      // Fehlende Dialekte fallen auf Deutsch zurück.
      const f = fact.schreibe({ name: n, picker: p, seed });
      return alle((s) => fassungIn(f, s));
    }
  }
}

/** Wetterbericht aus Satzbausteinen in allen Sprachen: Einstieg, ein Satz je Wetterelement, Ausklang. */
export function schreibeWetter(lage: WetterLage, p: Picker): Alle<string> {
  const einstieg = p.chooseAll("wetter-einstieg", WETTER_EINSTIEG, "wetter");
  const saetze = lage.elemente.map((el, i) => {
    const made = p.chooseAll(`wetter-${el.art}`, WETTER[el.art], `wetter:${i}`);
    return alle((s) => made[s]({ u: WETTER_ORT[s](el.ueber) }));
  });
  const ausklang = p.chooseAll("wetter-ausklang", WETTER_AUSKLANG, "wetter");
  return alle((s) => [einstieg[s], ...saetze.map((x) => x[s]), ausklang[s]].join(" "));
}

/**
 * Artikel mit hochdeutscher Fassung oben, Englisch und den angebotenen Dialekten unter `dialekte`.
 * Ohne `sprachen` gilt WEBSITE_LANGUAGES.
 */
export function articleOf(
  base: Omit<ZeitungArticle, "headline" | "text" | "dialekte">,
  f: Alle<Text>,
  sprachen: readonly Sprache[] = sprachenFuer({}),
): ZeitungArticle {
  return { ...base, headline: f.de.headline, text: f.de.text, dialekte: uebersetzungen(f, sprachen) };
}

/**
 * Schreibt eine Ausgabe aus Satzbausteinen: Hochdeutsch, Englisch und die angebotenen Dialekte. Meidet, was in den
 * letzten Ausgaben stand. Der Wetterbericht kommt in allen Sprachen zurück.
 */
export function writeIssue(
  facts: ZeitungFact[],
  context: TextContext,
): { articles: ZeitungArticle[]; motto: string; mottoDialekte: Uebersetzungen<string>; bausteine: string[]; wetter?: Alle<string> } {
  const sprachen = sprachenFuer(context);
  const picker = new Picker(context.week, (context.recent ?? []).map((r) => r.bausteine));
  const articles = facts.map((fact, i) => {
    const seed = `${artOf(fact)}:${factCharacters(fact).join(",")}:${i}`;
    const titleId = factTitle(fact);
    const f = write(fact, context, picker, seed);
    return articleOf(
      { kind: artOf(fact), section: sectionOf(fact), characterIds: factCharacters(fact), ...(titleId ? { titleId } : {}) },
      f,
      sprachen,
    );
  });
  const spruch = picker.chooseAll("spruch", MOTTOS, "spruch");
  const wetter = context.wetter ? schreibeWetter(context.wetter, picker) : undefined;
  return {
    articles,
    motto: spruch.de,
    mottoDialekte: uebersetzungen(spruch, sprachen),
    bausteine: picker.chosen,
    ...(wetter ? { wetter } : {}),
  };
}

/** Artikel aus festen Satzbausteinen, ohne Zufall. */
export function bausteinArticles(facts: ZeitungFact[], context: TextContext): ZeitungArticle[] {
  return writeIssue(facts, context).articles;
}

/** Spruch der Woche ohne Gedächtnis (für Aufrufer ohne frühere Ausgaben), hochdeutsch. */
export function motto(week: string): string {
  return pick(MOTTOS.de, `spruch:${week}`);
}

/** Texte aus festen Satzbausteinen in allen angebotenen Sprachen, ohne Zufall und ohne Sprachmodell. */
export const bausteinGenerator: TextGenerator = async (facts, context) => {
  const { articles, motto: spruch, mottoDialekte, bausteine, wetter } = writeIssue(facts, context);
  return {
    articles,
    motto: spruch,
    mottoDialekte,
    generator: "bausteine",
    bausteine,
    ...(wetter ? { wetter: wetter.de, wetterDialekte: uebersetzungen(wetter, sprachenFuer(context)) } : {}),
  };
};
