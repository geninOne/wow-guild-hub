import { expect, test } from "vitest";
import { nextStatsSnapshot, saveStatsSnapshot, type StatsSnapshot } from "../../src/stats/snapshot";
import { createMemoryStore } from "../../src/store";

const SATURDAY = "2026-11-21";
const snapshot = (week: string, characters: StatsSnapshot["characters"], extra: Partial<StatsSnapshot> = {}): StatsSnapshot => ({
  week, takenAt: `${week}T12:00:00.000Z`, characters, ...extra,
});

test("new snapshot takes over the last known one and overwrites freshly fetched characters", () => {
  const latest = snapshot("2026-11-14", { "1": { "60": 3 }, "2": { "60": 1 } });
  const next = nextStatsSnapshot({ week: SATURDAY, at: "2026-11-16T10:00:00.000Z", existing: null, latest, active: [1, 2, 3], updates: { "1": { "60": 5, "353": 2 } } });
  expect(next).toEqual({ week: SATURDAY, takenAt: "2026-11-16T10:00:00.000Z", characters: { "1": { "60": 5, "353": 2 }, "2": { "60": 1 } } });
});

test("former members drop out of the snapshot, characters without values are missing", () => {
  const existing = snapshot(SATURDAY, { "1": { "60": 3 }, "2": { "60": 1 } });
  const next = nextStatsSnapshot({ week: SATURDAY, at: "2026-11-17T10:00:00.000Z", existing, latest: null, active: [1], updates: {} });
  expect(next.characters).toEqual({ "1": { "60": 3 } });
});

test("saveStatsSnapshot rewrites the current week's snapshot every hour, the last run before Sunday counts", async () => {
  const store = createMemoryStore();
  await saveStatsSnapshot(store, { at: "2026-11-21T20:00:00.000Z", active: [1], updates: { "1": { "60": 3 } } });
  await saveStatsSnapshot(store, { at: "2026-11-21T22:30:00.000Z", active: [1], updates: { "1": { "60": 4 } } });
  // Sunday 0:30 Berlin time belongs to the next week.
  await saveStatsSnapshot(store, { at: "2026-11-21T23:30:00.000Z", active: [1], updates: { "1": { "60": 9 } } });
  expect((await store.get<StatsSnapshot>("stats/2026-11-21"))?.characters).toEqual({ "1": { "60": 4 } });
  expect((await store.get<StatsSnapshot>("stats/2026-11-28"))?.characters).toEqual({ "1": { "60": 9 } });
});

test("backfill rule: weeks without a run get the last known snapshot marked as backfilled", async () => {
  const store = createMemoryStore();
  await store.set("stats/2026-11-07", snapshot("2026-11-07", { "1": { "60": 2 } }));
  const report = await saveStatsSnapshot(store, { at: "2026-11-23T10:00:00.000Z", active: [1], updates: {} });
  expect(report).toEqual({ week: "2026-11-28", filled: ["2026-11-14", "2026-11-21"] });
  const filled = await store.get<StatsSnapshot>("stats/2026-11-14");
  expect(filled).toEqual({ week: "2026-11-14", takenAt: "2026-11-07T12:00:00.000Z", characters: { "1": { "60": 2 } }, nachgeholt: true });
  expect((await store.get<StatsSnapshot>("stats/2026-11-28"))?.characters).toEqual({ "1": { "60": 2 } });
});

test("backfill covers at most one year, and nothing without an earlier snapshot", async () => {
  const store = createMemoryStore();
  const report = await saveStatsSnapshot(store, { at: "2026-11-23T10:00:00.000Z", active: [1], updates: { "1": { "60": 1 } } });
  expect(report.filled).toEqual([]);
  expect(await store.list("stats/")).toEqual(["stats/2026-11-28"]);
});
