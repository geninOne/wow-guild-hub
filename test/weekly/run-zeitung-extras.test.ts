// Wochenauswertung mit Woche in Zahlen, Wetter, Rekord und Rückblick; Aufbau wie in run.test.ts.
import { beforeEach, expect, onTestFinished, test, vi } from "vitest";
import type { DaySnapshot, GuildRecord, WeeklyRecord } from "../../src/model";
import { createMemoryStore } from "../../src/store";
import { bausteinGenerator } from "../../src/weekly/zeitung-text";
import { runWeeklyEvaluation } from "../../src/weekly/run";
import { member } from "../helpers/members";

const guild: GuildRecord = {
  fetchedAt: "2026-11-16T08:00:00.000Z", id: 1, name: "Bärenklaue", faction: "HORDE", memberCount: 2, rulesetName: "Normal",
  members: [
    member({ id: 1, name: "Anna", firstSeenAt: "2026-11-01T10:00:00.000Z" }),
    member({ id: 2, name: "Bodo", firstSeenAt: "2026-11-01T10:00:00.000Z" }),
  ],
};

const snap = (date: string, levels: Record<string, number>, deaths: Record<string, number> = {}): DaySnapshot => ({
  date,
  takenAt: `${date}T20:00:00.000Z`,
  characters: Object.fromEntries(
    Object.entries(levels).map(([id, level]) => [id, { level, equippedItemLevel: null, professions: {}, deaths: deaths[id] ?? 0 }]),
  ),
});

// Sonntag, 15.11.2026, 10 Uhr: die letzte abgeschlossene Bärenklaue-Woche ist 2026-11-14 (8. bis 14.11.).
const NOW = "2026-11-15T09:00:00.000Z";
let store: ReturnType<typeof createMemoryStore>;
// Ohne Serverstart gilt überall der Vergleich zweier Tagesstände; eigene Tests weiter unten setzen ihn.
const run = (iso = NOW, optOuts: (string | number)[] = [], serverStart: string | null = null) =>
  runWeeklyEvaluation({ store, now: () => new Date(iso), optOuts, generator: bausteinGenerator, serverStart });

beforeEach(async () => {
  store = createMemoryStore();
  await store.set("guild", guild);
  await store.set("history/2026-11-07", snap("2026-11-07", { "1": 20, "2": 30 }, { "1": 1, "2": 5 }));
  await store.set("history/2026-11-12", snap("2026-11-12", { "1": 22, "2": 30 }, { "1": 2, "2": 5 }));
  await store.set("history/2026-11-14", snap("2026-11-14", { "1": 25, "2": 30 }, { "1": 4, "2": 5 }));
  await store.set("history/2026-11-15", snap("2026-11-15", { "1": 40, "2": 30 }, { "1": 9, "2": 5 }));
  await store.set("activity/2026-W46", { week: "2026-W46", characters: { "1": [2, 26], "2": [20] } });
});

test("Ausgabe enthält Woche in Zahlen mit Vorwoche, Wetterbericht und ohne alte Ausgabe keinen Rückblick", async () => {
  vi.stubEnv("WEBSITE_LANGUAGES", "");
  onTestFinished(() => {
    vi.unstubAllEnvs();
  });
  await run();
  const record = await store.get<WeeklyRecord>("weekly/2026-11-14");
  // 5 Level und 3 Tode wie bei den Titeln, Anmeldungen aus der Aktivität.
  expect(record?.zahlen?.gesamt).toMatchObject({ anmeldungen: 3, level: 5, tode: 3 });
  expect(record?.zahlen?.spitze).toMatchObject({ level: [1, 5], tode: [1, 3] });
  expect(record?.zahlen?.vorwoche?.gesamt).toMatchObject({ level: 0, tode: 0 });
  expect(record?.zeitung.wetter).toBeTruthy();
  // Ohne WEBSITE_LANGUAGES: Englisch dazu, keine Dialekte
  expect((record?.zeitung.wetterDialekte as { en?: string } | undefined)?.en).toBeTruthy();
  expect(record?.zeitung.wetterDialekte?.schwaebisch).toBeUndefined();
  expect(record?.zeitung).not.toHaveProperty("rueckblick");
  // Die nächste Ausgabe meidet die Wetter-Bausteine der letzten.
  expect(record?.zeitung.bausteine?.some((b) => b.startsWith("wetter-"))).toBe(true);
});

test("mit genug früheren Ausgaben: Rekordmeldung und Rückblick auf vier Wochen vorher", async () => {
  const summen = { anmeldungen: 2, level: 1, tode: 1, dungeons: null, rezepte: null, erfolge: null, ruf: null, gegenstandsstufe: null };
  const frueher = (week: string, from: string) =>
    ({
      week, from, to: week, generatedAt: NOW, titles: [],
      zeitung: { lead: { kind: "sprung", headline: `Schlagzeile ${week}`, text: "Text.", characterIds: [2] }, articles: [], motto: "Spruch." },
      zahlen: { gesamt: summen, gilden: { "": summen }, spitze: { level: [2, 1], tode: [2, 1] } },
    }) satisfies WeeklyRecord;
  const wochen = [["2026-10-17", "2026-10-11"], ["2026-10-24", "2026-10-18"], ["2026-10-31", "2026-10-25"], ["2026-11-07", "2026-11-01"]];
  for (const [w, from] of wochen) await store.set(`weekly/${w}`, frueher(w, from));
  await store.set("weekly/index", { weeks: wochen.map(([w]) => w) });
  await run();
  const record = await store.get<WeeklyRecord>("weekly/2026-11-14");
  const all = [record!.zeitung.lead, ...record!.zeitung.articles];
  const rekord = all.find((a) => a.kind === "rekord");
  expect(rekord?.section).toBe("Rekorde");
  expect(rekord?.characterIds).toEqual([1]);
  expect(rekord?.text).toContain("Anna mit 5 Level (bisher 1)");
  expect(record?.zeitung.rueckblick).toEqual({ week: "2026-10-17", from: "2026-10-11", to: "2026-10-17", headline: "Schlagzeile 2026-10-17", characterIds: [2] });
  expect(record?.zahlen?.vorwoche?.gesamt).toEqual(summen);
});
