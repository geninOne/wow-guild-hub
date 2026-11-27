import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, expect, test } from "vitest";
import {
  checkEnvironment, fillSampleData, generateActivity, generateDailySnapshots, localStore, removeSampleData, timeSpan,
} from "../../scripts/sample-data-lib.mjs";
import type { DaySnapshot } from "../../src/model";
import { member } from "../helpers/members";

test("checkEnvironment aborts in Netlify environments and for foreign addresses", () => {
  expect(() => checkEnvironment({}, "http://localhost:8888")).not.toThrow();
  expect(() => checkEnvironment({}, "http://127.0.0.1:8888")).not.toThrow();
  expect(() => checkEnvironment({ NETLIFY: "true" }, "http://localhost:8888")).toThrow(/NETLIFY/);
  expect(() => checkEnvironment({ CONTEXT: "production" }, "http://localhost:8888")).toThrow(/CONTEXT/);
  expect(() => checkEnvironment({ DEPLOY_ID: "x" }, "http://localhost:8888")).toThrow(/DEPLOY_ID/);
  expect(() => checkEnvironment({}, "https://guild-hub.netlify.app")).toThrow(/only triggered locally/);
  expect(() => checkEnvironment({}, "nonsense")).toThrow(/not a valid/);
});

test("timeSpan: five completed guild weeks and the current one, days from the Saturday before", () => {
  const z = timeSpan("2026-11-16T10:00:00.000Z");
  expect(z.weeks).toEqual(["2026-10-17", "2026-10-24", "2026-10-31", "2026-11-07", "2026-11-14", "2026-11-21"]);
  expect(z.days[0]).toBe("2026-10-10");
  // Logins from the Sunday of the first week, stored in the ISO weeks that touch these days.
  expect(z.loginsFrom).toBe("2026-10-11");
  expect(z.activityWeeks).toEqual(["2026-W41", "2026-W42", "2026-W43", "2026-W44", "2026-W45", "2026-W46", "2026-W47"]);
  expect(z.days[z.days.length - 1]).toBe("2026-11-16");
});

test("timeSpan with server start: no week that ends before it and no day before it", () => {
  const z = timeSpan("2026-11-16T10:00:00.000Z", "2026-11-05");
  expect(z.weeks).toEqual(["2026-11-07", "2026-11-14", "2026-11-21"]);
  expect(z.days[0]).toBe("2026-11-05");
  expect(z.loginsFrom).toBe("2026-11-05");
  expect(z.activityWeeks).toEqual(["2026-W45", "2026-W46", "2026-W47"]);
  expect(z.days[z.days.length - 1]).toBe("2026-11-16");
  // If the server start lies far back, it stays at the usual six weeks.
  expect(timeSpan("2026-11-16T10:00:00.000Z", "2026-01-01")).toEqual(timeSpan("2026-11-16T10:00:00.000Z"));
});

const members = Array.from({ length: 30 }, (_, i) =>
  member({ id: i + 1, level: 10 + i, hasProfile: true, professions: [{ id: 186, skill: 100 }] }),
);

test("generateActivity: deterministic, marked, nothing in the future, only active members", () => {
  const weeks = ["2026-W46", "2026-W47"];
  const now = "2026-11-17T10:30:00.000Z"; // Tuesday 11:30 Berlin
  const all = [...members, member({ id: 99, former: true })];
  const a = generateActivity(all, weeks, now);
  expect(generateActivity(all, weeks, now)).toEqual(a);
  expect(a.every((w: { testdaten: boolean }) => w.testdaten)).toBe(true);
  expect(Object.keys(a[0].characters).length).toBeGreaterThan(10);
  expect((a[0].characters as Record<string, number[]>)["99"]).toBeUndefined();
  const latest = Math.max(...Object.values(a[1].characters as Record<string, number[]>).flat());
  expect(latest).toBeLessThanOrEqual(24 + 11);
  // Returners only with activity in the week and a break of at least 14 days
  const many = generateActivity(members, ["2026-W40", "2026-W41", "2026-W42", "2026-W43", "2026-W44", "2026-W45"], now);
  const returners = many.flatMap((w: { characters: Record<string, number[]>; returns?: Record<string, number> }) =>
    Object.entries(w.returns ?? {}).map(([id, days]) => ({ active: id in w.characters, days })));
  expect(returners.length).toBeGreaterThan(0);
  expect(returners.every((x: { active: boolean; days: number }) => x.active && x.days >= 14)).toBe(true);
});

