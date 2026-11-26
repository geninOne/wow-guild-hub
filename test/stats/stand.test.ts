import { expect, test } from "vitest";
import { nextStatsStand, saveStatsStand, type StatsStand } from "../../src/stats/stand";
import { createMemoryStore } from "../../src/store";

const SA = "2026-11-21";
const stand = (week: string, characters: StatsStand["characters"], extra: Partial<StatsStand> = {}): StatsStand => ({
  week, takenAt: `${week}T12:00:00.000Z`, characters, ...extra,
});

test("Neuer Stand übernimmt den letzten bekannten und überschreibt die frisch geholten Charaktere", () => {
  const latest = stand("2026-11-14", { "1": { "60": 3 }, "2": { "60": 1 } });
  const next = nextStatsStand({ week: SA, at: "2026-11-16T10:00:00.000Z", existing: null, latest, active: [1, 2, 3], updates: { "1": { "60": 5, "353": 2 } } });
  expect(next).toEqual({ week: SA, takenAt: "2026-11-16T10:00:00.000Z", characters: { "1": { "60": 5, "353": 2 }, "2": { "60": 1 } } });
});

test("Ehemalige fallen aus dem Stand, Charaktere ohne Werte fehlen", () => {
  const existing = stand(SA, { "1": { "60": 3 }, "2": { "60": 1 } });
  const next = nextStatsStand({ week: SA, at: "2026-11-17T10:00:00.000Z", existing, latest: null, active: [1], updates: {} });
  expect(next.characters).toEqual({ "1": { "60": 3 } });
});

test("saveStatsStand schreibt jede Stunde den Stand der laufenden Woche, der letzte Lauf vor Sonntag gilt", async () => {
  const store = createMemoryStore();
  await saveStatsStand(store, { at: "2026-11-21T20:00:00.000Z", active: [1], updates: { "1": { "60": 3 } } });
  await saveStatsStand(store, { at: "2026-11-21T22:30:00.000Z", active: [1], updates: { "1": { "60": 4 } } });
  // Sonntag 0:30 Berliner Zeit gehört zur nächsten Woche.
  await saveStatsStand(store, { at: "2026-11-21T23:30:00.000Z", active: [1], updates: { "1": { "60": 9 } } });
  expect((await store.get<StatsStand>("stats/2026-11-21"))?.characters).toEqual({ "1": { "60": 4 } });
  expect((await store.get<StatsStand>("stats/2026-11-28"))?.characters).toEqual({ "1": { "60": 9 } });
});

test("Nachholregel: Wochen ohne Lauf bekommen den letzten bekannten Stand als nachgeholt", async () => {
  const store = createMemoryStore();
  await store.set("stats/2026-11-07", stand("2026-11-07", { "1": { "60": 2 } }));
  const report = await saveStatsStand(store, { at: "2026-11-23T10:00:00.000Z", active: [1], updates: {} });
  expect(report).toEqual({ week: "2026-11-28", filled: ["2026-11-14", "2026-11-21"] });
  const filled = await store.get<StatsStand>("stats/2026-11-14");
  expect(filled).toEqual({ week: "2026-11-14", takenAt: "2026-11-07T12:00:00.000Z", characters: { "1": { "60": 2 } }, nachgeholt: true });
  expect((await store.get<StatsStand>("stats/2026-11-28"))?.characters).toEqual({ "1": { "60": 2 } });
});

test("Nachgeholt wird höchstens ein Jahr, ohne früheren Stand gar nicht", async () => {
  const store = createMemoryStore();
  const report = await saveStatsStand(store, { at: "2026-11-23T10:00:00.000Z", active: [1], updates: { "1": { "60": 1 } } });
  expect(report.filled).toEqual([]);
  expect(await store.list("stats/")).toEqual(["stats/2026-11-28"]);
});
