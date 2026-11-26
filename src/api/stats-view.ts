import karten from "../../config/statistik-karten.json";
import { addDays, monthOf, guildWeek } from "../lib/time";
import type { GuildRecord } from "../model";
import { statDefinition } from "../stats/definitions";
import { pickStands, statDiff, type StatsPeriod } from "../stats/diff";
import type { StatsStand, StatValues } from "../stats/stand";
import { ausKonfig, type Fassungen, type KonfigText } from "../sprache";
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

/** Wie viele Spitzenreiter je Statistik. */
export const STAT_LEADERS = 5;

export interface StatCard {
  slug: string;
  form: StatCardForm;
  title: Fassungen;
  blurb: Fassungen | null;
  span: 1 | 2 | 3;
  ids: number[];
}

/** Einheit [Einzahl, Mehrzahl] für alle Varianten oder je Variante (Dialekte optional). */
type KonfigEinheit = string[] | ({ de: string[]; en?: string[]; schwaebisch?: string[]; bayrisch?: string[] });

/** Texte dürfen ein String (gilt überall) oder ein Objekt mit `de` und optional `en`, `schwaebisch` und `bayrisch` sein. */
interface CardConfig {
  slug: string;
  form: string;
  titel: KonfigText;
  spruch?: KonfigText;
  breite?: number;
  statistiken: number[];
}

interface StatText {
  kurz?: KonfigText;
  einheit?: KonfigEinheit;
  ehrung?: KonfigText;
  klasse?: number;
  umrechnung?: { je: number; einheit: KonfigEinheit; satz: KonfigText };
}

const FORMS: StatCardForm[] = [
  "grabsteinfeld", "piktogramm", "waage", "wusstest-du", "podium", "fraktionsduell", "torte", "zahl", "flaeschle",
  "fahrplan", "ekg", "stall", "schredder", "verband",
];

const CARDS_CONFIG: CardConfig[] = karten.karten;
const TEXTS: Record<string, StatText> = karten.texte;

const twoOf = (unit: string[] | undefined): [string, string] | null =>
  unit && unit.length === 2 ? [unit[0], unit[1]] : null;

