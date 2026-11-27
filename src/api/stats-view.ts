import cardsConfig from "../../config/stat-cards.json";
import { addDays, monthOf, guildWeek } from "../lib/time";
import type { GuildRecord } from "../model";
import { statDefinition } from "../stats/definitions";
import { pickSnapshots, statDiff, type StatsPeriod } from "../stats/diff";
import type { StatsSnapshot, StatValues } from "../stats/snapshot";
import { fromConfig, type Translations, type ConfigText } from "../language";
import type { JsonStore } from "../store";
import { refOf } from "./fun-common";
import { guildRefs } from "./guild-view";
import type {
  CharacterRef,
  MemberValue,
  StatCardForm,
  StatCardMembersView,
  StatCardView,
  StatConversionView,
  StatEntryView,
  StatsPeriodKind,
  StatsView,
} from "./types";

/** How many leaders per statistic. */
export const STAT_LEADERS = 5;

export interface StatCard {
  slug: string;
  form: StatCardForm;
  title: Translations;
  blurb: Translations | null;
  span: 1 | 2 | 3;
  ids: number[];
}

/** Unit [singular, plural] for all variants or per variant (dialects optional). */
type ConfigUnit = string[] | ({ de: string[]; en?: string[]; schwaebisch?: string[]; bayrisch?: string[] });

/** Texts may be a string (applies everywhere) or an object with `de` and optionally `en`, `schwaebisch`, `bayrisch`. */
interface CardConfig {
  slug: string;
  form: string;
  title: ConfigText;
  blurb?: ConfigText;
  width?: number;
  statistics: number[];
}

interface StatText {
  short?: ConfigText;
  unit?: ConfigUnit;
  honor?: ConfigText;
  classId?: number;
  conversion?: { per: number; unit: ConfigUnit; sentence: ConfigText };
}

const FORMS: StatCardForm[] = [
  "grabsteinfeld", "piktogramm", "waage", "wusstest-du", "podium", "fraktionsduell", "torte", "zahl", "flaeschle",
  "fahrplan", "ekg", "stall", "schredder", "verband",
];

const CARDS_CONFIG: CardConfig[] = cardsConfig.cards;
const TEXTS: Record<string, StatText> = cardsConfig.texts;

const twoOf = (unit: string[] | undefined): [string, string] | null =>
  unit && unit.length === 2 ? [unit[0], unit[1]] : null;

/** Unit in all language versions; missing or incomplete versions fall back to standard German. */
function pair(unit: ConfigUnit | undefined): Translations<[string, string]> | null {
  if (unit === undefined) return null;
  if (Array.isArray(unit)) {
    const p = twoOf(unit);
    return p ? { de: p, en: p, schwaebisch: p, bayrisch: p } : null;
  }
  const de = twoOf(unit.de);
  return de
    ? { de, en: twoOf(unit.en) ?? de, schwaebisch: twoOf(unit.schwaebisch) ?? de, bayrisch: twoOf(unit.bayrisch) ?? de }
    : null;
}

const spanOf = (width: number | undefined): 1 | 2 | 3 => (width === 2 || width === 3 ? width : 1);

const isForm = (form: string): form is StatCardForm => (FORMS as string[]).includes(form);

/**
 * Cards from `config/stat-cards.json`; unknown forms and statistics other than counters and current values
 * are dropped.
 */
export function statCards(): StatCard[] {
  const shown = (id: number) => {
    const kind = statDefinition(id)?.kind;
    return kind === "zaehler" || kind === "stand";
  };
  return CARDS_CONFIG.flatMap((c): StatCard[] =>
    isForm(c.form)
      ? [{ slug: c.slug, form: c.form, title: fromConfig(c.title), blurb: fromConfig(c.blurb), span: spanOf(c.width), ids: c.statistics.filter(shown) }]
      : [],
  );
}

function conversionOf(text: StatText): StatConversionView | null {
  const u = text.conversion;
  const unit = pair(u?.unit);
  return u && unit && u.per > 0 ? { per: u.per, unit, text: fromConfig(u.sentence) } : null;
}

/** Last Saturday before the first of the month, i.e. the snapshot that ends the previous month. */
function lastWeekBeforeMonth(month: string): string {
  const lastDay = addDays(`${month}-01`, -1);
  const week = guildWeek(lastDay);
  return week > lastDay ? addDays(week, -7) : week;
}

/**
 * Which snapshots a period compares and whether the result is usable. Week and month need the snapshot right before
 * (previous week or last week of the previous month); only if that would lie before the server start does the server
 * start with all zeros apply. Total always compares the latest snapshot with the server start.
 */
