import { berlinDate } from "../lib/time";
import type { ActivityWeek, DaySnapshot, MemberSummary, TitleAward, WeekMetrics, WeeklyNumberKind } from "../model";
import type { Translations, Language } from "../language";
import type { Picker } from "./phrases";

/** Sections of the issue, in this order after the lead article. */
export const SECTIONS = ["Aufsteiger", "Rekorde", "Handwerk", "Klatsch", "Friedhof", "Zahl der Woche"] as const;
/** A section of the core or, for articles from extensions, their own (German name). */
export type Section = (typeof SECTIONS)[number] | (string & {});

/** Headline and text of an article in one language. */
export interface ArticleText {
  headline: string;
  text: string;
}

/** What an extension gets for writing its article from phrases. */
export interface WriteTools {
  /** Name of a character. */
  name: (id: number) => string;
  /**
   * Picks phrases so they do not repeat from the last issues. The extension's pool names should start with its id,
   * so they do not overlap with those of the core or other modules.
   */
  picker: Picker;
  /** Seed for the choice, different per article. */
  seed: string;
}

/**
 * Article of an extension for the weekly newspaper. The extension computes everything itself and delivers texts from
 * phrases; only the finished article is stored, with `type` as its kind, like the core's articles.
 */
export interface ExtensionFact {
  kind: "extension";
  /** Kind of the article, such as `"poll"`; stored in the article and counts for the variation between issues. */
  type: string;
  /** Section (German name); versions in other languages come from `ServerExtension.sections`. */
  section: string;
  /** News value as for the core's articles: about 10 (trifles) to 80 (huge). */
  newsValue: number;
  /** Characters concerned. Articles with former or opted-out members are dropped. */
  characterIds: number[];
  /** All numbers a text may mention (the AI texts are checked against them). */
  numbers: number[];
  /** Texts from phrases: German and English required, missing dialects fall back to German. */
  write(tools: WriteTools): Translations<ArticleText>;
  /**
   * The fact for the AI writers, with names instead of ids. The core adds `nr`, `rubrik` (section) and `art` (type);
   * these keys of the model's input stay German.
   */
  forAi(name: (id: number) => string, language: Language): Record<string, unknown>;
}

/** What happened in a week, still without words. A `TextGenerator` turns facts into articles. */
export type NewspaperFact =
  | { kind: "sprung"; characterId: number; levels: number; from: number; to: number; title: string | null }
  | { kind: "meilensteine"; entries: { characterId: number; level: number }[] }
  | { kind: "ueberholungen"; entries: { characterId: number; passedId: number; level: number }[] }
  | { kind: "titel"; titleId: string; characterId: number; value: number }
  | { kind: "neuzugang"; characterIds: number[] }
  | { kind: "rezepte"; characterId: number; count: number; total: number; crafters: number; title: string | null }
  | { kind: "stosszeit"; weekday: number; hour: number; count: number }
  | { kind: "zahl"; value: number; what: NumberKind }
  | { kind: "ruhig" }
  | { kind: "rekord"; entries: { art: WeeklyNumberKind; characterId: number | null; value: number; previous: number }[] }
  | ExtensionFact;

/** What the number of the week can consist of. */
export type NumberKind = "level" | "anmeldungen" | "rezepte" | "dungeons" | "tode" | "erfolge";

/** What an earlier issue contained, so the next one looks different. The most recent first. */
export interface RecentFacts {
  /** Article kinds of the issue, titles as `titel:<id>`. */
  kinds: string[];
  /** Kind of the number of the week. */
  zahl?: string;
}

/** Minimum values from which something is worth an article. */
export const MIN = {
  jump: 3,
  totalRecipes: 3,
  peakHour: 5,
} as const;

const MILESTONES = [60, 50, 40, 30, 20, 10];
const MAX_MILESTONES = 6;
const MAX_OVERTAKES = 3;
const RACE_TOP = 15;
/** Maximum number of articles in an issue, lead article included. */
export const MAX_ARTICLES = 10;

/** Section of a fact. */
export function sectionOf(fact: NewspaperFact): Section {
  switch (fact.kind) {
    case "sprung":
    case "meilensteine":
    case "ueberholungen":
      return "Aufsteiger";
    case "rezepte":
      return "Handwerk";
    case "titel":
      if (["dauerlaeufer", "kellerkind", "kaepsele", "frisch-eingekleidet"].includes(fact.titleId)) return "Aufsteiger";
      if (fact.titleId === "schaffe-schaffe") return "Handwerk";
      if (fact.titleId === "pechvogel") return "Friedhof";
      return "Klatsch";
    case "zahl":
      return "Zahl der Woche";
    case "rekord":
      return "Rekorde";
    case "extension":
      return fact.section;
    default:
      return "Klatsch";
  }
}

