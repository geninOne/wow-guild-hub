import { SERVER_ERWEITERUNGEN } from "../erweiterungen";
import type { ServerErweiterung } from "../erweiterungen/typen";
import { weekBounds } from "../lib/time";
import type { ZeitungArticle, CharacterRecord, GuildRecord, WeeklyIndex, WeeklyRecord, WochenSummen, WochenZahlen } from "../model";
import { mitDialekten, ueberall, type Dialekte, type Fassungen } from "../sprache";
import type { JsonStore } from "../store";
import { uebersetzungIn } from "../weekly/zeitung-text";
import { titleDef } from "../weekly/titles";
import { WOCHEN_ZAHL_ARTEN } from "../weekly/zahlen";
import { refOf, weeklyIndex } from "./fun-common";
import { guildRefs } from "./guild-view";
import type { ZeitungArchiveView, ZeitungArticleView, ZeitungRueckblickView, ZeitungView, ZeitungZahlenView, ZeitungZahlView } from "./types";

/**
 * Rubriken der Wochenzeitung in allen Sprachen; gespeichert wird der hochdeutsche Name. "Erfolge" steht hier, weil
 * gespeicherte Ausgaben sie tragen, auch wenn ihre Meldungen heute aus einer Erweiterung kommen.
 */
export const RUBRIKEN: Record<string, Fassungen> = {
  Aufsteiger: { de: "Aufsteiger", en: "Rising Stars", schwaebisch: "Aufsteiger", bayrisch: "Aufsteiger" },
  Handwerk: { de: "Handwerk", en: "Crafting", schwaebisch: "Handwerk", bayrisch: "Handwerk" },
  Friedhof: { de: "Friedhof", en: "Graveyard", schwaebisch: "Kirchhof", bayrisch: "Friedhof" },
  Klatsch: { de: "Klatsch", en: "Gossip", schwaebisch: "Gschwätz", bayrisch: "Ratsch" },
  "Zahl der Woche": { de: "Zahl der Woche", en: "Number of the Week", schwaebisch: "Zahl vo dr Woch", bayrisch: "Zahl vo da Woch" },
  Rekorde: { de: "Rekorde", en: "Records", schwaebisch: "Rekörd", bayrisch: "Rekorde" },
  Erfolge: { de: "Erfolge", en: "Achievements", schwaebisch: "Erfolg", bayrisch: "Erfolge" },
  Vermischtes: { de: "Vermischtes", en: "Miscellaneous", schwaebisch: "Allerlei", bayrisch: "Allerhand" },
};

/** Rubrik in allen Sprachen: aus dem Kern, sonst aus den Rubriken der Erweiterungen, sonst überall der deutsche Name. */
export function rubrik(name: string, erweiterungen: readonly ServerErweiterung[] = SERVER_ERWEITERUNGEN): Fassungen {
  if (Object.hasOwn(RUBRIKEN, name)) return RUBRIKEN[name];
  for (const e of erweiterungen) if (e.rubriken && Object.hasOwn(e.rubriken, name)) return e.rubriken[name];
  return ueberall(name);
}

/**
 * Gespeicherter Text samt Übersetzungen als Fassungen. Englisch steht im Feld `dialekte` unter `en`; ältere
 * Ausgaben haben es nicht, dann gilt Deutsch.
 */
function fassungen<T>(de: T, gespeichert: Dialekte<T> | undefined): Fassungen<T> {
  return mitDialekten(de, gespeichert, uebersetzungIn(gespeichert, "en") ?? de);
}

/** Ein Feld aus Fassungen von Objekten, z. B. die Schlagzeilen aus Schlagzeile und Text. */
function feld<T, K extends keyof T>(f: Fassungen<T>, key: K): Fassungen<T[K]> {
  return Object.fromEntries(Object.entries(f).map(([s, v]) => [s, (v as T)[key]])) as Fassungen<T[K]>;
}

function article(guild: GuildRecord, a: ZeitungArticle): ZeitungArticleView {
  const def = a.titleId ? titleDef(a.titleId) : undefined;
  const fassung = fassungen({ headline: a.headline, text: a.text }, a.dialekte);
  return {
    kind: a.kind,
    section: rubrik(a.section ?? "Vermischtes"),
    title: def ? { id: def.id, name: def.name } : null,
    headline: feld(fassung, "headline"),
    text: feld(fassung, "text"),
    characters: a.characterIds.map((id) => refOf(guild, id)),
  };
}

/** Zeilen des Infokastens: nur Arten mit Wert, Vorwoche dazu, wenn sie bekannt ist. */
function zeilen(s: WochenSummen, vor: WochenSummen | undefined): ZeitungZahlView[] {
  return WOCHEN_ZAHL_ARTEN.flatMap((art) => {
    const wert = s[art];
    if (wert === null || wert === undefined) return [];
    const v = vor?.[art];
    return [{ art, wert, vorwoche: typeof v === "number" ? v : null }];
  });
}

