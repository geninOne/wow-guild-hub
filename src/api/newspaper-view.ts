import { SERVER_ERWEITERUNGEN } from "../erweiterungen";
import type { ServerErweiterung } from "../erweiterungen/typen";
import { weekBounds } from "../lib/time";
import type { NewspaperArticle, CharacterRecord, GuildRecord, WeeklyIndex, WeeklyRecord, WeeklySums, WeeklyNumbers } from "../model";
import { mitDialekten, ueberall, type Dialekte, type Fassungen } from "../sprache";
import type { JsonStore } from "../store";
import { storedTranslationIn } from "../weekly/newspaper-text";
import { titleDef } from "../weekly/titles";
import { WEEKLY_NUMBER_KINDS } from "../weekly/numbers";
import { refOf, weeklyIndex } from "./fun-common";
import { guildRefs } from "./guild-view";
import type { NewspaperArchiveView, NewspaperArticleView, NewspaperLookbackView, NewspaperView, NewspaperNumbersView, NewspaperNumberView } from "./types";

/**
 * Sections of the weekly newspaper in all languages; the standard German name is what gets stored. "Erfolge" is
 * listed here because stored issues carry it, even though its articles come from an extension today.
 */
export const SECTIONS: Record<string, Fassungen> = {
  Aufsteiger: { de: "Aufsteiger", en: "Rising Stars", schwaebisch: "Aufsteiger", bayrisch: "Aufsteiger" },
  Handwerk: { de: "Handwerk", en: "Crafting", schwaebisch: "Handwerk", bayrisch: "Handwerk" },
  Friedhof: { de: "Friedhof", en: "Graveyard", schwaebisch: "Kirchhof", bayrisch: "Friedhof" },
  Klatsch: { de: "Klatsch", en: "Gossip", schwaebisch: "Gschwätz", bayrisch: "Ratsch" },
  "Zahl der Woche": { de: "Zahl der Woche", en: "Number of the Week", schwaebisch: "Zahl vo dr Woch", bayrisch: "Zahl vo da Woch" },
  Rekorde: { de: "Rekorde", en: "Records", schwaebisch: "Rekörd", bayrisch: "Rekorde" },
  Erfolge: { de: "Erfolge", en: "Achievements", schwaebisch: "Erfolg", bayrisch: "Erfolge" },
  Vermischtes: { de: "Vermischtes", en: "Miscellaneous", schwaebisch: "Allerlei", bayrisch: "Allerhand" },
};

/** Section in all languages: from the core, else from the extensions' sections, else the German name everywhere. */
export function rubrik(name: string, erweiterungen: readonly ServerErweiterung[] = SERVER_ERWEITERUNGEN): Fassungen {
  if (Object.hasOwn(SECTIONS, name)) return SECTIONS[name];
  for (const e of erweiterungen) if (e.rubriken && Object.hasOwn(e.rubriken, name)) return e.rubriken[name];
  return ueberall(name);
}

/**
 * Stored text with its translations as `Fassungen`. English sits in the field `dialekte` under `en`; older issues
 * lack it, then German applies.
 */
function versions<T>(de: T, stored: Dialekte<T> | undefined): Fassungen<T> {
  return mitDialekten(de, stored, storedTranslationIn(stored, "en") ?? de);
}

/** One field from `Fassungen` of objects, e.g. the headlines from headline and text. */
function field<T, K extends keyof T>(f: Fassungen<T>, key: K): Fassungen<T[K]> {
  return Object.fromEntries(Object.entries(f).map(([s, v]) => [s, (v as T)[key]])) as Fassungen<T[K]>;
}

function article(guild: GuildRecord, a: NewspaperArticle): NewspaperArticleView {
  const def = a.titleId ? titleDef(a.titleId) : undefined;
  const version = versions({ headline: a.headline, text: a.text }, a.dialekte);
  return {
    kind: a.kind,
    section: rubrik(a.section ?? "Vermischtes"),
    title: def ? { id: def.id, name: def.name } : null,
    headline: field(version, "headline"),
    text: field(version, "text"),
    characters: a.characterIds.map((id) => refOf(guild, id)),
  };
}

/** Rows of the info box: only kinds with a value, plus the previous week when it is known. */
function rows(s: WeeklySums, previous: WeeklySums | undefined): NewspaperNumberView[] {
  return WEEKLY_NUMBER_KINDS.flatMap((kind) => {
    const value = s[kind];
    if (value === null || value === undefined) return [];
    const v = previous?.[kind];
    return [{ art: kind, wert: value, vorwoche: typeof v === "number" ? v : null }];
  });
}

