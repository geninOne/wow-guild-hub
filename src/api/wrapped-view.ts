import { addDays, berlinDate, dateOfWeekHour, isoWeeksBetween, monthOf, weekBounds } from "../lib/time";
import type { ActivityWeek, DaySnapshot, GuildRecord, MemberSummary, NamedList, WeeklyRecord } from "../model";
import type { JsonStore } from "../store";
import { withLateStarts } from "../lib/baseline";
import { serverStartSnapshot, sinceServerStart, startsWithin } from "../lib/serverstart";
import { SERVER_START } from "../serverstart";
import { gain } from "../weekly/metrics";
import { characterRef, characterTitles, weeklyIndex } from "./fun-common";
import { lookupName } from "./guild-view";
import type { CharacterTitle, WrappedView } from "./types";

/** Erster und letzter Kalendertag eines Monats. */
export function monthRange(month: string): { from: string; to: string } {
  const from = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { from, to: addDays(next, -1) };
}

/** ISO-Wochen (Aktivitätsblöcke), die den Monat berühren. */
export function weeksOfMonth(month: string): string[] {
  const { from, to } = monthRange(month);
  return isoWeeksBetween(from, to);
}

function professionPoints(snap: DaySnapshot | null, id: number): number | null {
  const c = snap?.characters[String(id)];
  return c ? Object.values(c.professions).reduce((s, v) => s + v, 0) : null;
}

export interface WrappedInput {
  guild: GuildRecord;
  member: MemberSummary;
  classes: NamedList | null;
  month: string;
  months: string[];
  running: boolean;
  /**
   * Vergleichsstand; für Nachzügler steht darin schon ihr erster Stand im Monat (siehe `withLateStarts`).
   * Im Monat des Serverstarts der gedachte Stand mit Level 1 und Zählern auf 0 (siehe `serverStartSnapshot`).
   */
  before: DaySnapshot | null;
  end: DaySnapshot | null;
  /** Nachzügler: Charakter-ID auf das Datum ihres ersten Stands im Monat. */
  since?: Record<string, string>;
  /** Serverstart, wenn er im Monat liegt: Dann wird für alle ab ihm gezählt. */
  serverStart?: string | null;
  /** Aktivitätswochen, die den Monat berühren. */
  activity: ActivityWeek[];
  /** Wochenergebnisse, deren letzter Tag im Monat liegt (Wertungswochen: ihr Samstag; alte ISO-Wochen: ihr Sonntag). */
  weekly: WeeklyRecord[];
}

export function buildWrappedView(input: WrappedInput): WrappedView {
  const { guild, member, before, end, month } = input;
  const id = member.id;
  const { from, to } = monthRange(month);
  const level = (s: DaySnapshot | null, x: number) => s?.characters[String(x)]?.level;

  const startLevel = level(before, id);
  const endLevel = level(end, id);
  const levels =
    startLevel !== undefined && endLevel !== undefined
      ? { gained: Math.max(0, endLevel - startLevel), start: startLevel, end: endLevel }
      : null;

  let rank: WrappedView["rank"] = null;
  if (levels) {
    const gains = guild.members
      .filter((m) => !m.former)
      .map((m) => gain(before, end, m.id, "level"))
      .filter((g): g is number => g !== null);
    rank = { place: 1 + gains.filter((g) => g > levels.gained).length, of: gains.length };
  }

  // Wer mit Level 1 auftaucht, hat nichts verpasst; sonst zählt die Bilanz erst ab dem Beitritt.
  const ownStart = input.since?.[String(id)] ?? null;
  const since = ownStart !== null && levels !== null && levels.start > 1 ? ownStart : null;

  const ilvlA = before?.characters[String(id)]?.equippedItemLevel;
  const ilvlB = end?.characters[String(id)]?.equippedItemLevel;
  const profA = professionPoints(before, id);
  const profB = professionPoints(end, id);

  const hours: number[] = [];
  const days = new Set<string>();
  const weekdays = new Array<number>(7).fill(0);
  const ofDay = new Array<number>(24).fill(0);
  for (const week of input.activity) {
    for (const h of week.characters[String(id)] ?? []) {
      const date = dateOfWeekHour(week.week, h);
      if (date < from || date > to) continue;
      hours.push(h);
      days.add(date);
      weekdays[Math.floor(h / 24)]++;
      ofDay[h % 24]++;
    }
  }
  const favorite = (counts: number[]) => {
    const max = Math.max(...counts);
    return max > 0 ? counts.indexOf(max) : null;
  };

  const titles: CharacterTitle[] = input.weekly.flatMap((w) => characterTitles(w, id));

  return {
    character: {
      ...characterRef(guild, member),
      level: member.level,
      className: lookupName(input.classes, member.classId, `Klasse ${member.classId}`),
    },
    month,
    months: input.months,
    running: input.running,
    from: ownStart ?? before?.date ?? null,
    to: end?.date ?? null,
    since,
    serverStart: input.serverStart ?? null,
    levels,
    rank,
    itemLevel: typeof ilvlA === "number" && typeof ilvlB === "number" ? ilvlB - ilvlA : null,
    professionPoints: profA !== null && profB !== null ? Math.max(0, profB - profA) : null,
    dungeons: gain(before, end, id, "dungeons"),
    recipes: gain(before, end, id, "recipes"),
    deaths: gain(before, end, id, "deaths"),
    logins: hours.length,
    activeDays: days.size,
    favoriteHour: favorite(ofDay),
    favoriteWeekday: favorite(weekdays),
    titles,
    testdaten: Boolean(
      before?.testdaten || end?.testdaten || input.activity.some((a) => a.testdaten) || input.weekly.some((w) => w.testdaten),
    ),
  };
}

