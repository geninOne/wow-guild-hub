import { beforeEach, describe, expect, onTestFinished, test, vi } from "vitest";
import type { DaySnapshot, GuildRecord, WeeklyIndex, WeeklyRecord } from "../../src/model";
import { createMemoryStore } from "../../src/store";
import { phraseGenerator } from "../../src/weekly/newspaper-text";
import { runWeeklyEvaluation, snapshotDates, weekActivity } from "../../src/weekly/run";
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

// Sunday, 2026-11-15, 10:00: the last completed guild week is 2026-11-14 (Nov 8 to 14).
const NOW = "2026-11-15T09:00:00.000Z";
let store: ReturnType<typeof createMemoryStore>;
// Without a server start, comparing two daily snapshots applies everywhere; dedicated tests further down set it.
const run = (iso = NOW, optOuts: (string | number)[] = [], serverStart: string | null = null) =>
  runWeeklyEvaluation({ store, now: () => new Date(iso), optOuts, generator: phraseGenerator, serverStart });

beforeEach(async () => {
  store = createMemoryStore();
  await store.set("guild", guild);
  await store.set("history/2026-11-07", snap("2026-11-07", { "1": 20, "2": 30 }, { "1": 1, "2": 5 }));
  await store.set("history/2026-11-12", snap("2026-11-12", { "1": 22, "2": 30 }, { "1": 2, "2": 5 }));
  await store.set("history/2026-11-14", snap("2026-11-14", { "1": 25, "2": 30 }, { "1": 4, "2": 5 }));
  await store.set("history/2026-11-15", snap("2026-11-15", { "1": 40, "2": 30 }, { "1": 9, "2": 5 }));
  await store.set("activity/2026-W46", { week: "2026-W46", characters: { "1": [2, 26], "2": [20] } });
});

test("snapshotDates: last snapshot before the week, else the earliest in the week", () => {
  const dates = ["2026-11-12", "2026-11-08", "2026-11-15", "2026-11-16"];
  expect(snapshotDates(dates, "2026-11-09", "2026-11-15")).toEqual({ before: "2026-11-08", end: "2026-11-15" });
  expect(snapshotDates(["2026-11-12", "2026-11-15"], "2026-11-09", "2026-11-15")).toEqual({ before: "2026-11-12", end: "2026-11-15" });
  expect(snapshotDates(["2026-11-20"], "2026-11-09", "2026-11-15")).toEqual({ before: null, end: null });
});

test("evaluates the last completed week and writes result and index", async () => {
  // Installation with dialects, as for the guilds this site was built for
  vi.stubEnv("WEBSITE_LANGUAGES", "de,schwaebisch,bayrisch,en");
  onTestFinished(() => {
    vi.unstubAllEnvs();
  });
  const report = await run();
  // 2026-11-07 only has the Saturday snapshot: it is evaluated but yields a quiet week.
  expect(report.evaluated).toEqual(["2026-11-07", "2026-11-14"]);
  expect(report.empty).toHaveLength(6);
  expect((await store.get<WeeklyRecord>("weekly/2026-11-07"))?.zeitung.lead.kind).toBe("ruhig");
  const record = await store.get<WeeklyRecord>("weekly/2026-11-14");
  expect(record).toMatchObject({ week: "2026-11-14", from: "2026-11-08", to: "2026-11-14", generatedAt: NOW });
  expect(record).not.toHaveProperty("testdaten");
  // The snapshot of Sunday Nov 15 already belongs to the next week: 5 levels and 3 deaths, not 20 and 8.
  // Two night logins and two active days are below the minimum values.
  expect(record?.titles).toEqual([
    { titleId: "dauerlaeufer", characterId: 1, value: 5 },
    { titleId: "pechvogel", characterId: 1, value: 3 },
  ]);
  expect(record?.zeitung).toMatchObject({ generator: "bausteine", lead: { kind: "sprung", section: "Aufsteiger", characterIds: [1] } });
  expect(record?.zeitung.lead.text).toContain("Dauerläufer");
  expect(record?.zeitung.articles.map((a) => [a.kind, a.section])).toEqual([["titel", "Friedhof"]]);
  expect(record?.zeitung.motto.length).toBeGreaterThan(3);
  expect(await store.get<WeeklyIndex>("weekly/index")).toEqual({
    weeks: ["2026-11-07", "2026-11-14"],
    entries: {
      "2026-11-07": {
        headline: expect.any(String),
        dialekte: { en: expect.any(String), schwaebisch: expect.any(String), bayrisch: expect.any(String) },
        from: "2026-11-01",
        to: "2026-11-07",
      },
      "2026-11-14": {
        headline: record?.zeitung.lead.headline,
        dialekte: {
          en: (record?.zeitung.lead.dialekte as { en?: { headline: string } } | undefined)?.en?.headline,
          schwaebisch: record?.zeitung.lead.dialekte?.schwaebisch?.headline,
          bayrisch: record?.zeitung.lead.dialekte?.bayrisch?.headline,
        },
        from: "2026-11-08",
        to: "2026-11-14",
      },
    },
  });
  // The issue exists in all languages: Standard German on top, English and dialects next to it, the motto too
  expect(record?.zeitung.lead.dialekte?.bayrisch?.headline).not.toBe(record?.zeitung.lead.headline);
  expect(record?.zeitung.mottoDialekte?.schwaebisch?.length).toBeGreaterThan(3);
  expect((record?.zeitung.mottoDialekte as { en?: string } | undefined)?.en?.length).toBeGreaterThan(3);
  expect(await store.get("weekly/2026-11-21")).toBeNull();
});