export function zahlenView(guild: GuildRecord, zahlen: WochenZahlen | undefined): ZeitungZahlenView | null {
  if (!zahlen) return null;
  const guilds = guildRefs(guild);
  return {
    guilds,
    gesamt: zeilen(zahlen.gesamt, zahlen.vorwoche?.gesamt),
    gilden: Object.fromEntries(
      Object.entries(zahlen.gilden).map(([slug, s]) => [slug, zeilen(s, zahlen.vorwoche?.gilden[slug])]),
    ),
  };
}

function rueckblickView(guild: GuildRecord, record: WeeklyRecord, weeks: string[]): ZeitungRueckblickView | null {
  const r = record.zeitung.rueckblick;
  if (!r) return null;
  const at = weeks.indexOf(r.week);
  return {
    week: r.week,
    issue: at >= 0 ? at + 1 : null,
    from: r.from,
    to: r.to,
    headline: fassungen(r.headline, r.dialekte),
    characters: r.characterIds.map((id) => refOf(guild, id)),
  };
}

export function buildZeitungView(
  guild: GuildRecord,
  record: WeeklyRecord,
  weeks: string[],
  avatars: Record<string, string | null> = {},
): ZeitungView {
  const at = weeks.indexOf(record.week);
  return {
    issue: at + 1,
    week: record.week,
    from: record.from,
    to: record.to,
    lead: article(guild, record.zeitung.lead),
    articles: record.zeitung.articles.map((a) => article(guild, a)),
    motto: fassungen(record.zeitung.motto, record.zeitung.mottoDialekte),
    generator: record.zeitung.generator ?? "bausteine",
    avatars,
    previous: at > 0 ? weeks[at - 1] : null,
    next: at >= 0 && at < weeks.length - 1 ? weeks[at + 1] : null,
    testdaten: record.testdaten === true,
    zahlen: zahlenView(guild, record.zahlen),
    wetter: record.zeitung.wetter ? fassungen(record.zeitung.wetter, record.zeitung.wetterDialekte) : null,
    rueckblick: rueckblickView(guild, record, weeks),
  };
}

/** Ausgabe einer Woche, ohne Woche die neueste; null, wenn es sie nicht gibt. */
export async function loadZeitungView(store: JsonStore, guild: GuildRecord, week: string | null): Promise<ZeitungView | null> {
  const weeks = await weeklyIndex(store);
  const wanted = week ?? weeks[weeks.length - 1];
  if (!wanted || !weeks.includes(wanted)) return null;
  const record = await store.get<WeeklyRecord>(`weekly/${wanted}`);
  if (!record) return null;
  const ids = [...new Set([record.zeitung.lead, ...record.zeitung.articles].flatMap((a) => a.characterIds))];
  const records = await Promise.all(ids.map((id) => store.get<CharacterRecord>(`characters/${id}`)));
  const avatars = Object.fromEntries(ids.map((id, i) => [String(id), records[i]?.media?.avatar ?? null]));
  return buildZeitungView(guild, record, weeks, avatars);
}

/**
 * Archiv aller Ausgaben. Schlagzeilen kommen aus dem Index; nur Wochen aus der Zeit vor dem Archiv
 * (ohne Eintrag im Index) werden einzeln geladen.
 */
export async function loadZeitungArchive(store: JsonStore): Promise<ZeitungArchiveView> {
  const index = (await store.get<WeeklyIndex>("weekly/index")) ?? { weeks: [] };
  const missing = index.weeks.filter((w) => !index.entries?.[w]);
  const loaded = await Promise.all(missing.map((w) => store.get<WeeklyRecord>(`weekly/${w}`)));
  const fallback = new Map(missing.map((w, i) => [w, loaded[i]]));
  const issues = index.weeks.flatMap((week, i) => {
    const entry = index.entries?.[week];
    const record = fallback.get(week);
    const de = entry?.headline ?? record?.zeitung.lead.headline;
    if (de === undefined) return [];
    const leadDialekte = record?.zeitung.lead.dialekte;
    const headline = fassungen(
      de,
      entry
        ? entry.dialekte
        : leadDialekte &&
            (Object.fromEntries(
              Object.entries(leadDialekte).flatMap(([s, t]) => (t?.headline === undefined ? [] : [[s, t.headline]])),
            ) as Dialekte<string>),
    );
    const bounds = weekBounds(week);
    const from = entry?.from ?? record?.from ?? bounds.from;
    const to = entry?.to ?? record?.to ?? bounds.to;
    return [{ issue: i + 1, week, from, to, headline, testdaten: Boolean(entry?.testdaten ?? record?.testdaten) }];
  });
  return { issues: issues.reverse() };
}