/** Einheit in allen Fassungen; fehlende oder unvollständige Fassungen fallen auf Hochdeutsch zurück. */
function pair(unit: KonfigEinheit | undefined): Fassungen<[string, string]> | null {
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

const spanOf = (breite: number | undefined): 1 | 2 | 3 => (breite === 2 || breite === 3 ? breite : 1);

const isForm = (form: string): form is StatCardForm => (FORMS as string[]).includes(form);

/** Karten aus `config/statistik-karten.json`; unbekannte Formen und Statistiken anderer Art als Zähler und Stand fallen weg. */
export function statCards(): StatCard[] {
  const shown = (id: number) => {
    const art = statDefinition(id)?.art;
    return art === "zaehler" || art === "stand";
  };
  return CARDS_CONFIG.flatMap((c): StatCard[] =>
    isForm(c.form)
      ? [{ slug: c.slug, form: c.form, title: ausKonfig(c.titel), blurb: ausKonfig(c.spruch), span: spanOf(c.breite), ids: c.statistiken.filter(shown) }]
      : [],
  );
}

function conversionOf(text: StatText): StatConversionView | null {
  const u = text.umrechnung;
  const unit = pair(u?.einheit);
  return u && unit && u.je > 0 ? { per: u.je, unit, text: ausKonfig(u.satz) } : null;
}

/** Letzter Samstag vor dem Monatsersten, also der Stand, mit dem der Vormonat endet. */
function lastWeekBeforeMonth(month: string): string {
  const lastDay = addDays(`${month}-01`, -1);
  const week = guildWeek(lastDay);
  return week > lastDay ? addDays(week, -7) : week;
}

/**
 * Welche Stände ein Zeitraum vergleicht und ob das Ergebnis taugt. Woche und Monat brauchen den Stand direkt davor
 * (Vorwoche bzw. letzte Woche des Vormonats); nur wenn der vor dem Serverstart läge, gilt der Serverstart mit lauter
 * Nullen. Gesamt vergleicht den neuesten Stand immer mit dem Serverstart.
 */
export function resolveStatsPeriod(
  available: string[],
  period: StatsPeriod,
  serverStart: string | null,
): { before: string | null; after: string | null; status: StatsView["status"] } {
  const { before, after } = pickStands(available, period, serverStart);
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

/** Zähler summiert, Stände als Höchstwert. */
function aggregate(rows: Rows, stat: string, art: "zaehler" | "stand"): number {
  let result = 0;
  for (const r of rows) {
    const v = r.values[stat] ?? 0;
    result = art === "zaehler" ? result + v : Math.max(result, v);
  }
  return result;
}

/**
 * Karten mit Zahlen: Zähler als Zuwachs zwischen den Ständen, Stände als aktueller Höchstwert im neueren Stand.
 * Wer im früheren Stand fehlt (Neuzugang, Rückkehrer), zählt bei Woche und Monat nicht mit: Sein Zähler enthält
 * alles seit Spielbeginn und würde den Zeitraum sprengen. Gesamt vergleicht mit dem Serverstart, da zählen alle.
 * Mit `guildSlug` zählen Summe und Spitzenreiter nur für diese Gilde; `perGuild` vergleicht immer alle Gilden.
 */
export function buildStatCards(
  guild: GuildRecord,
  before: StatsStand | null,
  after: StatsStand,
  guildSlug: string | null = null,
): StatCardView[] {
  const slugs = guildRefs(guild).map((g) => g.slug);
  const counterRows = rowsOf(guild, statDiff(before, after, { newCharacters: "skip" }));
  const standRows = rowsOf(guild, after.characters);
  const pick = (rows: Rows) => (guildSlug === null ? rows : rows.filter((r) => r.ref.guildSlug === guildSlug));
  return statCards().map((card) => ({
    slug: card.slug,
    form: card.form,
    title: card.title,
    blurb: card.blurb,
    span: card.span,
    stats: card.ids.map((id): StatEntryView => {
      const def = statDefinition(id)!;
      const art = def.art === "stand" ? "stand" : "zaehler";
      const key = String(id);
      const text = TEXTS[key] ?? {};
      const all = art === "zaehler" ? counterRows : standRows;
      const rows = pick(all);
      const perGuild = Object.fromEntries(
        slugs.map((slug) => [slug, aggregate(all.filter((r) => r.ref.guildSlug === slug), key, art)]),
      );
      return {
        id, name: def.name, art, total: aggregate(rows, key, art), perGuild, leaders: leadersOf(rows, key),
        holders: rows.filter((r) => (r.values[key] ?? 0) > 0).length, sum: aggregate(rows, key, "zaehler"), classId: text.klasse ?? null,
        short: ausKonfig(text.kurz), unit: pair(text.einheit), honor: ausKonfig(text.ehrung), conversion: conversionOf(text),
      };
    }),
  }));
}

/**
 * Mitglieder hinter einer Karte: je Statistik alle Charaktere mit Wert über 0, gezählt wie auf der Karte (Zähler als
 * Zuwachs ohne Neuzugänge bei Woche und Monat, Stände als aktueller Wert). Beim Stall sind bei der ersten Statistik
 * auch die Fußgänger mit 0 dabei, denn um sie geht es dort. Immer über alle Gilden; null für eine unbekannte Karte.
 */
export function buildStatCardMembers(
  before: StatsStand | null,
  after: StatsStand,
  slug: string,
): StatCardMembersView | null {
  const card = statCards().find((c) => c.slug === slug);
  if (!card) return null;
  const counters = statDiff(before, after, { newCharacters: "skip" });
  return {
    slug,
    stats: card.ids.map((id, i) => {
      const key = String(id);
      const source = statDefinition(id)!.art === "stand" ? after.characters : counters;
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

/** Lädt die beiden Stände eines aufgelösten Zeitraums; null, wenn einer fehlt. */
async function loadStands(
  store: JsonStore,
  resolved: { before: string | null; after: string },
): Promise<{ before: StatsStand | null; after: StatsStand } | null> {
  const [after, before] = await Promise.all([
    store.get<StatsStand>(`stats/${resolved.after}`),
    resolved.before === null ? null : store.get<StatsStand>(`stats/${resolved.before}`),
  ]);
  if (!after || (resolved.before !== null && !before)) return null;
  return { before, after };
}

/** Wochen mit Stand ab dem Serverstart, aufsteigend. */
async function availableStands(store: JsonStore, serverStart: string | null): Promise<string[]> {
  return (await store.list("stats/"))
    .map((k) => k.slice("stats/".length))
    .filter((w) => serverStart === null || w >= serverStart)
    .sort();
}

/**
 * Mitglieder hinter einer Karte für einen Zeitraum, wie `loadStatsView` ohne `id` die neueste Woche bzw. den neuesten
 * Monat. null, wenn die Karte unbekannt ist, Woche oder Monat keinen Stand haben oder der Zeitraum noch nicht taugt.
 */
export async function loadStatCardMembers(
  store: JsonStore,
  kind: StatsPeriodKind,
  requested: string | null,
  serverStart: string | null,
  slug: string,
): Promise<StatCardMembersView | null> {
  if (!statCards().some((c) => c.slug === slug)) return null;
  const available = await availableStands(store, serverStart);
  const weeks = [...available].reverse();
  const months = [...new Set(weeks.map(monthOf))];
  if (requested !== null && !(kind === "woche" ? weeks : months).includes(requested)) return null;
  const id = kind === "gesamt" ? "" : (requested ?? (kind === "woche" ? weeks[0] : months[0]) ?? null);
  if (id === null) return null;
  const resolved = resolveStatsPeriod(available, toPeriod(kind, id), serverStart);
  if (resolved.status !== "ok" || resolved.after === null) return null;
  const stands = await loadStands(store, { before: resolved.before, after: resolved.after });
  return stands ? buildStatCardMembers(stands.before, stands.after, slug) : null;
}

/**
 * Gildenstatistik für einen Zeitraum. Ohne `id` die neueste Woche bzw. der neueste Monat mit Stand.
 * Gibt null zurück, wenn eine angefragte Woche oder ein Monat keinen Stand hat oder die Gilde unbekannt ist.
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
  const available = await availableStands(store, serverStart);
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

  const stands = await loadStands(store, { before: resolved.before, after: resolved.after });
  if (!stands) return { ...base, status: "zu-wenig" };
  const { after, before } = stands;
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