export function resolveStatsPeriod(
  available: string[],
  period: StatsPeriod,
  serverStart: string | null,
): { before: string | null; after: string | null; status: StatsView["status"] } {
  const { before, after } = pickSnapshots(available, period, serverStart);
  if (after === null) return { before: null, after: null, status: available.length === 0 ? "keine" : "zu-wenig" };
  if (period.kind === "total") return { before: null, after, status: "ok" };
  const expected = period.kind === "week" ? addDays(period.week, -7) : lastWeekBeforeMonth(period.month);
  const startWeek = serverStart === null ? null : guildWeek(serverStart);
  const ok = before === expected || (before === null && startWeek !== null && expected < startWeek);
  return { before: ok ? before : null, after, status: ok ? "ok" : "zu-wenig" };
}

type Rows = { ref: CharacterRef; values: StatValues }[];

function rowsOf(guild: GuildRecord, values: Record<string, StatValues>): Rows {
  return Object.entries(values).map(([id, v]) => ({ ref: refOf(guild, Number(id)), values: v }));
}

function leadersOf(rows: Rows, stat: string): StatEntryView["leaders"] {
  return rows
    .map((r) => ({ character: r.ref, value: r.values[stat] ?? 0 }))
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value || a.character.name.localeCompare(b.character.name, "de"))
    .slice(0, STAT_LEADERS);
}

/** Counters summed up, current values as the maximum. */
function aggregate(rows: Rows, stat: string, kind: "zaehler" | "stand"): number {
  let result = 0;
  for (const r of rows) {
    const v = r.values[stat] ?? 0;
    result = kind === "zaehler" ? result + v : Math.max(result, v);
  }
  return result;
}

/**
 * Cards with numbers: counters as the gain between snapshots, current values as the maximum in the newer snapshot.
 * Whoever is missing from the earlier snapshot (newcomer, returner) does not count for week and month: their counter
 * holds everything since they started playing and would blow up the period. Total compares with the server start, so
 * everyone counts there. With `guildSlug`, sum and leaders count only for that guild; `perGuild` always compares all
 * guilds.
 */
export function buildStatCards(
  guild: GuildRecord,
  before: StatsSnapshot | null,
  after: StatsSnapshot,
  guildSlug: string | null = null,
): StatCardView[] {
  const slugs = guildRefs(guild).map((g) => g.slug);
  const counterRows = rowsOf(guild, statDiff(before, after, { newCharacters: "skip" }));
  const currentRows = rowsOf(guild, after.characters);
  const pick = (rows: Rows) => (guildSlug === null ? rows : rows.filter((r) => r.ref.guildSlug === guildSlug));
  return statCards().map((card) => ({
    slug: card.slug,
    form: card.form,
    title: card.title,
    blurb: card.blurb,
    span: card.span,
    stats: card.ids.map((id): StatEntryView => {
      const def = statDefinition(id)!;
      const kind = def.kind === "stand" ? "stand" : "zaehler";
      const key = String(id);
      const text = TEXTS[key] ?? {};
      const all = kind === "zaehler" ? counterRows : currentRows;
      const rows = pick(all);
      const perGuild = Object.fromEntries(
        slugs.map((slug) => [slug, aggregate(all.filter((r) => r.ref.guildSlug === slug), key, kind)]),
      );
      return {
        id, name: def.name, art: kind, total: aggregate(rows, key, kind), perGuild, leaders: leadersOf(rows, key),
        holders: rows.filter((r) => (r.values[key] ?? 0) > 0).length, sum: aggregate(rows, key, "zaehler"), classId: text.classId ?? null,
        short: fromConfig(text.short), unit: pair(text.unit), honor: fromConfig(text.honor), conversion: conversionOf(text),
      };
    }),
  }));
}

/**
 * Members behind a card: per statistic all characters with a value above 0, counted as on the card (counters as gain
 * without newcomers for week and month, current values as they are). For the stable, the first statistic also
 * includes those on foot with 0, because they are the point there. Always across all guilds; null for an unknown card.
 */
export function buildStatCardMembers(
  before: StatsSnapshot | null,
  after: StatsSnapshot,
  slug: string,
): StatCardMembersView | null {
  const card = statCards().find((c) => c.slug === slug);
  if (!card) return null;
  const counters = statDiff(before, after, { newCharacters: "skip" });
  return {
    slug,
    stats: card.ids.map((id, i) => {
      const key = String(id);
      const source = statDefinition(id)!.kind === "stand" ? after.characters : counters;
      const withZero = card.form === "stall" && i === 0;
      const entries = Object.entries(source)
        .map(([charId, values]): MemberValue => [Number(charId), values[key] ?? 0])
        .filter(([, value]) => value > 0 || withZero)
        .sort((a, b) => b[1] - a[1] || a[0] - b[0]);
      return { id, entries };
    }),
  };
}