test("generateDailySnapshots: real snapshots stay, values never rise above the next real snapshot", () => {
  const days = ["2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"];
  const real: DaySnapshot = {
    date: "2026-11-06", takenAt: "x",
    characters: { "1": { level: 3, equippedItemLevel: null, professions: {} } },
  };
  const snapshots = generateDailySnapshots(members, days, new Map([["2026-11-06", real]]));
  expect([...snapshots.keys()]).toEqual(["2026-11-04", "2026-11-05", "2026-11-07"]);
  expect(snapshots.get("2026-11-05").characters["1"].level).toBeLessThanOrEqual(3);
  expect(snapshots.get("2026-11-07").characters["1"].level).toBe(10);
  for (const s of snapshots.values()) {
    expect(s.testdaten).toBe(true);
    expect(typeof s.characters["5"].deaths).toBe("number");
    expect(typeof s.characters["5"].achievements).toBe("number");
    expect(typeof s.characters["5"].reputation).toBe("number");
  }
  // Monotonic: level and counters never drop below 0 going back and never rise going forward
  const a = snapshots.get("2026-11-04").characters["20"];
  const b = snapshots.get("2026-11-07").characters["20"];
  expect(a.level).toBeLessThanOrEqual(b.level);
  expect(a.deaths).toBeLessThanOrEqual(b.deaths);
});

test("generateActivity with server start: no login and no long break before the server start", () => {
  const weeks = ["2026-W45", "2026-W46"];
  const now = "2026-11-17T10:30:00.000Z";
  const without = generateActivity(members, weeks, now);
  const withStart = generateActivity(members, weeks, now, "2026-11-05");
  // 5 Nov is the Thursday of W45: week hours from 3 * 24.
  const hours = Object.values(withStart[0].characters as Record<string, number[]>).flat();
  expect(hours.length).toBeGreaterThan(20);
  expect(Math.min(...hours)).toBeGreaterThanOrEqual(3 * 24);
  expect(Math.min(...Object.values(without[0].characters as Record<string, number[]>).flat())).toBeLessThan(3 * 24);
  // The week after stays the same except for the impossible returners.
  expect(withStart[1].characters).toEqual(without[1].characters);
  expect(withStart.every((w: { returns?: unknown }) => w.returns === undefined)).toBe(true);
});

test("generateDailySnapshots with server start: level 1 and counters 0 on the first day, then rising to the current state", () => {
  const days = Array.from({ length: 12 }, (_, i) => `2026-11-${String(5 + i).padStart(2, "0")}`);
  const real: DaySnapshot = {
    date: "2026-11-09", takenAt: "x",
    characters: { "1": { level: 9, equippedItemLevel: null, professions: {}, deaths: 2 }, "30": { level: 2, equippedItemLevel: null, professions: {} } },
  };
  const snapshots = generateDailySnapshots(members, days, new Map([["2026-11-09", real]]), {}, "2026-11-05");
  expect(snapshots.has("2026-11-09")).toBe(false);
  for (const m of members) {
    const id = String(m.id);
    expect(snapshots.get("2026-11-05").characters[id]).toMatchObject({
      level: 1, professions: {}, deaths: 0, dungeons: 0, recipes: 0, achievements: 0, reputation: 0,
    });
    expect(snapshots.get("2026-11-16").characters[id]).toMatchObject({ level: m.level, professions: { "186": 100 } });
    let previous = snapshots.get("2026-11-05").characters[id];
    for (const day of days.slice(1)) {
      const current = (snapshots.get(day) ?? real).characters[id];
      if (!current) continue;
      expect(current.level).toBeGreaterThanOrEqual(previous.level);
      if (typeof current.deaths === "number") expect(current.deaths).toBeGreaterThanOrEqual(previous.deaths ?? 0);
      previous = { ...previous, ...current };
    }
  }
  // Not everyone rises in lockstep.
  const middle = members.map((m) => snapshots.get("2026-11-10").characters[String(m.id)].level / m.level);
  expect(Math.max(...middle) - Math.min(...middle)).toBeGreaterThan(0.15);
  // Real snapshots bound from above (before) and from below (after).
  expect(snapshots.get("2026-11-08").characters["30"].level).toBeLessThanOrEqual(2);
  expect(snapshots.get("2026-11-10").characters["1"].level).toBeGreaterThanOrEqual(9);
  expect(snapshots.get("2026-11-10").characters["1"].deaths).toBeGreaterThanOrEqual(2);
});

