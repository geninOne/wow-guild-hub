import { withLateStarts } from "../lib/baseline";
import { serverStartSnapshot, sinceServerStart, startsWithin } from "../lib/server-start";
import { SERVER_START } from "../server-start";
import { addDays, berlinDate, compareWeeks, dateOfWeekHour, isoWeeksBetween, isWeek, shiftGuildWeek, guildRange, guildWeek, weekBounds, weekRange } from "../lib/time";
import type { ActivityWeek, DaySnapshot, GuildRecord, WeekMetrics, WeeklyIndex, WeeklyRecord } from "../model";
import type { JsonStore } from "../store";
import type { ServerErweiterung } from "../erweiterungen/typen";
import { ausgabeExtras } from "./ausgabe-extras";
import { RECENT_ISSUES } from "./bausteine";
import { collectFacts, factKey, type RecentFacts } from "./zeitung-facts";
import { DIALEKTE } from "../sprache";
import { uebersetzungIn, type Fremdsprache, type RecentIssue, type TextGenerator } from "./zeitung-text";
import { generatorFromEnv } from "./claude-text";
import { weekMetrics } from "./metrics";
import { isOptedOut, rankTitles, TITLE_OPT_OUTS } from "./titles";

export interface WeeklyDeps {
  store: JsonStore;
  now: () => Date;
  /** Abmeldeliste für Titel; Standard aus `TITLE_OPT_OUTS`. */
  optOuts?: (string | number)[];
  /** Texter für die Zeitung; Standard nach Umgebung (Claude API mit Schlüssel, sonst Satzbausteine). */
  generator?: TextGenerator;
  /** Wie viele abgeschlossene Wochen höchstens nachgeholt werden. */
  maxWeeks?: number;
  /** Tag des Serverstarts; Standard aus `config/serverstart.json`, null schaltet die Regel ab. */
  serverStart?: string | null;
  /** Erweiterungen mit eigenen Meldungen; Standard aus `src/erweiterungen/index.ts`. */
  erweiterungen?: readonly ServerErweiterung[];
}

export interface WeeklyRunReport {
  at: string;
  /** Neu ausgewertete Wochen. */
  evaluated: string[];
  /** Wochen ohne Daten, für die nichts geschrieben wurde. */
  empty: string[];
  durationMs: number;
}

/** Tagesstände für eine Woche: der letzte davor (ersatzweise der früheste in der Woche) und der letzte in der Woche. */
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
 * Aktivität eines Zeitraums (eine Wertungswoche oder ein Teil davon), zusammengesetzt aus den ISO-Wochen-Blöcken,
 * die ihn berühren. Die Stunden bleiben Wochenstunden mit Montag 0 Uhr = 0: Weil der Zeitraum jeden Wochentag
 * höchstens einmal enthält, gibt es keine Überschneidungen, und Wochentag und Uhrzeit lassen sich wie gewohnt ablesen.
 *
 * Eine Rückkehr (mindestens 7 Tage Pause) ist immer der erste Login ihres ISO-Blocks; sie zählt, wenn dieser im Zeitraum liegt.
 * null, wenn im Zeitraum niemand angemeldet war und es keinen Block gibt.
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
  let testdaten = false;
  for (const block of blocks) {
    if (!block) continue;
    found = true;
    testdaten ||= block.testdaten === true;
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
    ...(testdaten ? { testdaten: true } : {}),
  };
}

/** Was Fakten-Auswahl und Texter über eine frühere Ausgabe wissen müssen. */
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
        // Englisch und Dialekte; ältere Ausgaben ohne Übersetzung liefern dafür die hochdeutschen Texte.
        dialekte: Object.fromEntries(
          (["en", ...DIALEKTE] as Fremdsprache[]).map((d) => [
            d,
            {
              headlines: all.map((a) => uebersetzungIn(a.dialekte, d)?.headline ?? a.headline),
              texts: all.map((a) => uebersetzungIn(a.dialekte, d)?.text ?? a.text),
              motto: uebersetzungIn(r.zeitung.mottoDialekte, d) ?? r.zeitung.motto,
              ...(r.zeitung.wetter ? { wetter: uebersetzungIn(r.zeitung.wetterDialekte, d) ?? r.zeitung.wetter } : {}),
            },
          ]),
        ),
        ...(r.zeitung.wetter ? { wetter: r.zeitung.wetter } : {}),
      };
    }),
  };
}