test("second run writes nothing, even at a later time", async () => {
  await run();
  const before = store.dump();
  const report = await run("2026-11-16T08:00:00.000Z");
  expect(report.evaluated).toEqual([]);
  expect(store.dump()).toEqual(before);
});

test("in the following week the next issue is added, missed weeks are caught up", async () => {
  await store.set("activity/2026-W47", { week: "2026-W47", characters: { "2": [30] } });
  await store.set("activity/2026-W48", { week: "2026-W48", characters: { "2": [31] }, testdaten: true });
  const report = await run("2026-11-29T09:00:00.000Z");
  expect(report.evaluated).toEqual(["2026-11-07", "2026-11-14", "2026-11-21", "2026-11-28"]);
  const index = await store.get<WeeklyIndex>("weekly/index");
  expect(index?.weeks).toEqual(["2026-11-07", "2026-11-14", "2026-11-21", "2026-11-28"]);
  expect(index?.entries?.["2026-11-28"]).toMatchObject({ testdaten: true });
  expect((await store.get<WeeklyRecord>("weekly/2026-11-28"))?.testdaten).toBe(true);
  expect((await store.get<WeeklyRecord>("weekly/2026-11-21"))?.titles).toContainEqual({ titleId: "dauerlaeufer", characterId: 1, value: 15 });
});

test("opt-out list affects titles and thus the newspaper", async () => {
  await run(NOW, ["anna"]);
  const record = await store.get<WeeklyRecord>("weekly/2026-11-14");
  expect(record?.titles).toEqual([]);
  expect(JSON.stringify(record?.zeitung)).not.toContain("Anna");
  expect(record?.zeitung.lead.characterIds).not.toContain(1);
});

test("without guild data or without data for the week nothing is written", async () => {
  const empty = createMemoryStore();
  const report = await runWeeklyEvaluation({ store: empty, now: () => new Date(NOW) });
  expect(report.evaluated).toEqual([]);
  expect(empty.dump()).toEqual({});

  const onlyGuild = createMemoryStore();
  await onlyGuild.set("guild", guild);
  const second = await runWeeklyEvaluation({ store: onlyGuild, now: () => new Date(NOW) });
  expect(second.evaluated).toEqual([]);
  expect(Object.keys(onlyGuild.dump())).toEqual(["guild"]);
});

test("custom writer replaces the phrases", async () => {
  await runWeeklyEvaluation({
    store,
    now: () => new Date(NOW),
    optOuts: [],
    serverStart: null,
    generator: async (facts) => ({
      articles: facts.map((f) => ({ kind: f.kind, headline: "Kopf", text: "Text", characterIds: [] })),
      motto: "Spruch",
      generator: "test",
      model: "testmodell",
      fallback: "nur ein Test",
    }),
  });
  expect((await store.get<WeeklyRecord>("weekly/2026-11-14"))?.zeitung).toMatchObject({
    lead: { kind: "sprung", headline: "Kopf", text: "Text", characterIds: [] },
    motto: "Spruch",
    generator: "test",
    model: "testmodell",
    fallback: "nur ein Test",
  });
});