/** Kind of a fact for comparison with earlier issues. */
export function factKey(fact: NewspaperFact): string {
  return fact.kind === "titel" ? `titel:${fact.titleId}` : factKindOf(fact);
}

/** Kind as stored in the article: for extensions their own. */
export function factKindOf(fact: NewspaperFact): string {
  return fact.kind === "extension" ? fact.type : fact.kind;
}

/** News value: how big this week's event is. Higher comes further to the front. */
export function newsValue(fact: NewspaperFact): number {
  switch (fact.kind) {
    case "meilensteine":
      return 30 + 5 * Math.min(4, fact.entries.length) + (fact.entries.some((e) => e.level === 60) ? 45 : 0);
    case "sprung":
      return 40 + 3 * fact.levels;
    case "neuzugang":
      return 38 + 6 * fact.characterIds.length;
    case "ueberholungen":
      return 26 + 6 * fact.entries.length;
    case "titel": {
      const special = fact.titleId === "verlorener-sohn" ? 15 : fact.titleId === "pechvogel" ? 5 : 0;
      return 20 + special + Math.min(25, 4 * fact.value);
    }
    case "rezepte":
      return 15 + Math.min(30, Math.floor(fact.total / 5));
    case "stosszeit":
      return 10 + Math.min(20, fact.count);
    case "rekord":
      return 50 + 5 * fact.entries.length;
    case "extension":
      return fact.newsValue;
    default:
      return 0;
  }
}

/** Discount for article kinds that already appeared in the last issues, so the issues vary. */
function freshness(key: string, recent: RecentFacts[]): number {
  if (recent[0]?.kinds.includes(key)) return 0.7;
  if (recent[1]?.kinds.includes(key)) return 0.85;
  return 1;
}

/**
 * Facts of a week: lead article first, then by section. Similar articles are combined (all round levels in one
 * article, all overtakes in one), trifles below the minimum values are dropped, at most `MAX_ARTICLES` articles.
 * Characters from `excluded` (opt-out list) do not appear. Without events exactly one fact `ruhig`.
 */
