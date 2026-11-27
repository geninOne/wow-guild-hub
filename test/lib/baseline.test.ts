import { expect, test } from "vitest";
import { withLateStarts } from "../../src/lib/baseline";
import type { DaySnapshot } from "../../src/model";
import { createMemoryStore } from "../../src/store";
import { member } from "../helpers/members";

const snap = (date: string, levels: Record<string, number>): DaySnapshot => ({
  date, takenAt: `${date}T20:00:00.000Z`,
  characters: Object.fromEntries(Object.entries(levels).map(([id, level]) => [id, { level, equippedItemLevel: null, professions: {} }])),
});

/** Store with day snapshots from 31 Oct to 20 Nov that records which keys are read. */
async function setup(snapshots: Record<string, Record<string, number>>) {
  const store = createMemoryStore();
  for (const [date, levels] of Object.entries(snapshots)) await store.set(`history/${date}`, snap(date, levels));
  const reads: string[] = [];
  const counting = { ...store, get: <T>(key: string) => (reads.push(key), store.get<T>(key)) };
  return { store, counting, reads, dates: Object.keys(snapshots) };
}

test("withLateStarts loads nothing when nobody is missing from the comparison snapshot", async () => {
  const { counting, reads, dates } = await setup({ "2026-10-31": { "1": 5 }, "2026-11-10": { "1": 6 }, "2026-11-20": { "1": 9 } });
  const before = snap("2026-10-31", { "1": 5 });
  const result = await withLateStarts(counting, dates, before, snap("2026-11-20", { "1": 9 }), [member({ id: 1 })]);
  expect(result).toEqual({ before, since: {} });
  expect(reads).toEqual([]);
});

test("withLateStarts: late starters get their first snapshot, only the day of first appearance is loaded", async () => {
  const snapshots: Record<string, Record<string, number>> = { "2026-10-31": { "1": 5 } };
  for (let d = 1; d <= 20; d++) {
    const date = `2026-11-${String(d).padStart(2, "0")}`;
    snapshots[date] = { "1": 5, ...(d >= 12 ? { "2": d, "3": 30 } : {}), ...(d >= 15 ? { "4": 2 } : {}) };
  }
  const { counting, reads, dates } = await setup(snapshots);
  const members = [
    member({ id: 1 }),
    member({ id: 2, firstSeenAt: "2026-11-12T08:00:00.000Z" }),
    member({ id: 3, firstSeenAt: "2026-11-12T19:00:00.000Z" }),
    member({ id: 4, firstSeenAt: "2026-11-15T19:00:00.000Z" }),
    member({ id: 5, firstSeenAt: "2026-11-02T19:00:00.000Z", former: true }),
  ];
  const result = await withLateStarts(counting, dates, snap("2026-10-31", snapshots["2026-10-31"]), snap("2026-11-20", snapshots["2026-11-20"]), members);
  expect(result.since).toEqual({ "2": "2026-11-12", "3": "2026-11-12", "4": "2026-11-15" });
  expect(result.before?.date).toBe("2026-10-31");
  expect(result.before?.characters).toMatchObject({ "1": { level: 5 }, "2": { level: 12 }, "3": { level: 30 }, "4": { level: 2 } });
  expect(reads.sort()).toEqual(["history/2026-11-12", "history/2026-11-15", "levelups"]);
});

test("withLateStarts keeps searching step by step when the first day's snapshot lacks the character", async () => {
  const { counting, reads, dates } = await setup({
    "2026-10-31": { "1": 5 }, "2026-11-10": { "1": 5 }, "2026-11-11": { "1": 5 }, "2026-11-12": { "1": 5, "2": 7 },
    "2026-11-13": { "1": 5, "2": 8 }, "2026-11-20": { "1": 5, "2": 9, "3": 4 },
  });
  // 2: returner with an old firstSeenAt, reappears only on 12 Nov. 3: only in the end snapshot, unreadable date.
  const members = [member({ id: 1 }), member({ id: 2, firstSeenAt: "2026-09-01T08:00:00.000Z" }), member({ id: 3 })];
  const result = await withLateStarts(counting, dates, snap("2026-10-31", { "1": 5 }), snap("2026-11-20", { "1": 5, "2": 9, "3": 4 }), members);
  expect(result.since).toEqual({ "2": "2026-11-12", "3": "2026-11-20" });
  expect(result.before?.characters).toMatchObject({ "2": { level: 7 }, "3": { level: 4 } });
  expect(reads.filter((k) => k.startsWith("history/")).sort()).toEqual(["history/2026-11-10", "history/2026-11-11", "history/2026-11-12", "history/2026-11-13"]);
});

test("withLateStarts lowers the starting level to the value before the first level-up since appearing", async () => {
  const { store, dates } = await setup({ "2026-10-31": { "1": 5 }, "2026-11-10": { "1": 5, "2": 6 }, "2026-11-20": { "1": 5, "2": 9 } });
  await store.set("levelups", { events: [
    { characterId: 2, level: 4, at: "2026-11-10T11:00:00.000Z" },
    { characterId: 2, level: 5, at: "2026-11-10T12:00:00.000Z" },
    { characterId: 2, level: 2, at: "2026-10-01T12:00:00.000Z" }, // before the period
    { characterId: 1, level: 2, at: "2026-11-10T12:00:00.000Z" }, // not a late starter
  ] });
  const members = [member({ id: 1 }), member({ id: 2, firstSeenAt: "2026-11-10T08:00:00.000Z" })];
  const result = await withLateStarts(store, dates, snap("2026-10-31", { "1": 5 }), snap("2026-11-20", { "1": 5, "2": 9 }), members);
  expect(result.before?.characters).toMatchObject({ "1": { level: 5 }, "2": { level: 3 } });
});

test("withLateStarts without snapshots or with only one snapshot", async () => {
  const { counting, reads } = await setup({});
  const only = snap("2026-11-10", { "1": 5 });
  expect(await withLateStarts(counting, [], null, null, [member({ id: 1 })])).toEqual({ before: null, since: {} });
  expect(await withLateStarts(counting, ["2026-11-10"], only, only, [member({ id: 1 }), member({ id: 2 })])).toEqual({ before: only, since: {} });
  expect(reads).toEqual([]);
});