test("issues are created in order and store phrases and number; the next one knows the previous ones", async () => {
  const seen: { week: string; recent: string[] }[] = [];
  await runWeeklyEvaluation({
    store,
    now: () => new Date("2026-11-29T09:00:00.000Z"),
    optOuts: [],
    serverStart: null,
    generator: async (facts, context) => {
      expect(context.gilden).toEqual(["Bärenklaue"]);
      seen.push({ week: context.week, recent: (context.recent ?? []).map((r) => r.week) });
      return phraseGenerator(facts, context);
    },
  });
  expect(seen.map((s) => s.week)).toEqual(["2026-11-07", "2026-11-14", "2026-11-21"]);
  expect(seen[2].recent).toEqual(["2026-11-14", "2026-11-07"]);
  const w46 = await store.get<WeeklyRecord>("weekly/2026-11-14");
  expect(w46?.zeitung.bausteine?.length).toBeGreaterThan(0);
  const w45 = await store.get<WeeklyRecord>("weekly/2026-11-07");
  const shared = (w46?.zeitung.bausteine ?? []).filter((id) => w45?.zeitung.bausteine?.includes(id));
  expect(shared).toEqual([]);
});

test("whoever joins mid-week counts from their first snapshot for the `dauerlaeufer` title and the newspaper", async () => {
  await store.set("guild", {
    ...guild,
    members: [...guild.members, member({ id: 3, name: "Cleo", firstSeenAt: "2026-11-12T09:00:00.000Z" })],
  });
  await store.set("history/2026-11-12", snap("2026-11-12", { "1": 22, "2": 30, "3": 4 }, { "1": 2, "2": 5 }));
  await store.set("history/2026-11-14", snap("2026-11-14", { "1": 25, "2": 30, "3": 12 }, { "1": 4, "2": 5, "3": 1 }));
  // Appeared on the first day at level 2 and rose to 4 by the evening.
  await store.set("levelups", { events: [
    { characterId: 3, level: 3, at: "2026-11-12T12:00:00.000Z" },
    { characterId: 3, level: 4, at: "2026-11-12T14:00:00.000Z" },
  ] });
  await run();
  const record = await store.get<WeeklyRecord>("weekly/2026-11-14");
  expect(record?.titles).toEqual([
    { titleId: "dauerlaeufer", characterId: 3, value: 10 },
    { titleId: "pechvogel", characterId: 1, value: 3 },
  ]);
  expect(record?.zeitung.lead).toMatchObject({ kind: "sprung", characterIds: [3] });
});

test("server start week: everyone counts from level 1 and counter 0, snapshots before it are left out", async () => {
  // Snapshot before the server start (such as old sample data): must never be the comparison.
  await store.set("history/2026-11-01", snap("2026-11-01", { "1": 15, "2": 29 }, { "1": 1, "2": 5 }));
  await store.set("history/2026-11-06", snap("2026-11-06", { "1": 12, "2": 10 }, { "1": 1, "2": 2 }));
  await run(NOW, [], "2026-11-05");
  // Week Nov 1 to 7: final snapshot of Saturday Nov 7 with Anna 20 and Bodo 30, deaths 1 and 5.
  expect((await store.get<WeeklyRecord>("weekly/2026-11-07"))?.titles).toEqual([
    { titleId: "dauerlaeufer", characterId: 2, value: 29 },
    { titleId: "pechvogel", characterId: 2, value: 5 },
  ]);
  expect((await store.get<WeeklyRecord>("weekly/2026-11-07"))?.zeitung.lead).toMatchObject({ kind: "sprung", characterIds: [2] });
  // The following week compares with the previous Saturday's snapshot as before.
  expect((await store.get<WeeklyRecord>("weekly/2026-11-14"))?.titles).toEqual([
    { titleId: "dauerlaeufer", characterId: 1, value: 5 },
    { titleId: "pechvogel", characterId: 1, value: 3 },
  ]);
});

