import type { DaySnapshot, LevelUpLog, MemberSummary } from "../model";
import type { JsonStore } from "../store";
import { berlinDate } from "./time";

export interface Baseline {
  /** Vergleichsstand, ergänzt um den ersten bekannten Stand der Nachzügler. */
  before: DaySnapshot | null;
  /** Nachzügler: Charakter-ID auf das Datum des Tagesstands, ab dem für ihn gezählt wird. */
  since: Record<string, string>;
}

function firstSeenDay(m: MemberSummary): string {
  const ms = Date.parse(m.firstSeenAt);
  return Number.isNaN(ms) ? "" : berlinDate(m.firstSeenAt);
}

/**
 * Ergänzt den Vergleichsstand um Charaktere, die darin fehlen, aber im Endstand stehen
 * (neu erstellt, beigetreten oder zurückgekehrt): Für sie gilt ihr frühester Tagesstand im Zeitraum.
 *
 * Geladen wird sparsam: gar nichts, wenn niemand fehlt; sonst je Nachzügler zuerst der Stand
 * seines ersten Tages (`firstSeenAt`), und nur wenn er dort fehlt, schrittweise der nächste.
 * Jeder Tagesstand wird höchstens einmal geladen. Dazu kommt einmal das Level-Protokoll,
 * weil der Tagesstand des ersten Tages erst den Abend zeigt: Aufstiege seit dem ersten
 * Auftauchen stehen dort und senken das Startlevel auf den Wert vor dem ersten Aufstieg.
 *
 * @param dates Alle Tagesstand-Daten, die es gibt (Reihenfolge egal).
 */
export async function withLateStarts(
  store: JsonStore,
  dates: string[],
  before: DaySnapshot | null,
  end: DaySnapshot | null,
  members: MemberSummary[],
): Promise<Baseline> {
  if (!before || !end || before.date >= end.date) return { before, since: {} };
  const late = members.filter((m) => !m.former && end.characters[String(m.id)] && !before.characters[String(m.id)]);
  if (late.length === 0) return { before, since: {} };

  const between = dates.filter((d) => d > before.date && d < end.date).sort();
  const loaded = new Map<string, Promise<DaySnapshot | null>>();
  const load = (date: string) => {
    if (!loaded.has(date)) loaded.set(date, store.get<DaySnapshot>(`history/${date}`));
    return loaded.get(date)!;
  };

  const characters = { ...before.characters };
  const since: Record<string, string> = {};
  let pending = late.map((m) => {
    const day = firstSeenDay(m);
    const index = between.findIndex((d) => d >= day);
    return { id: String(m.id), index: index === -1 ? between.length : index };
  });
  while (pending.length > 0) {
    const next: typeof pending = [];
    await Promise.all(
      pending.map(async (p) => {
        // Kein früherer Stand mehr: Der Endstand ist zugleich der Startwert.
        const snap = p.index < between.length ? await load(between[p.index]) : end;
        const entry = snap?.characters[p.id];
        if (snap && entry) {
          characters[p.id] = entry;
          since[p.id] = snap.date;
        } else {
          next.push({ id: p.id, index: p.index + 1 });
        }
      }),
    );
    pending = next;
  }

  const log = await store.get<LevelUpLog>("levelups");
  for (const e of log?.events ?? []) {
    const id = String(e.characterId);
    if (!(id in since)) continue;
    const day = berlinDate(e.at);
    if (day <= before.date || day > end.date) continue;
    if (e.level - 1 < characters[id].level) characters[id] = { ...characters[id], level: e.level - 1 };
  }
  return { before: { ...before, characters }, since };
}
