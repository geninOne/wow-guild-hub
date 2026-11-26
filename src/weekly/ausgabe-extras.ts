// Was eine Ausgabe neben den Wochenfakten braucht: Woche in Zahlen samt Vorwoche, Rekorde gegenüber allen früheren
// Wochen, Rückblick, Wetterlage und die Meldungen der Erweiterungen. Alles fest berechnet, die Texter dichten nur.
import { SERVER_ERWEITERUNGEN } from "../erweiterungen";
import type { ServerErweiterung } from "../erweiterungen/typen";
import { addDays } from "../lib/time";
import type { ZeitungRueckblick, GuildRecord, WeekMetrics, WeeklyIndex, WeeklyRecord, WochenZahlen } from "../model";
import type { JsonStore } from "../store";
import type { ZeitungFact } from "./zeitung-facts";
import { findeRekorde, rueckblick } from "./rekorde";
import { wetterLage, type WetterLage } from "./wetter";
import { wochenZahlen, zaehlende } from "./zahlen";

export interface AusgabeExtras {
  zahlen: WochenZahlen;
  /** Rekorde und Meldungen der Erweiterungen, soweit vorhanden. */
  zusatz: ZeitungFact[];
  wetter: WetterLage;
  rueckblick: ZeitungRueckblick | null;
}

/** Kennzahlen eines früheren Zeitraums, für Wochen, die noch ohne gespeicherte Zahlen sind; null ohne Daten. */
export type Kennzahlen = (from: string, to: string) => Promise<Map<number, WeekMetrics> | null>;

/**
 * Zahlen aller früheren Wochen (letzter Tag vor `from`): gespeichert oder, bei älteren Ausgaben, neu berechnet.
 * Parallel geladen, damit die Auswertung im Zeitlimit bleibt.
 */
export async function fruehereZahlen(
  store: JsonStore,
  guild: GuildRecord,
  from: string,
  kennzahlen: Kennzahlen,
  excluded: Set<number>,
): Promise<{ week: string; from: string; to: string; zahlen: Omit<WochenZahlen, "vorwoche"> }[]> {
  const index = (await store.get<WeeklyIndex>("weekly/index")) ?? { weeks: [] };
  const records = await Promise.all(index.weeks.map((w) => store.get<WeeklyRecord>(`weekly/${w}`)));
  const earlier = records.filter((r): r is WeeklyRecord => r !== null && r.to < from);
  const out = await Promise.all(
    earlier.map(async (r) => {
      if (r.zahlen) return { week: r.week, from: r.from, to: r.to, zahlen: r.zahlen };
      const metrics = await kennzahlen(r.from, r.to);
      return metrics ? { week: r.week, from: r.from, to: r.to, zahlen: wochenZahlen(metrics, guild, excluded) } : null;
    }),
  );
  return out.filter((x) => x !== null);
}

export async function ausgabeExtras(input: {
  store: JsonStore;
  guild: GuildRecord;
  from: string;
  to: string;
  metrics: Map<number, WeekMetrics>;
  excluded: Set<number>;
  /** Frühere Ausgaben, die jüngste zuerst (für den Rückblick). */
  previous: WeeklyRecord[];
  kennzahlen: Kennzahlen;
  /** Angemeldete Erweiterungen; Standard aus `src/erweiterungen/index.ts`. */
  erweiterungen?: readonly ServerErweiterung[];
}): Promise<AusgabeExtras> {
  const { store, guild, from, to, metrics, excluded } = input;
  const ids = new Set(zaehlende(guild.members, excluded).map((m) => m.id));
  const [frueher, ...ausErweiterungen] = await Promise.all([
    fruehereZahlen(store, guild, from, input.kennzahlen, excluded),
    ...(input.erweiterungen ?? SERVER_ERWEITERUNGEN).map((e) => e.wochenArtikel?.({ store, guild, from, to, ids }) ?? []),
  ]);
  const eigene = wochenZahlen(metrics, guild, excluded);
  const vor = frueher.find((w) => w.to === addDays(from, -1));
  const zahlen: WochenZahlen = { ...eigene, ...(vor ? { vorwoche: { gesamt: vor.zahlen.gesamt, gilden: vor.zahlen.gilden } } : {}) };

  const zusatz: ZeitungFact[] = [];
  const rekorde = findeRekorde(eigene, frueher.map((w) => w.zahlen));
  if (rekorde.length > 0) zusatz.push({ kind: "rekord", entries: rekorde });
  for (const fakten of ausErweiterungen) zusatz.push(...fakten);

  const todeJeGilde = Object.fromEntries(Object.entries(eigene.gilden).map(([slug, s]) => [slug, s.tode]));
  const wetter = wetterLage({
    summen: eigene.gesamt, metrics, members: zaehlende(guild.members, excluded), guild, todeJeGilde,
    frueher: frueher.map((w) => w.zahlen.gesamt),
  });
  return { zahlen, zusatz, wetter, rueckblick: rueckblick(to, input.previous) };
}