test("regenerating the server start week: only it is created anew, later issues stay unchanged", async () => {
  await run();
  const old45 = await store.get<WeeklyRecord>("weekly/2026-11-07");
  const old46 = await store.get<WeeklyRecord>("weekly/2026-11-14");
  expect(old45?.titles).toEqual([]);
  // Like `npm run newspaper:regenerate -- 2026-11-07`: remove the week from the index, then evaluate it again.
  await store.set("weekly/index", { weeks: ["2026-11-14"], entries: { "2026-11-14": { headline: old46!.zeitung.lead.headline } } });
  const report = await run("2026-11-16T08:00:00.000Z", [], "2026-11-05");
  expect(report.evaluated).toEqual(["2026-11-07"]);
  expect((await store.get<WeeklyRecord>("weekly/2026-11-07"))?.titles).not.toEqual([]);
  expect(await store.get<WeeklyRecord>("weekly/2026-11-14")).toEqual(old46);
  expect((await store.get<WeeklyIndex>("weekly/index"))?.weeks).toEqual(["2026-11-07", "2026-11-14"]);
});

test("on Saturday 23:30 the week is still open, from Sunday 0:00 it is evaluated", async () => {
  expect((await run("2026-11-14T22:30:00.000Z")).evaluated).toEqual(["2026-11-07"]);
  expect((await run("2026-11-14T23:05:00.000Z")).evaluated).toEqual(["2026-11-14"]);
  // In summer, midnight is two hours before UTC midnight.
  const summer = createMemoryStore();
  await summer.set("guild", guild);
  await summer.set("history/2026-07-11", snap("2026-07-11", { "1": 10, "2": 10 }));
  await summer.set("history/2026-07-18", snap("2026-07-18", { "1": 12, "2": 10 }));
  const runSummer = (iso: string) =>
    runWeeklyEvaluation({ store: summer, now: () => new Date(iso), optOuts: [], generator: phraseGenerator, serverStart: null });
  expect((await runSummer("2026-07-18T21:30:00.000Z")).evaluated).toEqual(["2026-07-11"]);
  expect((await runSummer("2026-07-18T22:05:00.000Z")).evaluated).toEqual(["2026-07-18"]);
});

test("weekActivity assembles a guild week from the two ISO weeks it touches", async () => {
  // W46: Monday Nov 9 2:00 (previous guild week) and Sunday Nov 15 20:00 (this one).
  await store.set("activity/2026-W46", { week: "2026-W46", characters: { "1": [2, 164] }, returns: { "1": 9 } });
  // W47: Tuesday Nov 17 6:00 (this one) and Sunday Nov 22 6:00 (next); Bodo returns on Wednesday.
  await store.set("activity/2026-W47", { week: "2026-W47", characters: { "1": [30, 150], "2": [56] }, returns: { "2": 8 }, testdaten: true });
  expect(await weekActivity(store, "2026-11-21", "2026-11-15", "2026-11-21")).toEqual({
    week: "2026-11-21",
    characters: { "1": [30, 164], "2": [56] },
    // Anna's return was on Monday Nov 9 and does not belong to this week.
    returns: { "2": 8 },
    testdaten: true,
  });
  // Shortened transition week from Monday: Sunday Nov 15 is already scored.
  expect((await weekActivity(store, "2026-11-21", "2026-11-16", "2026-11-21"))?.characters).toEqual({ "1": [30], "2": [56] });
  expect(await weekActivity(store, "2026-12-05", "2026-11-29", "2026-12-05")).toBeNull();
});

