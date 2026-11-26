import { expect, test } from "vitest";
import { addHours, detectLogin, recordActivity } from "../../src/collect/activity";
import type { ActivityWeek, CharacterRecord } from "../../src/model";
import { createMemoryStore } from "../../src/store";

const rec = (lastLoginAt: string | null): CharacterRecord => ({ id: 7, lastLoginAt }) as CharacterRecord;

test("detectLogin: nur ein neuerer Zeitpunkt gegenüber einem Vorwert zählt", () => {
  expect(detectLogin(null, rec("2026-11-16T19:00:00.000Z"))).toBeNull();
  expect(detectLogin(rec(null), rec("2026-11-16T19:00:00.000Z"))).toBeNull();
  expect(detectLogin(rec("2026-11-16T19:00:00.000Z"), rec("2026-11-16T19:00:00.000Z"))).toBeNull();
  expect(detectLogin(rec("2026-11-16T19:00:00.000Z"), rec("2026-11-16T18:00:00.000Z"))).toBeNull();
  expect(detectLogin(rec("2026-11-16T19:00:00.000Z"), rec(null))).toBeNull();
  expect(detectLogin(rec("2026-11-16T19:00:00.000Z"), rec("2026-11-16T21:10:00.000Z"))).toEqual({
    characterId: 7, at: "2026-11-16T21:10:00.000Z", awayDays: 0,
  });
  expect(detectLogin(rec("2026-10-20T19:00:00.000Z"), rec("2026-11-16T21:10:00.000Z"))?.awayDays).toBe(27);
});

test("addHours hält die Stunden sortiert und ohne Doppelte", () => {
  const week: ActivityWeek = { week: "2026-W47", characters: { "7": [20] } };
  const res = addHours(week, [{ characterId: 7, hour: 3 }, { characterId: 7, hour: 20 }, { characterId: 8, hour: 5 }]);
  expect(res.added).toBe(2);
  expect(res.week.characters).toEqual({ "7": [3, 20], "8": [5] });
  expect(week.characters).toEqual({ "7": [20] });
});

test("recordActivity schreibt je Woche des Logins, nicht des Laufs", async () => {
  const store = createMemoryStore();
  const added = await recordActivity(store, [
    { characterId: 1, at: "2026-11-15T22:50:00.000Z", awayDays: 0 }, // Sonntag 23:50 Berlin
    { characterId: 1, at: "2026-11-16T19:10:00.000Z", awayDays: 0 }, // Montag 20:10 Berlin
    { characterId: 2, at: "2026-11-16T19:40:00.000Z", awayDays: 0 },
  ]);
  expect(added).toBe(3);
  expect(await store.get("activity/2026-W46")).toEqual({ week: "2026-W46", characters: { "1": [167] } });
  expect(await store.get("activity/2026-W47")).toEqual({ week: "2026-W47", characters: { "1": [20], "2": [20] } });
});

test("recordActivity schreibt nicht, wenn nichts Neues dabei ist", async () => {
  const store = createMemoryStore();
  await store.set("activity/2026-W47", { week: "2026-W47", characters: { "1": [20] }, testdaten: true });
  let writes = 0;
  const counting = { ...store, set: async (k: string, v: unknown) => { writes++; await store.set(k, v); } };
  expect(await recordActivity(counting, [{ characterId: 1, at: "2026-11-16T19:10:00.000Z", awayDays: 0 }])).toBe(0);
  expect(writes).toBe(0);
  expect(await recordActivity(counting, [{ characterId: 1, at: "2026-11-16T20:10:00.000Z", awayDays: 0 }])).toBe(1);
  expect(await store.get<ActivityWeek>("activity/2026-W47")).toEqual({
    week: "2026-W47", characters: { "1": [20, 21] }, testdaten: true,
  });
});

test("recordActivity hält Rückkehrer ab 7 Tagen Pause fest, je Charakter die längste Pause", async () => {
  const store = createMemoryStore();
  await recordActivity(store, [
    { characterId: 1, at: "2026-11-16T19:10:00.000Z", awayDays: 20 },
    { characterId: 2, at: "2026-11-16T19:40:00.000Z", awayDays: 6 },
  ]);
  await recordActivity(store, [{ characterId: 1, at: "2026-11-18T19:10:00.000Z", awayDays: 9 }]);
  await recordActivity(store, [{ characterId: 1, at: "2026-11-19T19:10:00.000Z", awayDays: 31 }]);
  const week = await store.get<ActivityWeek>("activity/2026-W47");
  expect(week?.returns).toEqual({ "1": 31 });
});
