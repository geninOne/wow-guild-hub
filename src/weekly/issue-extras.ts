// What an issue needs besides the weekly facts: week in numbers including the previous week, records against all
// earlier weeks, lookback, weather situation and the extensions' articles. All computed deterministically, the
// writers only come up with the words.
import { serverExtensions, type AnyServerExtension } from "../extensions/legacy";
import { REGISTERED_SERVER_EXTENSIONS } from "../extensions/registry";
import { addDays } from "../lib/time";
import type { NewspaperLookback, GuildRecord, WeekMetrics, WeeklyIndex, WeeklyRecord, WeeklyNumbers } from "../model";
import type { JsonStore } from "../store";
import type { NewspaperFact } from "./newspaper-facts";
import { findRecords, buildLookback } from "./records";
import { weatherSituation, type WeatherSituation } from "./weather";
import { buildWeeklyNumbers, countedMembers } from "./numbers";

export interface IssueExtras {
  numbers: WeeklyNumbers;
  /** Records and the extensions' articles, if any. */
  extraFacts: NewspaperFact[];
  weather: WeatherSituation;
  lookback: NewspaperLookback | null;
}

/** Key figures of an earlier period, for weeks still without stored numbers; null without data. */
export type KeyFigures = (from: string, to: string) => Promise<Map<number, WeekMetrics> | null>;

/**
 * Numbers of all earlier weeks (last day before `from`): stored or, for older issues, computed anew.
 * Loaded in parallel so the evaluation stays within the time limit.
 */
export async function earlierFigures(
  store: JsonStore,
  guild: GuildRecord,
  from: string,
  keyFigures: KeyFigures,
  excluded: Set<number>,
): Promise<{ week: string; from: string; to: string; numbers: Omit<WeeklyNumbers, "vorwoche"> }[]> {
  const index = (await store.get<WeeklyIndex>("weekly/index")) ?? { weeks: [] };
  const records = await Promise.all(index.weeks.map((w) => store.get<WeeklyRecord>(`weekly/${w}`)));
  const earlier = records.filter((r): r is WeeklyRecord => r !== null && r.to < from);
  const out = await Promise.all(
    earlier.map(async (r) => {
      if (r.zahlen) return { week: r.week, from: r.from, to: r.to, numbers: r.zahlen };
      const metrics = await keyFigures(r.from, r.to);
      return metrics ? { week: r.week, from: r.from, to: r.to, numbers: buildWeeklyNumbers(metrics, guild, excluded) } : null;
    }),
  );
  return out.filter((x) => x !== null);
}

/** The extensions a caller passed (in either shape), else the registered ones. */
function extensionsOf(input: { extensions?: readonly AnyServerExtension[]; erweiterungen?: readonly AnyServerExtension[] }) {
  const given = input.extensions ?? input.erweiterungen;
  return given ? serverExtensions(given) : REGISTERED_SERVER_EXTENSIONS;
}

export async function issueExtras(input: {
  store: JsonStore;
  guild: GuildRecord;
  from: string;
  to: string;
  metrics: Map<number, WeekMetrics>;
  excluded: Set<number>;
  /** Earlier issues, the most recent first (for the lookback). */
  previous: WeeklyRecord[];
  keyFigures: KeyFigures;
  /** Extensions to use instead of the registered ones (tests); 2.x modules are converted. */
  extensions?: readonly AnyServerExtension[];
  /** @deprecated 2.x name of `extensions`. */
  erweiterungen?: readonly AnyServerExtension[];
}): Promise<IssueExtras> {
  const { store, guild, from, to, metrics, excluded } = input;
  const ids = new Set(countedMembers(guild.members, excluded).map((m) => m.id));
  const [earlier, ...fromExtensions] = await Promise.all([
    earlierFigures(store, guild, from, input.keyFigures, excluded),
    ...extensionsOf(input).map((e) => e.weeklyArticles?.({ store, guild, from, to, ids }) ?? []),
  ]);
  const own = buildWeeklyNumbers(metrics, guild, excluded);
  const prev = earlier.find((w) => w.to === addDays(from, -1));
  const numbers: WeeklyNumbers = { ...own, ...(prev ? { vorwoche: { gesamt: prev.numbers.gesamt, gilden: prev.numbers.gilden } } : {}) };

  const extraFacts: NewspaperFact[] = [];
  const records = findRecords(own, earlier.map((w) => w.numbers));
  if (records.length > 0) extraFacts.push({ kind: "rekord", entries: records });
  for (const facts of fromExtensions) extraFacts.push(...facts);

  const deathsByGuild = Object.fromEntries(Object.entries(own.gilden).map(([slug, s]) => [slug, s.tode]));
  const weather = weatherSituation({
    weeklySums: own.gesamt, metrics, members: countedMembers(guild.members, excluded), guild, deathsByGuild,
    earlier: earlier.map((w) => w.numbers.gesamt),
  });
  return { numbers, extraFacts, weather, lookback: buildLookback(to, input.previous) };
}