describe("transition from ISO weeks to guild weeks", () => {
  const legacy = async (week: string, from: string, to: string) => {
    const record = { week, from, to, generatedAt: "2026-11-17T03:15:00.000Z", titles: [], zeitung: { lead: { kind: "ruhig", headline: `Alt ${week}`, text: "", characterIds: [] }, articles: [], motto: "" } };
    await store.set(`weekly/${week}`, record);
    return record;
  };

  beforeEach(async () => {
    await store.set("history/2026-11-21", snap("2026-11-21", { "1": 46, "2": 33 }, { "1": 9, "2": 5 }));
  });

  test("old result up to Sunday Nov 15 stays, the first guild week runs shortened from Nov 16 to 21", async () => {
    const w45 = await legacy("2026-W45", "2026-11-02", "2026-11-08");
    const w46 = await legacy("2026-W46", "2026-11-09", "2026-11-15");
    await store.set("weekly/index", { weeks: ["2026-W45", "2026-W46"], entries: { "2026-W45": { headline: "Alt 2026-W45" }, "2026-W46": { headline: "Alt 2026-W46" } } });
    // Sunday Nov 15 20:00 is already scored in W46, Tuesday Nov 17 counts anew.
    await store.set("activity/2026-W46", { week: "2026-W46", characters: { "1": [164] } });
    await store.set("activity/2026-W47", { week: "2026-W47", characters: { "2": [30] } });
    const report = await run("2026-11-22T09:00:00.000Z");
    expect(report.evaluated).toEqual(["2026-11-21"]);
    expect(await store.get("weekly/2026-W45")).toEqual(w45);
    expect(await store.get("weekly/2026-W46")).toEqual(w46);
    expect(await store.get("weekly/2026-11-14")).toBeNull();
    const record = await store.get<WeeklyRecord>("weekly/2026-11-21");
    expect(record).toMatchObject({ week: "2026-11-21", from: "2026-11-16", to: "2026-11-21" });
    // Comparison with the snapshot of Nov 15 (end of W46): Anna 40 to 46, Bodo 30 to 33.
    expect(record?.titles).toContainEqual({ titleId: "dauerlaeufer", characterId: 1, value: 6 });
    const index = await store.get<WeeklyIndex>("weekly/index");
    expect(index?.weeks).toEqual(["2026-W45", "2026-W46", "2026-11-21"]);
    expect(index?.entries?.["2026-11-21"]).toMatchObject({ from: "2026-11-16", to: "2026-11-21" });
    // After that, full weeks from Sunday to Saturday again.
    await store.set("history/2026-11-28", snap("2026-11-28", { "1": 50, "2": 33 }));
    expect((await run("2026-11-29T09:00:00.000Z")).evaluated).toEqual(["2026-11-28"]);
    expect(await store.get<WeeklyRecord>("weekly/2026-11-28")).toMatchObject({ from: "2026-11-22", to: "2026-11-28" });
  });

  test("without an old result counting starts earlier, without any gap", async () => {
    const report = await run("2026-11-22T09:00:00.000Z");
    expect(report.evaluated).toEqual(["2026-11-07", "2026-11-14", "2026-11-21"]);
    expect(await store.get<WeeklyRecord>("weekly/2026-11-21")).toMatchObject({ from: "2026-11-15", to: "2026-11-21" });
    expect((await store.get<WeeklyIndex>("weekly/index"))?.weeks).toEqual(["2026-11-07", "2026-11-14", "2026-11-21"]);
  });
});

// Both directions: with only six weeks of history the fixed random choice would decide, and be wrong in one case.
test.each([
  [1, 2],
  [2, 1],
])("title holder on a tie: the whole history counts, not just the last newspaper issues (%i before %i)", async (oldest, younger) => {
  // Tie in deaths: Anna and Bodo 3 each. One had the Pechvogel title eight weeks ago, the other seven.
  await store.set("history/2026-11-14", snap("2026-11-14", { "1": 20, "2": 30 }, { "1": 4, "2": 8 }));
  await store.set("history/2026-11-07", snap("2026-11-07", { "1": 20, "2": 30 }, { "1": 1, "2": 5 }));
  const old = Array.from({ length: 8 }, (_, i) => `2026-W${String(36 + i).padStart(2, "0")}`);
  for (const [i, w] of old.entries()) {
    const titles = i === 0 ? [{ titleId: "pechvogel", characterId: oldest, value: 3 }] : i === 1 ? [{ titleId: "pechvogel", characterId: younger, value: 3 }] : [];
    await store.set(`weekly/${w}`, { week: w, from: "2026-08-31", to: "2026-09-06", generatedAt: NOW, titles, zeitung: { lead: { kind: "ruhig", headline: "H", text: "T", characterIds: [] }, articles: [], motto: "M" } });
  }
  await store.set("weekly/index", { weeks: old });
  await run();
  const unlucky = (await store.get<WeeklyRecord>("weekly/2026-11-14"))?.titles.find((a) => a.titleId === "pechvogel");
  expect(unlucky).toEqual({ titleId: "pechvogel", characterId: oldest, characterIds: [oldest, younger], value: 3 });
});