function toPeriod(kind: StatsPeriodKind, id: string): StatsPeriod {
  if (kind === "woche") return { kind: "week", week: id };
  if (kind === "monat") return { kind: "month", month: id };
  return { kind: "total" };
}

/** Loads both snapshots of a resolved period; null if one is missing. */
async function loadSnapshots(
  store: JsonStore,
  resolved: { before: string | null; after: string },
): Promise<{ before: StatsSnapshot | null; after: StatsSnapshot } | null> {
  const [after, before] = await Promise.all([
    store.get<StatsSnapshot>(`stats/${resolved.after}`),
    resolved.before === null ? null : store.get<StatsSnapshot>(`stats/${resolved.before}`),
  ]);
  if (!after || (resolved.before !== null && !before)) return null;
  return { before, after };
}

/** Weeks with a snapshot from the server start on, ascending. */
async function availableSnapshots(store: JsonStore, serverStart: string | null): Promise<string[]> {
  return (await store.list("stats/"))
    .map((k) => k.slice("stats/".length))
    .filter((w) => serverStart === null || w >= serverStart)
    .sort();
}

/**
 * Members behind a card for a period; like `loadStatsView`, without `id` the latest week or month. null if the card is
 * unknown, the week or month has no snapshot, or the period is not usable yet.
 */
export async function loadStatCardMembers(
  store: JsonStore,
  kind: StatsPeriodKind,
  requested: string | null,
  serverStart: string | null,
  slug: string,
): Promise<StatCardMembersView | null> {
  if (!statCards().some((c) => c.slug === slug)) return null;
  const available = await availableSnapshots(store, serverStart);
  const weeks = [...available].reverse();
  const months = [...new Set(weeks.map(monthOf))];
  if (requested !== null && !(kind === "woche" ? weeks : months).includes(requested)) return null;
  const id = kind === "gesamt" ? "" : (requested ?? (kind === "woche" ? weeks[0] : months[0]) ?? null);
  if (id === null) return null;
  const resolved = resolveStatsPeriod(available, toPeriod(kind, id), serverStart);
  if (resolved.status !== "ok" || resolved.after === null) return null;
  const snapshots = await loadSnapshots(store, { before: resolved.before, after: resolved.after });
  return snapshots ? buildStatCardMembers(snapshots.before, snapshots.after, slug) : null;
}

/**
 * Guild statistics for a period. Without `id` the latest week or month with a snapshot. Returns null if a requested
 * week or month has no snapshot or the guild is unknown.
 */
export async function loadStatsView(
  store: JsonStore,
  guild: GuildRecord,
  kind: StatsPeriodKind,
  requested: string | null,
  serverStart: string | null,
  guildSlug: string | null = null,
): Promise<StatsView | null> {
  const guilds = guildRefs(guild);
  if (guildSlug !== null && !guilds.some((g) => g.slug === guildSlug)) return null;
  const available = await availableSnapshots(store, serverStart);
  const weeks = [...available].reverse();
  const months = [...new Set(weeks.map(monthOf))];
  const latest = kind === "woche" ? weeks[0] : kind === "monat" ? months[0] : undefined;
  const id = kind === "gesamt" ? null : (requested ?? latest ?? null);
  if (requested !== null && !(kind === "woche" ? weeks : months).includes(requested)) return null;

  const base: StatsView = {
    kind, id, status: "keine", before: null, after: null, takenAt: null, serverStart, nachgeholt: false, characters: 0,
    weeks, months, guilds, guild: guildSlug, cards: [],
  };
  if (kind !== "gesamt" && id === null) return base;
  const resolved = resolveStatsPeriod(available, toPeriod(kind, id ?? ""), serverStart);
  if (resolved.after === null) return { ...base, status: resolved.status };

  const snapshots = await loadSnapshots(store, { before: resolved.before, after: resolved.after });
  if (!snapshots) return { ...base, status: "zu-wenig" };
  const { after, before } = snapshots;
  const view: StatsView = {
    ...base,
    status: resolved.status,
    before: resolved.before,
    after: resolved.after,
    takenAt: after.takenAt,
    nachgeholt: after.nachgeholt === true,
    characters: Object.keys(after.characters).filter(
      (id) => guildSlug === null || refOf(guild, Number(id)).guildSlug === guildSlug,
    ).length,
  };
  if (resolved.status === "ok") view.cards = buildStatCards(guild, before, after, guildSlug);
  return view;
}