/** Lädt alles für die Monatsbilanz. `month` null heißt laufender Monat. */
export async function loadWrappedView(
  store: JsonStore,
  guild: GuildRecord,
  member: MemberSummary,
  month: string | null,
  nowIso: string,
  serverStart: string | null = SERVER_START,
): Promise<WrappedView> {
  const today = berlinDate(nowIso);
  const current = monthOf(today);
  const wanted = month ?? current;
  const { from, to } = monthRange(wanted);

  // Tagesstände vor dem Serverstart taugen nie als Vergleich und begründen auch keinen Monat in der Auswahl.
  const dates = sinceServerStart((await store.list("history/")).map((k) => k.slice("history/".length)), serverStart).sort();
  const months = [...new Set([...dates.map(monthOf), current])].sort().reverse();
  const inside = dates.filter((d) => d >= from && d <= to);
  const earlier = dates.filter((d) => d < from);
  const startMonth = startsWithin(serverStart, from, to);
  const beforeDate = startMonth ? null : (earlier[earlier.length - 1] ?? inside[0] ?? null);
  const endDate = inside[inside.length - 1] ?? null;

  const weeks = weeksOfMonth(wanted);
  const index = await weeklyIndex(store);
  // Eine Woche gehört zum Monat ihres letzten Tages, eine Wertungswoche also zum Monat ihres Samstags.
  const titleWeeks = index.filter((w) => {
    const last = weekBounds(w).to;
    return last >= from && last <= to;
  });
  const [before, end, classes, activity, weekly] = await Promise.all([
    beforeDate ? store.get<DaySnapshot>(`history/${beforeDate}`) : null,
    endDate ? store.get<DaySnapshot>(`history/${endDate}`) : null,
    store.get<NamedList>("static/classes"),
    Promise.all(weeks.map((w) => store.get<ActivityWeek>(`activity/${w}`))),
    Promise.all(titleWeeks.map((w) => store.get<WeeklyRecord>(`weekly/${w}`))),
  ]);
  // Im Monat des Serverstarts beginnen alle bei Level 1; Nachzügler gibt es dann nicht.
  const start = startMonth
    ? { before: end ? serverStartSnapshot(serverStart, end) : null, since: {} }
    : await withLateStarts(store, inside, before, end, guild.members);
  return buildWrappedView({
    guild, member, classes, month: wanted, months, running: wanted === current,
    before: start.before, end, since: start.since, serverStart: startMonth ? serverStart : null,
    activity: activity.filter((a): a is ActivityWeek => a !== null),
    weekly: weekly.filter((w): w is WeeklyRecord => w !== null),
  });
}