export function collectFacts(input: {
  from: string;
  to: string;
  metrics: Map<number, WeekMetrics>;
  members: MemberSummary[];
  before: DaySnapshot | null;
  end: DaySnapshot | null;
  activity: ActivityWeek | null;
  titles: TitleAward[];
  excluded?: Set<number>;
  /** Earlier issues, the most recent first. */
  recent?: RecentFacts[];
  /** Finished articles from other sources (records, extensions) that compete for the slots too. */
  extraFacts?: NewspaperFact[];
}): NewspaperFact[] {
  const recent = input.recent ?? [];
  const { metrics, before, end } = input;
  const excluded = input.excluded ?? new Set<number>();
  const active = input.members.filter((m) => !m.former && !excluded.has(m.id));
  const byName = (a: MemberSummary, b: MemberSummary) => a.name.localeCompare(b.name, "de") || a.id - b.id;
  const levelOf = (snap: DaySnapshot | null, id: number) => snap?.characters[String(id)]?.level;
  const titleOf = (titleId: string, id: number) => input.titles.find((t) => t.titleId === titleId && t.characterId === id);
  // On a tie at the top, the title holder from the card first, so newspaper and title page name the same character
  const cardFirst = (titleId: string, a: MemberSummary, b: MemberSummary) =>
    Number(titleOf(titleId, b.id) !== undefined) - Number(titleOf(titleId, a.id) !== undefined);
  const facts: NewspaperFact[] = [];
  const used = new Set<string>(); // titles already contained in another article

  // Biggest level jump, from the minimum value on; the `dauerlaeufer` title is then included.
  const climbers = active
    .map((m) => ({ m, levels: metrics.get(m.id)?.levels ?? 0 }))
    .filter((c) => c.levels >= MIN.jump)
    .sort((a, b) => b.levels - a.levels || cardFirst("dauerlaeufer", a.m, b.m) || byName(a.m, b.m));
  if (climbers.length > 0) {
    const { m, levels } = climbers[0];
    const title = titleOf("dauerlaeufer", m.id) ? "dauerlaeufer" : null;
    if (title) used.add(title);
    facts.push({ kind: "sprung", characterId: m.id, levels, from: levelOf(before, m.id)!, to: levelOf(end, m.id)!, title });
  }

  // Round levels, all in one article: per character the highest one reached during the week.
  const milestones = active
    .flatMap((m) => {
      const a = levelOf(before, m.id);
      const b = levelOf(end, m.id);
      if (a === undefined || b === undefined) return [];
      const level = MILESTONES.find((l) => a < l && l <= b);
      return level === undefined ? [] : [{ m, level }];
    })
    .sort((a, b) => b.level - a.level || byName(a.m, b.m))
    .slice(0, MAX_MILESTONES);
  if (milestones.length > 0) {
    facts.push({ kind: "meilensteine", entries: milestones.map(({ m, level }) => ({ characterId: m.id, level })) });
  }

  // Overtakes among the highest at the end of the week, each character involved only once.
  const race = active
    .flatMap((m) => {
      const a = levelOf(before, m.id);
      const b = levelOf(end, m.id);
      return a === undefined || b === undefined ? [] : [{ m, a, b }];
    })
    .sort((x, y) => y.b - x.b || byName(x.m, y.m))
    .slice(0, RACE_TOP);
  const involved = new Set<number>();
  const overtakes: { characterId: number; passedId: number; level: number }[] = [];
  for (const x of race) {
    if (overtakes.length >= MAX_OVERTAKES) break;
    if (involved.has(x.m.id)) continue;
    const passed = race.find((y) => !involved.has(y.m.id) && x.a < y.a && x.b > y.b);
    if (!passed) continue;
    involved.add(x.m.id).add(passed.m.id);
    overtakes.push({ characterId: x.m.id, passedId: passed.m.id, level: x.b });
  }
  if (overtakes.length > 0) facts.push({ kind: "ueberholungen", entries: overtakes });

  // Crafting: total and the busiest crafter; the title "Schaffe, schaffe" is included if it is the same character.
  const crafters = active
    .map((m) => ({ m, count: metrics.get(m.id)?.recipes ?? 0 }))
    .filter((c) => c.count >= 1)
    .sort((a, b) => b.count - a.count || cardFirst("schaffe-schaffe", a.m, b.m) || byName(a.m, b.m));
  const totalRecipes = crafters.reduce((sum, c) => sum + c.count, 0);
  if (totalRecipes >= MIN.totalRecipes) {
    const top = crafters[0];
    const title = titleOf("schaffe-schaffe", top.m.id) ? "schaffe-schaffe" : null;
    if (title) used.add(title);
    facts.push({
      kind: "rezepte", characterId: top.m.id, count: top.count, total: totalRecipes, crafters: crafters.length, title,
    });
  }

  const activeIds = new Set(active.map((m) => m.id));
  for (const t of input.titles) {
    if (used.has(t.titleId) || !activeIds.has(t.characterId)) continue;
    facts.push({ kind: "titel", titleId: t.titleId, characterId: t.characterId, value: t.value });
  }

  // On the first day of recording everyone counts as "new"; that is no newcomer.
  const recordingStart = input.members.reduce((min, m) => {
    const day = berlinDate(m.firstSeenAt);
    return day < min ? day : min;
  }, "9999-12-31");
  const newcomers = active
    .filter((m) => {
      const day = berlinDate(m.firstSeenAt);
      return day >= input.from && day <= input.to && day > recordingStart;
    })
    .sort(byName);
  if (newcomers.length > 0) facts.push({ kind: "neuzugang", characterIds: newcomers.map((m) => m.id) });

  // Peak hour: busiest hour, only worth an article from the minimum value on.
  const cells = new Array<number>(168).fill(0);
  let logins = 0;
  for (const [id, hours] of Object.entries(input.activity?.characters ?? {})) {
    if (!activeIds.has(Number(id))) continue;
    for (const h of hours) {
      if (h >= 0 && h < 168) {
        cells[h]++;
        logins++;
      }
    }
  }
  const peak = Math.max(...cells);
  if (peak >= MIN.peakHour) {
    const hour = cells.indexOf(peak);
    facts.push({ kind: "stosszeit", weekday: Math.floor(hour / 24), hour: hour % 24, count: peak });
  }

  // Number of the week: alternates between the key figures that are big enough this time.
  const sum = (field: "levels" | "deaths" | "dungeons" | "achievements") =>
    active.reduce((total, m) => total + (metrics.get(m.id)?.[field] ?? 0), 0);
  const numbers: { what: NumberKind; value: number }[] = [
    { what: "level", value: sum("levels") },
    { what: "anmeldungen", value: logins },
    { what: "rezepte", value: totalRecipes },
    { what: "dungeons", value: sum("dungeons") },
    { what: "erfolge", value: sum("achievements") },
    { what: "tode", value: sum("deaths") },
  ];
  const eligible = numbers.filter((n) => n.value >= 10);
  const recentNumbers = recent.slice(0, 3).map((r) => r.zahl);
  const number =
    eligible.find((n) => !recentNumbers.includes(n.what)) ?? eligible.find((n) => n.what !== recentNumbers[0]) ?? eligible[0];

  facts.push(...(input.extraFacts ?? []).filter((f) => factCharacters(f).every((id) => activeIds.has(id))));

  if (facts.length === 0 && !number) return [{ kind: "ruhig" }];
  if (facts.length === 0) return [{ kind: "ruhig" }, { kind: "zahl", ...number! }];

  // By news value, with a discount for what was in recently. The strongest fact becomes the lead article, the rest
  // are ordered by their strongest article per section, the number of the week comes last.
  // The last issue's lead is reluctant to lead again this time.
  const lastLead = recent[0]?.kinds[0];
  const scored = facts
    .map((f, i) => ({ f, i, score: newsValue(f) * freshness(factKey(f), recent) }))
    .map((x) => ({ ...x, leadScore: x.score * (factKey(x.f) === lastLead ? 0.6 : 1) }))
    .sort((a, b) => b.leadScore - a.leadScore || a.i - b.i);
  const [lead, ...others] = scored;
  // The rest of the lead article's section moves a bit further back, so the issue feels mixed.
  const rest = others
    .map((x) => ({ ...x, score: x.score * (sectionOf(x.f) === sectionOf(lead.f) ? 0.75 : 1) }))
    .sort((a, b) => b.score - a.score || a.i - b.i);
  const body = rest.slice(0, MAX_ARTICLES - 1 - (number ? 1 : 0));
  const sectionRank = new Map<Section, number>();
  for (const [i, x] of body.entries()) if (!sectionRank.has(sectionOf(x.f))) sectionRank.set(sectionOf(x.f), i);
  body.sort((a, b) => sectionRank.get(sectionOf(a.f))! - sectionRank.get(sectionOf(b.f))! || b.score - a.score || a.i - b.i);
  return [lead.f, ...body.map((x) => x.f), ...(number ? [{ kind: "zahl" as const, ...number }] : [])];
}