export function numbersView(guild: GuildRecord, numbers: WeeklyNumbers | undefined): NewspaperNumbersView | null {
  if (!numbers) return null;
  const guilds = guildRefs(guild);
  return {
    guilds,
    gesamt: rows(numbers.gesamt, numbers.vorwoche?.gesamt),
    gilden: Object.fromEntries(
      Object.entries(numbers.gilden).map(([slug, s]) => [slug, rows(s, numbers.vorwoche?.gilden[slug])]),
    ),
  };
}

function lookbackView(guild: GuildRecord, record: WeeklyRecord, weeks: string[]): NewspaperLookbackView | null {
  const r = record.zeitung.rueckblick;
  if (!r) return null;
  const at = weeks.indexOf(r.week);
  return {
    week: r.week,
    issue: at >= 0 ? at + 1 : null,
    from: r.from,
    to: r.to,
    headline: versions(r.headline, r.dialekte),
    characters: r.characterIds.map((id) => refOf(guild, id)),
  };
}

export function buildNewspaperView(
  guild: GuildRecord,
  record: WeeklyRecord,
  weeks: string[],
  avatars: Record<string, string | null> = {},
): NewspaperView {
  const at = weeks.indexOf(record.week);
  return {
    issue: at + 1,
    week: record.week,
    from: record.from,
    to: record.to,
    lead: article(guild, record.zeitung.lead),
    articles: record.zeitung.articles.map((a) => article(guild, a)),
    motto: versions(record.zeitung.motto, record.zeitung.mottoDialekte),
    generator: record.zeitung.generator ?? "bausteine",
    avatars,
    previous: at > 0 ? weeks[at - 1] : null,
    next: at >= 0 && at < weeks.length - 1 ? weeks[at + 1] : null,
    testdaten: record.testdaten === true,
    zahlen: numbersView(guild, record.zahlen),
    wetter: record.zeitung.wetter ? versions(record.zeitung.wetter, record.zeitung.wetterDialekte) : null,
    rueckblick: lookbackView(guild, record, weeks),
  };
}

/** Issue of a week, the latest without a week; null if it does not exist. */
export async function loadNewspaperView(store: JsonStore, guild: GuildRecord, week: string | null): Promise<NewspaperView | null> {
  const weeks = await weeklyIndex(store);
  const wanted = week ?? weeks[weeks.length - 1];
  if (!wanted || !weeks.includes(wanted)) return null;
  const record = await store.get<WeeklyRecord>(`weekly/${wanted}`);
  if (!record) return null;
  const ids = [...new Set([record.zeitung.lead, ...record.zeitung.articles].flatMap((a) => a.characterIds))];
  const records = await Promise.all(ids.map((id) => store.get<CharacterRecord>(`characters/${id}`)));
  const avatars = Object.fromEntries(ids.map((id, i) => [String(id), records[i]?.media?.avatar ?? null]));
  return buildNewspaperView(guild, record, weeks, avatars);
}

/**
 * Archive of all issues. Headlines come from the index; only weeks from before the archive (without an index entry)
 * are loaded one by one.
 */
export async function loadNewspaperArchive(store: JsonStore): Promise<NewspaperArchiveView> {
  const index = (await store.get<WeeklyIndex>("weekly/index")) ?? { weeks: [] };
  const missing = index.weeks.filter((w) => !index.entries?.[w]);
  const loaded = await Promise.all(missing.map((w) => store.get<WeeklyRecord>(`weekly/${w}`)));
  const fallback = new Map(missing.map((w, i) => [w, loaded[i]]));
  const issues = index.weeks.flatMap((week, i) => {
    const entry = index.entries?.[week];
    const record = fallback.get(week);
    const de = entry?.headline ?? record?.zeitung.lead.headline;
    if (de === undefined) return [];
    const leadDialects = record?.zeitung.lead.dialekte;
    const headline = versions(
      de,
      entry
        ? entry.dialekte
        : leadDialects &&
            (Object.fromEntries(
              Object.entries(leadDialects).flatMap(([s, t]) => (t?.headline === undefined ? [] : [[s, t.headline]])),
            ) as Dialekte<string>),
    );
    const bounds = weekBounds(week);
    const from = entry?.from ?? record?.from ?? bounds.from;
    const to = entry?.to ?? record?.to ?? bounds.to;
    return [{ issue: i + 1, week, from, to, headline, testdaten: Boolean(entry?.testdaten ?? record?.testdaten) }];
  });
  return { issues: issues.reverse() };
}