let folder: string;
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), "blobs-"));
  const store = join(folder, "entries", "unlinked", "site:gilde");
  await mkdir(join(store, "history"), { recursive: true });
  await writeFile(join(store, "guild"), JSON.stringify({ members }));
  await writeFile(join(store, "history", "2026-11-06"), JSON.stringify({ date: "2026-11-06", takenAt: "x", characters: {} }));
});

test("localStore reads and writes the file format of the local blob server", async () => {
  const s = await localStore(folder);
  await s.set("activity/2026-W47", { a: 1 });
  expect(await s.get("activity/2026-W47")).toEqual({ a: 1 });
  expect(await readFile(join(folder, "metadata", "unlinked", "site:gilde", "activity", "2026-W47"), "utf8")).toBe("{}");
  expect(await s.list("history/")).toEqual(["history/2026-11-06"]);
  await s.delete("activity/2026-W47");
  expect(await s.get("activity/2026-W47")).toBeNull();
  await expect(localStore(join(folder, "missing"))).rejects.toThrow(/No local blob store/);
});

test("fillSampleData and removeSampleData leave real data in place", async () => {
  const s = await localStore(folder);
  await s.set("activity/2026-W47", { week: "2026-W47", characters: { "1": [3] } });
  await s.set("weekly/2026-11-14", { week: "2026-11-14" });
  await s.set("weekly/2026-W40", { week: "2026-W40" });
  // Old ISO issues in the time span: generated ones are dropped, real ones stay.
  await s.set("weekly/2026-W44", { week: "2026-W44" });
  await s.set("weekly/2026-W45", { week: "2026-W45", testdaten: true });
  await s.set("weekly/index", { weeks: ["2026-W40", "2026-W44", "2026-W45", "2026-11-14"] });

  const res = await fillSampleData(s, "2026-11-16T10:00:00.000Z");
  expect(res.activity).toBe(6);
  // W41 only contains Sunday 11 Oct, the first day of the first guild week.
  const w41 = await s.get("activity/2026-W41");
  expect(Object.values(w41.characters).flat().every((h) => (h as number) >= 6 * 24)).toBe(true);
  expect(await s.get("activity/2026-W47")).toEqual({ week: "2026-W47", characters: { "1": [3] } });
  expect((await s.get("activity/2026-W46")).testdaten).toBe(true);
  expect(await s.get("history/2026-11-06")).toEqual({ date: "2026-11-06", takenAt: "x", characters: {} });
  expect((await s.get("history/2026-11-05")).testdaten).toBe(true);
  expect(await s.get("weekly/2026-11-14")).toBeNull();
  expect(await s.get("weekly/2026-W45")).toBeNull();
  expect(await s.get("weekly/2026-W44")).toEqual({ week: "2026-W44" });
  expect(await s.get("weekly/index")).toEqual({ weeks: ["2026-W40", "2026-W44"] });
  await s.delete("weekly/2026-W44");

  await s.set("weekly/2026-11-14", { week: "2026-11-14", testdaten: true });
  await s.set("weekly/index", { weeks: ["2026-W40", "2026-11-14"] });
  await removeSampleData(s);
  expect(await s.list("activity/")).toEqual(["activity/2026-W47"]);
  expect(await s.list("history/")).toEqual(["history/2026-11-06"]);
  expect(await s.get("weekly/index")).toEqual({ weeks: ["2026-W40"] });
  expect(await s.get("weekly/2026-W40")).toEqual({ week: "2026-W40" });
});

test("deleteWeeklyResults removes the result and archive entry, other weeks stay", async () => {
  const { deleteWeeklyResults } = await import("../../scripts/sample-data-lib.mjs");
  const s = await localStore(folder);
  await s.set("weekly/2026-W45", { week: "2026-W45" });
  await s.set("weekly/2026-W46", { week: "2026-W46" });
  await s.set("weekly/index", { weeks: ["2026-W45", "2026-W46"], entries: { "2026-W45": { headline: "A" }, "2026-W46": { headline: "B" } } });
  expect(await deleteWeeklyResults(s, ["2026-W46"])).toBe(1);
  expect(await s.get("weekly/2026-W46")).toBeNull();
  expect(await s.get("weekly/2026-W45")).toEqual({ week: "2026-W45" });
  expect(await s.get("weekly/index")).toEqual({ weeks: ["2026-W45"], entries: { "2026-W45": { headline: "A" } } });
});