/** Fun title a fact is about, else null. */
export function factTitle(fact: NewspaperFact): string | null {
  if (fact.kind === "titel") return fact.titleId;
  if (fact.kind === "sprung" || fact.kind === "rezepte") return fact.title;
  return null;
}

/** Characters a fact concerns. */
export function factCharacters(fact: NewspaperFact): number[] {
  switch (fact.kind) {
    case "neuzugang":
    case "extension":
      return fact.characterIds;
    case "rekord":
      return [...new Set(fact.entries.flatMap((e) => (e.characterId === null ? [] : [e.characterId])))];
    case "meilensteine":
      return fact.entries.map((e) => e.characterId);
    case "ueberholungen":
      return [...new Set(fact.entries.flatMap((e) => [e.characterId, e.passedId]))];
    case "stosszeit":
    case "zahl":
    case "ruhig":
      return [];
    default:
      return [fact.characterId];
  }
}

/** All numbers that occur in a fact (for checking texts from outside). */
export function factNumbers(fact: NewspaperFact): number[] {
  switch (fact.kind) {
    case "sprung":
      return [fact.levels, fact.from, fact.to];
    case "meilensteine":
      return fact.entries.map((e) => e.level);
    case "ueberholungen":
      return fact.entries.map((e) => e.level);
    case "titel":
      return [fact.value];
    case "neuzugang":
      return [fact.characterIds.length];
    case "rezepte":
      return [fact.count, fact.total, fact.crafters];
    case "stosszeit":
      return [fact.hour, (fact.hour + 1) % 24, fact.count];
    case "zahl":
      return [fact.value];
    case "ruhig":
      return [];
    case "rekord":
      return fact.entries.flatMap((e) => [e.value, e.previous, e.value - e.previous]);
    case "extension":
      return fact.numbers;
  }
}
