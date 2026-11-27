import { withLateStarts } from "../lib/baseline";
import { serverStartSnapshot, sinceServerStart, startsWithin } from "../lib/server-start";
import { SERVER_START } from "../server-start";
import { addDays, berlinDate, compareWeeks, dateOfWeekHour, isoWeeksBetween, isWeek, shiftGuildWeek, guildRange, guildWeek, weekBounds, weekRange } from "../lib/time";
import type { ActivityWeek, DaySnapshot, GuildRecord, WeekMetrics, WeeklyIndex, WeeklyRecord } from "../model";
import type { JsonStore } from "../store";
import type { AnyServerExtension } from "../extensions/legacy";
import { issueExtras } from "./issue-extras";
import { RECENT_ISSUES } from "./phrases";
import { collectFacts, factKey, type RecentFacts } from "./newspaper-facts";
import { DIALECTS } from "../language";
import { storedTranslationIn, type OtherLanguage, type RecentIssue, type TextGenerator } from "./newspaper-text";
import { generatorFromEnv } from "./claude-text";
import { weekMetrics } from "./metrics";
import { isOptedOut, rankTitles, TITLE_OPT_OUTS } from "./titles";

export interface WeeklyDeps {
  store: JsonStore;
  now: () => Date;
  /** Opt-out list for titles; default from `TITLE_OPT_OUTS`. */
  optOuts?: (string | number)[];
  /** Writer for the newspaper; default by environment (Claude API with a key, else phrases). */
  generator?: TextGenerator;
  /** How many completed weeks are caught up at most. */
  maxWeeks?: number;
  /** Day of the server start; default from `config/server-start.json`, null turns the rule off. */
  serverStart?: string | null;
  /** Extensions to use instead of the registered ones (tests); 2.x modules are converted. */
  extensions?: readonly AnyServerExtension[];
  /** @deprecated 2.x name of `extensions`. */
  erweiterungen?: readonly AnyServerExtension[];
}

export interface WeeklyRunReport {
  at: string;
  /** Newly evaluated weeks. */
  evaluated: string[];
  /** Weeks without data, for which nothing was written. */
  empty: string[];
  durationMs: number;
}

/** Daily snapshots for a week: the last one before it (failing that, the earliest in the week) and the last in the week. */
export function snapshotDates(dates: string[], from: string, to: string): { before: string | null; end: string | null } {
  const sorted = [...dates].sort();
  const inside = sorted.filter((d) => d >= from && d <= to);
  const earlier = sorted.filter((d) => d < from);
  return {
    before: earlier[earlier.length - 1] ?? inside[0] ?? null,
    end: inside[inside.length - 1] ?? null,
  };
}

/**
 * Activity of a period (a scoring week or part of one), assembled from the ISO week blocks that touch it. The hours
 * stay week hours with Monday 0:00 = 0: since the period contains each weekday at most once, there is no overlap,
 * and weekday and time of day can be read as usual.
 *
 * A return (a break of at least 7 days) is always the first login of its ISO block; it counts if that lies in the period.
 * null if nobody logged in during the period and there is no block.
 */
export async function weekActivity(store: JsonStore, week: string, from: string, to: string): Promise<ActivityWeek | null> {
  const blocks = await Promise.all(isoWeeksBetween(from, to).map((w) => store.get<ActivityWeek>(`activity/${w}`)));
  const inside = (block: ActivityWeek, h: number) => {
    const date = dateOfWeekHour(block.week, h);
    return date >= from && date <= to;
  };
  const characters: Record<string, number[]> = {};
  const returns: Record<string, number> = {};
  let found = false;
  let testData = false;
  for (const block of blocks) {
    if (!block) continue;
    found = true;
    testData ||= block.testdaten === true;
    for (const [id, hours] of Object.entries(block.characters)) {
      const kept = hours.filter((h) => inside(block, h));
      if (kept.length > 0) characters[id] = [...(characters[id] ?? []), ...kept].sort((a, b) => a - b);
    }
    for (const [id, days] of Object.entries(block.returns ?? {})) {
      const first = block.characters[id]?.[0];
      if (first !== undefined && inside(block, first)) returns[id] = Math.max(returns[id] ?? 0, days);
    }
  }
  if (!found) return null;
  return {
    week,
    characters,
    ...(Object.keys(returns).length > 0 ? { returns } : {}),
    ...(testData ? { testdaten: true } : {}),
  };
}