test("fillSampleData with server start: nothing before it, old sample data from before it disappears, real data stays", async () => {
  const s = await localStore(folder);
  await s.set("history/2026-10-31", { date: "2026-10-31", takenAt: "x", characters: {}, testdaten: true });
  await s.set("history/2026-10-30", { date: "2026-10-30", takenAt: "x", characters: {} });
  await s.set("activity/2026-W43", { week: "2026-W43", characters: {}, testdaten: true });
  await s.set("activity/2026-W42", { week: "2026-W42", characters: { "1": [3] } });
  await s.set("weekly/2026-W43", { week: "2026-W43", testdaten: true });
  await s.set("weekly/2026-10-31", { week: "2026-10-31", testdaten: true });
  await s.set("weekly/2026-W42", { week: "2026-W42" });
  await s.set("weekly/index", { weeks: ["2026-W42", "2026-W43", "2026-10-31"] });

  const lines: string[] = [];
  const res = await fillSampleData(s, "2026-11-16T10:00:00.000Z", (line: string) => lines.push(line), "2026-11-05");
  expect(res.weeks).toEqual(["2026-11-07", "2026-11-14", "2026-11-21"]);
  expect(lines[0]).toMatch(/^Removed 4 sample data entries from before the server start/);
  expect(await s.get("weekly/2026-10-31")).toBeNull();
  expect(await s.list("activity/")).toEqual(["activity/2026-W42", "activity/2026-W45", "activity/2026-W46", "activity/2026-W47"]);
  const days = (await s.list("history/")).map((k: string) => k.slice("history/".length));
  expect(days[0]).toBe("2026-10-30");
  expect(days[1]).toBe("2026-11-05");
  expect(days).toHaveLength(13);
  expect((await s.get("history/2026-11-05")).characters["7"]).toMatchObject({ level: 1, deaths: 0 });
  expect(await s.get("history/2026-11-06")).toEqual({ date: "2026-11-06", takenAt: "x", characters: {} });
  expect(await s.get("weekly/index")).toEqual({ weeks: ["2026-W42"] });
  expect(await s.get("weekly/2026-W42")).toEqual({ week: "2026-W42" });
});

test("generateAttributes: resource by class, the same for the same ID, marked as sample data", async () => {
  const { generateAttributes } = await import("../../scripts/sample-data-lib.mjs");
  const warrior = generateAttributes({ id: 7, level: 30, classId: 1 }, "t");
  expect(warrior).toEqual(generateAttributes({ id: 7, level: 30, classId: 1 }, "t"));
  expect(warrior).toMatchObject({ fetchedAt: "t", powerType: { id: 1, name: "Wut" }, testdaten: true });
  expect(warrior.fields).not.toHaveProperty("mana_regen");
  expect(warrior.fields.strength.effective).toBeGreaterThan(warrior.fields.intellect.effective);
  const mage = generateAttributes({ id: 8, level: 30, classId: 8 }, "t");
  expect(mage.powerType).toEqual({ id: 0, name: "Mana" });
  expect(mage.fields.mana_regen).toBeGreaterThan(0);
  expect(generateAttributes({ id: 9, level: 30, classId: 4 }, "t").powerType.id).toBe(3);
  expect(generateAttributes({ id: 9, level: 30, classId: 6 }, "t").powerType.id).toBe(6);
});

test("fillSampleData creates missing attributes, real ones stay, removing deletes only made-up ones", async () => {
  const s = await localStore(folder);
  const guild = await s.get("guild");
  const [first, second] = guild.members.filter((m: { former: boolean; hasProfile: boolean }) => !m.former && m.hasProfile);
  await s.set(`attributes/${first.id}`, { fetchedAt: "real", fields: { health: 1 }, powerType: null });
  const res = await fillSampleData(s, "2026-11-16T10:00:00.000Z");
  expect(res.attributes).toBeGreaterThan(0);
  expect((await s.get(`attributes/${second.id}`)).testdaten).toBe(true);
  await removeSampleData(s);
  expect(await s.list("attributes/")).toEqual([`attributes/${first.id}`]);
});