/** Wertet eine Woche aus; null, wenn es weder Aktivität noch einen Tagesstand in der Woche gibt. */
export async function evaluateWeek(
  deps: WeeklyDeps,
  week: string,
  guild: GuildRecord,
  historyDates: string[],
  /** Frühere Ausgaben, die jüngste zuerst. */
  previous: WeeklyRecord[] = [],
  /** Gewerteter Zeitraum; Standard ist die ganze Woche. In der Übergangswoche beginnt er später. */
  range: { from: string; to: string } = weekBounds(week),
  /** Alle früheren Wochenergebnisse, die jüngste zuerst, für die Wahl des Titelträgers bei Gleichstand. */
  titleHistory: Pick<WeeklyRecord, "titles">[] = previous,
): Promise<WeeklyRecord | null> {
  const recent = recentOf(previous.slice(0, RECENT_ISSUES));
  const { from, to } = range;
  const basis = await weekBasis(deps, week, guild, historyDates, range);
  if (!basis) return null;
  const { activity, before, end, metrics } = basis;
  const optOuts = deps.optOuts ?? TITLE_OPT_OUTS;
  const { awards: titles, rankings } = rankTitles(metrics, guild.members, optOuts, { week, previous: titleHistory });
  // Abgemeldete tauchen in der Zeitung gar nicht auf, auch nicht in Überholungen oder als Neuzugang.
  const excluded = new Set(guild.members.filter((m) => isOptedOut(m, optOuts)).map((m) => m.id));
  const extras = await ausgabeExtras({
    store: deps.store, guild, from, to, metrics, excluded, previous, erweiterungen: deps.erweiterungen,
    kennzahlen: async (f, t) => (await weekBasis(deps, t, guild, historyDates, { from: f, to: t }))?.metrics ?? null,
  });
  const facts = collectFacts({ from, to, metrics, members: guild.members, before, end, activity, titles, excluded, recent: recent.facts, zusatz: extras.zusatz });
  const names = new Map(guild.members.map((m) => [m.id, m.name]));
  const result = await (deps.generator ?? generatorFromEnv())(facts, {
    week,
    name: (id) => names.get(id) ?? "Unbekannt",
    allNames: [...new Set(guild.members.map((m) => m.name))],
    recent: recent.issues,
    wetter: extras.wetter,
    gilden: guild.guilds?.map((g) => g.name) ?? [guild.name],
  });
  const zahl = facts.find((f) => f.kind === "zahl");
  const [lead, ...articles] = result.articles;
  const testdaten = Boolean(activity?.testdaten || before?.testdaten || end?.testdaten);
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
      ...(zahl?.kind === "zahl" ? { zahl: zahl.what } : {}),
      ...(result.wetter ? { wetter: result.wetter, ...(result.wetterDialekte ? { wetterDialekte: result.wetterDialekte } : {}) } : {}),
      ...(extras.rueckblick ? { rueckblick: extras.rueckblick } : {}),
    },
    ...(testdaten ? { testdaten: true } : {}),
    zahlen: extras.zahlen,
  };
}

/**
 * Aktivität, Tagesstände und Kennzahlen eines Zeitraums; null, wenn es weder Aktivität noch einen Tagesstand gibt.
 * Dient der Auswertung und dem Nachrechnen früherer Wochen für Vorwoche und Rekorde.
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
  // Tagesstände vor dem Serverstart taugen nie als Vergleich.
  const usable = sinceServerStart(historyDates, serverStart);
  const startWeek = startsWithin(serverStart, from, to);
  const dates = snapshotDates(usable, from, to);
  const hasActivity = activity !== null && Object.keys(activity.characters).length > 0;
  if (!hasActivity && dates.end === null) return null;

  const [first, end] = await Promise.all([
    dates.before && !startWeek ? store.get<DaySnapshot>(`history/${dates.before}`) : null,
    dates.end ? store.get<DaySnapshot>(`history/${dates.end}`) : null,
  ]);
  // In der Woche des Serverstarts beginnen alle bei Level 1 und Zählerstand 0.
  // Sonst gilt: Wer erst im Lauf der Woche dazukam, zählt ab seinem ersten Stand in der Woche.
  const before = startWeek
    ? end && serverStartSnapshot(serverStart, end)
    : (await withLateStarts(store, usable, first, end, guild.members)).before;
  const metrics = weekMetrics({ activity, before, end, members: guild.members });
  return { activity, before, end, metrics };
}

/**
 * Letzter Tag, den Ausgaben aus der Zeit vor der Umstellung (ISO-Wochen Montag bis Sonntag) schon gewertet haben; null ohne solche.
 * Die erste Wertungswoche danach beginnt am Tag darauf, damit kein Tag fehlt oder doppelt zählt.
 */
export function legacyEnd(weeks: string[]): string | null {
  const ends = weeks.filter(isWeek).map((w) => weekRange(w).to).sort();
  return ends[ends.length - 1] ?? null;
}

/**
 * Wertet alle abgeschlossenen Wertungswochen (Sonntag bis Samstag) aus, für die noch kein Ergebnis vorliegt
 * (Titel und Zeitung). Eine Woche ist ab Sonntag 0 Uhr Berliner Zeit abgeschlossen.
 * Idempotent: Ein zweiter Lauf schreibt nichts. Wochen ohne Daten bleiben offen und werden später erneut geprüft.
 * Ausgaben alter ISO-Wochen bleiben unverändert; Wertungswochen bis zu deren Ende entstehen nicht mehr.
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
  // Der Reihe nach, älteste zuerst: Jede Ausgabe kennt die vorherigen und meidet deren Formulierungen.
  // Jede Woche wird sofort gespeichert; bricht ein Lauf ab, macht der nächste dort weiter.
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
    // Alle früheren Wochen, die jüngste zuerst: für die Titel die ganze Historie, für die Zeitung nur die letzten Ausgaben.
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