/** What fact selection and writers need to know about an earlier issue. */
export function recentOf(records: WeeklyRecord[]): { facts: RecentFacts[]; issues: RecentIssue[] } {
  return {
    facts: records.map((r) => {
      const all = [r.zeitung.lead, ...r.zeitung.articles];
      return {
        kinds: all.map((a) => (a.kind === "titel" && a.titleId ? factKey({ kind: "titel", titleId: a.titleId, characterId: 0, value: 0 }) : a.kind)),
        zahl: r.zeitung.zahl,
      };
    }),
    issues: records.map((r) => {
      const all = [r.zeitung.lead, ...r.zeitung.articles];
      return {
        week: r.week,
        bausteine: r.zeitung.bausteine ?? [],
        headlines: all.map((a) => a.headline),
        texts: all.map((a) => a.text),
        motto: r.zeitung.motto,
        // English and dialects; older issues without a translation provide the Standard German texts instead.
        dialekte: Object.fromEntries(
          (["en", ...DIALECTS] as OtherLanguage[]).map((d) => [
            d,
            {
              headlines: all.map((a) => storedTranslationIn(a.dialekte, d)?.headline ?? a.headline),
              texts: all.map((a) => storedTranslationIn(a.dialekte, d)?.text ?? a.text),
              motto: storedTranslationIn(r.zeitung.mottoDialekte, d) ?? r.zeitung.motto,
              ...(r.zeitung.wetter ? { wetter: storedTranslationIn(r.zeitung.wetterDialekte, d) ?? r.zeitung.wetter } : {}),
            },
          ]),
        ),
        ...(r.zeitung.wetter ? { wetter: r.zeitung.wetter } : {}),
      };
    }),
  };
}

/** Evaluates a week; null if there is neither activity nor a daily snapshot in the week. */
export async function evaluateWeek(
  deps: WeeklyDeps,
  week: string,
  guild: GuildRecord,
  historyDates: string[],
  /** Earlier issues, the most recent first. */
  previous: WeeklyRecord[] = [],
  /** Scored period; default is the whole week. In the transition week it starts later. */
  range: { from: string; to: string } = weekBounds(week),
  /** All earlier weekly results, the most recent first, for choosing the title holder on a tie. */
  titleHistory: Pick<WeeklyRecord, "titles">[] = previous,
): Promise<WeeklyRecord | null> {
  const recent = recentOf(previous.slice(0, RECENT_ISSUES));
  const { from, to } = range;
  const basis = await weekBasis(deps, week, guild, historyDates, range);
  if (!basis) return null;
  const { activity, before, end, metrics } = basis;
  const optOuts = deps.optOuts ?? TITLE_OPT_OUTS;
  const { awards: titles, rankings } = rankTitles(metrics, guild.members, optOuts, { week, previous: titleHistory });
  // Opted-out members do not appear in the newspaper at all, not even in overtakes or as newcomers.
  const excluded = new Set(guild.members.filter((m) => isOptedOut(m, optOuts)).map((m) => m.id));
  const extras = await issueExtras({
    store: deps.store, guild, from, to, metrics, excluded, previous, extensions: deps.extensions, erweiterungen: deps.erweiterungen,
    keyFigures: async (f, t) => (await weekBasis(deps, t, guild, historyDates, { from: f, to: t }))?.metrics ?? null,
  });
  const facts = collectFacts({ from, to, metrics, members: guild.members, before, end, activity, titles, excluded, recent: recent.facts, extraFacts: extras.extraFacts });
  const names = new Map(guild.members.map((m) => [m.id, m.name]));
  const result = await (deps.generator ?? generatorFromEnv())(facts, {
    week,
    name: (id) => names.get(id) ?? "Unbekannt",
    allNames: [...new Set(guild.members.map((m) => m.name))],
    recent: recent.issues,
    wetter: extras.weather,
    gilden: guild.guilds?.map((g) => g.name) ?? [guild.name],
  });
  const numberFact = facts.find((f) => f.kind === "zahl");
  const [lead, ...articles] = result.articles;
  const testData = Boolean(activity?.testdaten || before?.testdaten || end?.testdaten);
  return {
    week,
    from,
    to,
    generatedAt: deps.now().toISOString(),
    titles,
    rankings,
    zeitung: {
      lead,
      articles,
      motto: result.motto,
      ...(result.mottoDialekte ? { mottoDialekte: result.mottoDialekte } : {}),
      generator: result.generator,
      ...(result.model ? { model: result.model } : {}),
      ...(result.fallback ? { fallback: result.fallback } : {}),
      ...(result.bausteine ? { bausteine: result.bausteine } : {}),
      ...(numberFact?.kind === "zahl" ? { zahl: numberFact.what } : {}),
      ...(result.wetter ? { wetter: result.wetter, ...(result.wetterDialekte ? { wetterDialekte: result.wetterDialekte } : {}) } : {}),
      ...(extras.lookback ? { rueckblick: extras.lookback } : {}),
    },
    ...(testData ? { testdaten: true } : {}),
    zahlen: extras.numbers,
  };
}

/**
 * Activity, daily snapshots and key figures of a period; null if there is neither activity nor a daily snapshot.
 * Serves the evaluation and recomputing earlier weeks for the previous week and records.
 */
export async function weekBasis(
  deps: WeeklyDeps,
  week: string,
  guild: GuildRecord,
  historyDates: string[],
  range: { from: string; to: string },
): Promise<{ activity: ActivityWeek | null; before: DaySnapshot | null; end: DaySnapshot | null; metrics: Map<number, WeekMetrics> } | null> {
  const { store } = deps;
  const { from, to } = range;
  const activity = await weekActivity(store, week, from, to);
  const serverStart = deps.serverStart === undefined ? SERVER_START : deps.serverStart;
  // Daily snapshots before the server start are never fit for comparison.
  const usable = sinceServerStart(historyDates, serverStart);
  const startWeek = startsWithin(serverStart, from, to);
  const dates = snapshotDates(usable, from, to);
  const hasActivity = activity !== null && Object.keys(activity.characters).length > 0;
  if (!hasActivity && dates.end === null) return null;

  const [first, end] = await Promise.all([
    dates.before && !startWeek ? store.get<DaySnapshot>(`history/${dates.before}`) : null,
    dates.end ? store.get<DaySnapshot>(`history/${dates.end}`) : null,
  ]);
  // In the server start week everyone starts at level 1 and counter 0.
  // Otherwise: whoever joined during the week counts from their first snapshot in the week.
  const before = startWeek
    ? end && serverStartSnapshot(serverStart, end)
    : (await withLateStarts(store, usable, first, end, guild.members)).before;
  const metrics = weekMetrics({ activity, before, end, members: guild.members });
  return { activity, before, end, metrics };
}

/**
 * Last day already scored by issues from before the switch (ISO weeks Monday to Sunday); null without such issues.
 * The first scoring week after that starts on the following day, so no day is missing or counted twice.
 */
export function legacyEnd(weeks: string[]): string | null {
  const ends = weeks.filter(isWeek).map((w) => weekRange(w).to).sort();
  return ends[ends.length - 1] ?? null;
}

/**
 * Evaluates all completed scoring weeks (Sunday to Saturday) that have no result yet (titles and newspaper).
 * A week is completed from Sunday 0:00 Berlin time.
 * Idempotent: a second run writes nothing. Weeks without data stay open and are checked again later.
 * Issues of old ISO weeks stay unchanged; scoring weeks up to their end are no longer created.
 */
export async function runWeeklyEvaluation(deps: WeeklyDeps): Promise<WeeklyRunReport> {
  const { store } = deps;
  const started = Date.now();
  const at = deps.now().toISOString();
  const report = (evaluated: string[], empty: string[]): WeeklyRunReport => ({
    at, evaluated, empty, durationMs: Date.now() - started,
  });

  const current = guildWeek(berlinDate(at));
  const index = (await store.get<WeeklyIndex>("weekly/index")) ?? { weeks: [] };
  const maxWeeks = deps.maxWeeks ?? 8;
  const covered = legacyEnd(index.weeks);
  const missing = Array.from({ length: maxWeeks }, (_, i) => shiftGuildWeek(current, i - maxWeeks)).filter(
    (week) => !index.weeks.includes(week) && (covered === null || week > covered),
  );
  const rangeOf = (week: string) => {
    const { from, to } = guildRange(week);
    return { from: covered !== null && covered >= from ? addDays(covered, 1) : from, to };
  };
  if (missing.length === 0) return report([], []);
  const guild = await store.get<GuildRecord>("guild");
  if (!guild) return report([], missing);

  const historyDates = (await store.list("history/")).map((key) => key.slice("history/".length));
  // One after another, oldest first: each issue knows the previous ones and avoids their wording.
  // Each week is stored right away; if a run aborts, the next one continues there.
  const generator = deps.generator ?? generatorFromEnv();
  const cache = new Map<string, WeeklyRecord | null>();
  const load = async (w: string) => {
    if (!cache.has(w)) cache.set(w, await store.get<WeeklyRecord>(`weekly/${w}`));
    return cache.get(w) ?? null;
  };
  const evaluated: string[] = [];
  const empty: string[] = [];
  const entries = { ...index.entries };
  const known = [...index.weeks];
  for (const week of [...missing].sort(compareWeeks)) {
    // All earlier weeks, the most recent first: the whole history for the titles, only the last issues for the newspaper.
    const earlier = known.filter((w) => compareWeeks(w, week) < 0).sort(compareWeeks).reverse();
    const all = (await Promise.all(earlier.map(load))).filter((r): r is WeeklyRecord => r !== null);
    const previous = all.slice(0, RECENT_ISSUES);
    const record = await evaluateWeek({ ...deps, generator }, week, guild, historyDates, previous, rangeOf(week), all);
    if (!record) {
      empty.push(week);
      continue;
    }
    await store.set(`weekly/${week}`, record);
    cache.set(week, record);
    known.push(week);
    entries[week] = {
      headline: record.zeitung.lead.headline,
      ...(record.zeitung.lead.dialekte
        ? {
            dialekte: Object.fromEntries(
              Object.entries(record.zeitung.lead.dialekte).map(([d, t]) => [d, t.headline]),
            ),
          }
        : {}),
      from: record.from,
      to: record.to,
      ...(record.testdaten ? { testdaten: true } : {}),
    };
    evaluated.push(week);
    await store.set("weekly/index", { weeks: [...new Set(known)].sort(compareWeeks), entries } satisfies WeeklyIndex);
  }
  return report(evaluated, empty);
}
