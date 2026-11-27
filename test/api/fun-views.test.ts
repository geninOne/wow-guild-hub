import { beforeEach, expect, test } from "vitest";
import { activityWeeks, buildActivityView } from "../../src/api/activity-view";
import { characterTitles } from "../../src/api/fun-common";
import { handleApi } from "../../src/api/router";
import { monthRange, weeksOfMonth } from "../../src/api/wrapped-view";
import type { ActivityView, NewspaperView, CharacterView, TitleRankingView, TitlesView, WrappedView } from "../../src/api/types";
import type { DaySnapshot, GuildRecord, WeeklyRecord } from "../../src/model";
import { createMemoryStore } from "../../src/store";
import { member } from "../helpers/members";
import { sameInAll } from "../../src/language";

const CORPSE_RUNNER = { de: "Pechvogel", en: "Corpse Runner", schwaebisch: "Pechvogel", bayrisch: "Pechvogl" };
/** Value of a title: the same in all German versions, English of its own. */
const value = (de: string, en: string) => ({ ...sameInAll(de), en });
const MARATHON_RUNNER = { ...sameInAll("Dauerläufer"), en: "Marathon Runner" };

const guild: GuildRecord = {
  fetchedAt: "2026-11-16T08:00:00.000Z", id: 1, name: "Bärenklaue", faction: "HORDE", memberCount: 3, rulesetName: "Normal",
  members: [
    member({ id: 1, name: "Anna", slug: "anna", guildSlug: "bärenklaue", level: 25, hasProfile: true }),
    member({ id: 2, name: "Bodo", slug: "bodo", guildSlug: "goldene-bärenklaue", level: 31 }),
    member({ id: 3, name: "Cleo", slug: "cleo", guildSlug: "bärenklaue", former: true }),
  ],
  guilds: [
    { slug: "bärenklaue", id: 1, name: "Bärenklaue", faction: "HORDE", memberCount: 2, rulesetName: "Normal", main: true },
    { slug: "goldene-bärenklaue", id: 2, name: "Goldene Bärenklaue", faction: "ALLIANCE", memberCount: 1, rulesetName: "Normal", main: false },
  ],
};

const snap = (date: string, c: Record<string, Partial<DaySnapshot["characters"][string]>>, testData = false): DaySnapshot => ({
  date, takenAt: `${date}T20:00:00.000Z`,
  characters: Object.fromEntries(Object.entries(c).map(([id, v]) => [id, { level: 1, equippedItemLevel: null, professions: {}, ...v }])),
  ...(testData ? { testdaten: true } : {}),
});

const weekly = (week: string, from: string, to: string, over: Partial<WeeklyRecord> = {}): WeeklyRecord => ({
  week, from, to, generatedAt: "2026-11-16T03:15:00.000Z",
  titles: [{ titleId: "pechvogel", characterId: 1, value: 7 }, { titleId: "dauerlaeufer", characterId: 2, value: 3 }],
  zeitung: {
    lead: { kind: "sprung", headline: "Kopf", text: "Text", characterIds: [2] },
    articles: [{ kind: "titel", headline: "H", text: "T", characterIds: [1, 99], titleId: "pechvogel" }],
    motto: "No ned hudla.",
  },
  ...over,
});

const NOW = new Date("2026-11-18T12:00:00.000Z");
// Without a server start, the comparison of two daily snapshots applies everywhere; single tests set it.
let serverStart: string | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const get = async <T = any>(path: string): Promise<{ status: number; body: T }> => {
  const res = await handleApi(new Request(`http://x${path}`), store, () => NOW, { serverStart });
  return { status: res.status, body: (await res.json()) as T };
};

let store: ReturnType<typeof createMemoryStore>;
beforeEach(async () => {
  serverStart = null;
  store = createMemoryStore();
  await store.set("guild", guild);
  await store.set("static/classes", { items: [{ id: 1, name: "Krieger" }] });
});

test("activityWeeks: current week and seven before", () => {
  const weeks = activityWeeks(NOW.toISOString());
  expect(weeks).toHaveLength(8);
  expect(weeks[0]).toBe("2026-W40");
  expect(weeks[7]).toBe("2026-W47");
});

test("/api/activity sums per guild, ignores unknown ones and invalid hours", async () => {
  await store.set("activity/2026-W46", { week: "2026-W46", characters: { "1": [20, 21], "2": [20], "99": [20] } });
  await store.set("activity/2026-W47", { week: "2026-W47", characters: { "1": [20, 500], "3": [5] }, testdaten: true });
  const { status, body } = await get<ActivityView>("/api/activity");
  expect(status).toBe(200);
  expect(body.weeksWithData).toBe(2);
  expect(body.from).toBe("2026-09-28");
  expect(body.to).toBe("2026-11-22");
  expect(body.all.cells[20]).toBe(3);
  expect(body.all.cells[21]).toBe(1);
  expect(body.all.cells[5]).toBe(1); // former member counts with their last guild
  expect(body.all.characters).toBe(3);
  expect(body.byGuild["bärenklaue"].cells[20]).toBe(2);
  expect(body.byGuild["goldene-bärenklaue"]).toMatchObject({ characters: 1 });
  expect(body.byGuild["goldene-bärenklaue"].cells[20]).toBe(1);
  expect(body.all.cells.reduce((a, b) => a + b, 0)).toBe(5);
  expect(body.testdaten).toBe(true);
  // member list: hours with a login per character, most first, unknown ones missing, invalid hours do not count
  expect(body.logins).toEqual([[1, 3], [2, 1], [3, 1]]);
});

test("buildActivityView without data: empty grid", () => {
  const view = buildActivityView(guild, ["2026-W47"], [null]);
  expect(view.weeksWithData).toBe(0);
  expect(view.all.cells).toHaveLength(168);
  expect(view.testdaten).toBe(false);
  expect(view.logins).toEqual([]);
});

test("/api/titles: current week and previous weeks, newest first; empty before the first evaluation", async () => {
  const empty = await get<TitlesView>("/api/titles");
  expect(empty.body.current).toBeNull();
  expect(empty.body.titles.map((t) => t.id)).toContain("pechvogel");

  await store.set("weekly/2026-W45", weekly("2026-W45", "2026-11-02", "2026-11-08", { titles: [] }));
  await store.set("weekly/2026-W46", weekly("2026-W46", "2026-11-09", "2026-11-15"));
  await store.set("weekly/index", { weeks: ["2026-W45", "2026-W46"] });
  const { body } = await get<TitlesView>("/api/titles");
  expect(body.current?.week).toBe("2026-W46");
  expect(body.current?.awards[0]).toMatchObject({
    titleId: "pechvogel", name: CORPSE_RUNNER, valueText: value("7 Tode", "7 deaths"), character: { id: 1, name: "Anna", slug: "anna" },
  });
  expect(body.history.map((h) => h.week)).toEqual(["2026-W45"]);
});

test("/api/titles?titel=&woche=: full ranking, old weeks only with the winner, unknown gives 404", async () => {
  await store.set("weekly/2026-W45", weekly("2026-W45", "2026-11-02", "2026-11-08"));
  await store.set(
    "weekly/2026-11-21",
    weekly("2026-11-21", "2026-11-15", "2026-11-21", { rankings: { pechvogel: [[1, 7], [2, 1]], nachteule: [] } }),
  );
  await store.set("weekly/index", { weeks: ["2026-W45", "2026-11-21"] });

  const view = await get<TitlesView>("/api/titles");
  expect(view.body.current?.ranked).toBe(true);
  expect(view.body.history[0].ranked).toBe(false);

  const ranked = await get<TitleRankingView>("/api/titles?titel=pechvogel&woche=2026-11-21");
  expect(await get("/api/titles?title=pechvogel&week=2026-11-21")).toEqual(ranked);
  expect(ranked.status).toBe(200);
  expect(ranked.body).toEqual({
    titleId: "pechvogel", week: "2026-11-21", from: "2026-11-15", to: "2026-11-21", winnerIds: [1], complete: true,
    entries: [[1, 7], [2, 1]],
    valueTexts: { "7": value("7 Tode", "7 deaths"), "1": value("1 Tod", "1 death") },
  });
  // title without values in a week with a ranking: empty, but complete
  const empty = await get<TitleRankingView>("/api/titles?titel=nachteule&woche=2026-11-21");
  expect(empty.body).toMatchObject({ winnerIds: [], entries: [], complete: true });
  // title missing from the ranking (added later, say): only the winner, if there is one
  const missing = await get<TitleRankingView>("/api/titles?titel=dauerlaeufer&woche=2026-11-21");
  expect(missing.body).toMatchObject({ winnerIds: [2], entries: [[2, 3]], complete: true });

  // old week without a ranking: only the winner
  const old = await get<TitleRankingView>("/api/titles?titel=pechvogel&woche=2026-W45");
  expect(old.body).toMatchObject({ winnerIds: [1], entries: [[1, 7]], complete: false, valueTexts: { "7": value("7 Tode", "7 deaths") } });

  for (const path of [
    "/api/titles?titel=gibtsnicht&woche=2026-11-21",
    "/api/titles?titel=pechvogel&woche=2026-11-28",
    "/api/titles?titel=pechvogel&woche=quatsch",
    "/api/titles?titel=pechvogel",
  ]) {
    expect((await get(path)).status, path).toBe(404);
  }
});

test("/api/zeitung: latest issue, paging, number, unknown characters as placeholders", async () => {
  expect((await get("/api/zeitung")).status).toBe(404);
  await store.set("weekly/2026-W45", weekly("2026-W45", "2026-11-02", "2026-11-08"));
  await store.set("weekly/2026-W46", weekly("2026-W46", "2026-11-09", "2026-11-15", { testdaten: true }));
  await store.set("weekly/index", { weeks: ["2026-W45", "2026-W46"] });

  const latest = await get<NewspaperView>("/api/zeitung");
  expect(latest.body).toMatchObject({ issue: 2, week: "2026-W46", previous: "2026-W45", next: null, testdaten: true });
  expect(latest.body.lead.characters.map((c) => c.name)).toEqual(["Bodo"]);
  expect(latest.body.articles[0].characters.map((c) => c.name)).toEqual(["Anna", "Unbekannt"]);
  expect(latest.body.articles[0].title).toEqual({ id: "pechvogel", name: CORPSE_RUNNER });
  // issues without a translation return German, also as English; dialects fall back to German in the UI
  expect(latest.body.lead.headline).toEqual({ de: "Kopf", en: "Kopf" });
  expect(latest.body.motto).toEqual({ de: "No ned hudla.", en: "No ned hudla." });
  expect(latest.body.lead.title).toBeNull();

  const first = await get<NewspaperView>("/api/zeitung/2026-W45");
  expect(first.body).toMatchObject({ issue: 1, previous: null, next: "2026-W46", testdaten: false });
  expect((await get("/api/zeitung/2026-W44")).status).toBe(404);
  expect((await get("/api/zeitung/quatsch")).status).toBe(404);
  // English paths answer like the German ones of 2.x.
  expect(await get("/api/newspaper")).toEqual(latest);
  expect(await get("/api/newspaper/2026-W45")).toEqual(first);
  expect(await get("/api/newspaper/archive")).toEqual(await get("/api/zeitung/archiv"));
});

test("/api/zeitung and archive return English, Swabian and Bavarian, missing versions fall back to standard German", async () => {
  await store.set("weekly/2026-W46", weekly("2026-W46", "2026-11-09", "2026-11-15", {
    zeitung: {
      lead: {
        kind: "sprung", section: "Klatsch", headline: "Kopf", text: "Text", characterIds: [2],
        dialekte: {
          en: { headline: "Head", text: "The text" },
          schwaebisch: { headline: "Kopf, gell", text: "Des isch dr Text" },
          bayrisch: { headline: "Kopf, fei", text: "Des is da Text" },
        },
      },
      articles: [{ kind: "titel", headline: "H", text: "T", characterIds: [1], titleId: "pechvogel", dialekte: { bayrisch: { headline: "Hä", text: "Tja" } } }],
      motto: "Gut Ding will Weile haben.",
      mottoDialekte: { en: "Good things come to those who wait.", schwaebisch: "Schaffe, schaffe, Häusle baue.", bayrisch: "Mia san mia." },
      wetter: "Sonne.",
      wetterDialekte: { en: "Sunshine." },
      // English sits in the field `dialekte` under `en`; the type in model.ts only knows the dialects so far
    } as WeeklyRecord["zeitung"],
  }));
  await store.set("weekly/index", {
    weeks: ["2026-W46"],
    entries: { "2026-W46": { headline: "Kopf", dialekte: { en: "Head", schwaebisch: "Kopf, gell", bayrisch: "Kopf, fei" } } },
  });
  const { body } = await get<NewspaperView>("/api/zeitung");
  expect(body.lead.headline).toEqual({ de: "Kopf", en: "Head", schwaebisch: "Kopf, gell", bayrisch: "Kopf, fei" });
  expect(body.lead.text.en).toBe("The text");
  expect(body.lead.text.bayrisch).toBe("Des is da Text");
  expect(body.lead.section).toEqual({ de: "Klatsch", en: "Gossip", schwaebisch: "Gschwätz", bayrisch: "Ratsch" });
  expect(body.articles[0].headline).toEqual({ de: "H", en: "H", bayrisch: "Hä" });
  expect(body.motto).toEqual({ de: "Gut Ding will Weile haben.", en: "Good things come to those who wait.", schwaebisch: "Schaffe, schaffe, Häusle baue.", bayrisch: "Mia san mia." });
  expect(body.wetter).toEqual({ de: "Sonne.", en: "Sunshine." });
  const archiveView = await get<{ issues: { headline: unknown }[] }>("/api/zeitung/archiv");
  expect(archiveView.body.issues[0].headline).toEqual({ de: "Kopf", en: "Head", schwaebisch: "Kopf, gell", bayrisch: "Kopf, fei" });
});

test("character page carries the titles of the last week", async () => {
  await store.set("weekly/2026-W46", weekly("2026-W46", "2026-11-09", "2026-11-15"));
  await store.set("weekly/index", { weeks: ["2026-W46"] });
  const { body } = await get<CharacterView>("/api/characters/anna");
  expect(body.titles).toEqual([{ titleId: "pechvogel", name: CORPSE_RUNNER, week: "2026-W46", from: "2026-11-09", to: "2026-11-15", valueText: value("7 Tode", "7 deaths") }]);
  const bodo = await get<CharacterView>("/api/characters/bodo");
  expect(bodo.body.titles?.map((t) => t.name)).toEqual([MARATHON_RUNNER]);
});

test("monthRange and weeksOfMonth", () => {
  expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  expect(monthRange("2026-12")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  expect(weeksOfMonth("2026-11")).toEqual(["2026-W44", "2026-W45", "2026-W46", "2026-W47", "2026-W48", "2026-W49"]);
});

test("/api/wrapped: monthly summary from daily snapshots, activity and titles", async () => {
  await store.set("history/2026-10-31", snap("2026-10-31", {
    "1": { level: 20, equippedItemLevel: 10, professions: { "186": 50 }, deaths: 2, recipes: 5, dungeons: 1 },
    "2": { level: 25 },
  }));
  await store.set("history/2026-11-10", snap("2026-11-10", { "1": { level: 22 } }));
  await store.set("history/2026-11-17", snap("2026-11-17", {
    "1": { level: 25, equippedItemLevel: 14, professions: { "186": 80, "164": 5 }, deaths: 9, recipes: 12, dungeons: 4 },
    "2": { level: 31 },
  }, true));
  // W44 starts in October: Monday 26 Oct does not count, Sunday 1 Nov does.
  await store.set("activity/2026-W44", { week: "2026-W44", characters: { "1": [20, 6 * 24 + 21] } });
  await store.set("activity/2026-W46", { week: "2026-W46", characters: { "1": [21, 24 + 21, 24 + 22] } });
  await store.set("weekly/2026-W45", weekly("2026-W45", "2026-11-02", "2026-11-08"));
  await store.set("weekly/2026-W46", weekly("2026-W46", "2026-11-09", "2026-11-15"));
  await store.set("weekly/index", { weeks: ["2026-W45", "2026-W46"] });

  const { status, body } = await get<WrappedView>("/api/wrapped/anna");
  expect(status).toBe(200);
  expect(body).toMatchObject({
    month: "2026-11",
    months: ["2026-11", "2026-10"],
    running: true,
    from: "2026-10-31",
    to: "2026-11-17",
    since: null,
    serverStart: null,
    levels: { gained: 5, start: 20, end: 25 },
    rank: { place: 2, of: 2 },
    itemLevel: 4,
    professionPoints: 35,
    dungeons: 3,
    recipes: 7,
    deaths: 7,
    logins: 4,
    activeDays: 3,
    favoriteHour: 21,
    favoriteWeekday: 1,
    testdaten: true,
    character: { name: "Anna", className: "Krieger", level: 25 },
  });
  expect(body.titles.map((t) => [t.week, t.name])).toEqual([["2026-W45", CORPSE_RUNNER], ["2026-W46", CORPSE_RUNNER]]);

  const oct = await get<WrappedView>("/api/wrapped/anna/2026-10");
  expect(oct.body).toMatchObject({ month: "2026-10", running: false, levels: { gained: 0 }, logins: 1, favoriteHour: 20 });

  const none = await get<WrappedView>("/api/wrapped/anna/2026-05");
  expect(none.body).toMatchObject({ levels: null, rank: null, deaths: null, logins: 0, favoriteHour: null, titles: [] });

  expect((await get("/api/wrapped/niemand")).status).toBe(404);
  expect((await get("/api/wrapped/anna/2026-13")).status).toBe(404);
});

test("/api/zeitung/archiv: all issues newest first, headline from the index, old weeks without an entry are loaded", async () => {
  expect((await get("/api/zeitung/archiv")).body).toEqual({ issues: [] });
  await store.set("weekly/2026-W45", weekly("2026-W45", "2026-11-02", "2026-11-08", {
    zeitung: { lead: { kind: "ruhig", headline: "Alte Schlagzeile", text: "T", characterIds: [] }, articles: [], motto: "M" },
  }));
  await store.set("weekly/2026-W46", weekly("2026-W46", "2026-11-09", "2026-11-15"));
  await store.set("weekly/index", {
    weeks: ["2026-W45", "2026-W46"],
    entries: { "2026-W46": { headline: "Aus dem Index", testdaten: true } },
  });
  const loaded: string[] = [];
  const spy = { ...store, get: async <T,>(k: string) => { loaded.push(k); return store.get<T>(k); } };
  const res = await handleApi(new Request("http://x/api/zeitung/archiv"), spy, () => NOW);
  const body = (await res.json()) as { issues: unknown[] };
  expect(body.issues).toEqual([
    { issue: 2, week: "2026-W46", from: "2026-11-09", to: "2026-11-15", headline: { de: "Aus dem Index", en: "Aus dem Index" }, testdaten: true },
    { issue: 1, week: "2026-W45", from: "2026-11-02", to: "2026-11-08", headline: { de: "Alte Schlagzeile", en: "Alte Schlagzeile" }, testdaten: false },
  ]);
  expect(loaded).not.toContain("weekly/2026-W46");
});

test("/api/zeitung returns sections and writer, old issues without a section end up under Vermischtes", async () => {
  await store.set("weekly/2026-W46", weekly("2026-W46", "2026-11-09", "2026-11-15"));
  await store.set("weekly/index", { weeks: ["2026-W46"] });
  const { body } = await get<NewspaperView>("/api/zeitung");
  expect(body.generator).toBe("bausteine");
  expect(body.lead.section).toEqual({ de: "Vermischtes", en: "Miscellaneous", schwaebisch: "Allerlei", bayrisch: "Allerhand" });
  // images of the characters involved, null without a record
  expect(body.avatars).toEqual({ "2": null, "1": null, "99": null });
  await store.set("characters/2", { id: 2, media: { avatar: "https://render.example/2-avatar.jpg" } });
  expect((await get<NewspaperView>("/api/zeitung")).body.avatars["2"]).toBe("https://render.example/2-avatar.jpg");
});

test("/api/wrapped: late joiner counts from their first daily snapshot in the month and is in the ranking", async () => {
  const late: GuildRecord = {
    ...guild,
    members: [
      ...guild.members,
      member({ id: 4, name: "Dora", slug: "dora", guildSlug: "bärenklaue", level: 9, firstSeenAt: "2026-11-10T09:00:00.000Z" }),
      member({ id: 5, name: "Emil", slug: "emil", guildSlug: "bärenklaue", level: 44, firstSeenAt: "2026-11-12T18:00:00.000Z" }),
    ],
  };
  await store.set("guild", late);
  await store.set("history/2026-10-31", snap("2026-10-31", { "1": { level: 20 }, "2": { level: 25 } }));
  await store.set("history/2026-11-09", snap("2026-11-09", { "1": { level: 21 }, "2": { level: 25 } }));
  await store.set("history/2026-11-10", snap("2026-11-10", {
    "1": { level: 22 }, "2": { level: 25 }, "4": { level: 3, equippedItemLevel: 2, deaths: 0, dungeons: 0, recipes: 1 },
  }));
  await store.set("history/2026-11-12", snap("2026-11-12", {
    "1": { level: 23 }, "2": { level: 26 }, "4": { level: 6 }, "5": { level: 40, deaths: 11 },
  }));
  await store.set("history/2026-11-17", snap("2026-11-17", {
    "1": { level: 25 }, "2": { level: 31 }, "4": { level: 9, equippedItemLevel: 7, deaths: 2, dungeons: 1, recipes: 4 },
    "5": { level: 44, deaths: 12 },
  }));
  // Dora was first seen on 10 Nov at level 1 and reached 3 the same day.
  await store.set("levelups", { events: [
    { characterId: 4, level: 2, at: "2026-11-10T12:00:00.000Z" },
    { characterId: 4, level: 3, at: "2026-11-10T15:00:00.000Z" },
    { characterId: 4, level: 4, at: "2026-11-11T15:00:00.000Z" },
  ] });

  const dora = (await get<WrappedView>("/api/wrapped/dora")).body;
  expect(dora).toMatchObject({
    from: "2026-11-10", to: "2026-11-17", since: null,
    levels: { gained: 8, start: 1, end: 9 },
    // Dora 8, Bodo 6, Anna 5, Emil 4
    rank: { place: 1, of: 4 },
    itemLevel: 5, deaths: 2, dungeons: 1, recipes: 3,
  });

  // joined at level 40: counted from joining, with a notice.
  const emil = (await get<WrappedView>("/api/wrapped/emil")).body;
  expect(emil).toMatchObject({
    from: "2026-11-12", since: "2026-11-12", levels: { gained: 4, start: 40, end: 44 }, rank: { place: 4, of: 4 }, deaths: 1,
  });

  // whoever is in the baseline snapshot stays unchanged.
  expect((await get<WrappedView>("/api/wrapped/anna")).body).toMatchObject({
    from: "2026-10-31", since: null, levels: { gained: 5, start: 20, end: 25 }, rank: { place: 3, of: 4 },
  });
});

test("/api/wrapped: in the month of the server start everyone counts from level 1 and counters at 0", async () => {
  serverStart = "2026-11-05";
  await store.set("guild", {
    ...guild,
    members: [
      ...guild.members,
      member({ id: 5, name: "Emil", slug: "emil", guildSlug: "bärenklaue", level: 44, firstSeenAt: "2026-11-12T18:00:00.000Z" }),
    ],
  });
  // a snapshot before the server start (such as old sample data) is never used.
  await store.set("history/2026-10-31", snap("2026-10-31", { "1": { level: 10, deaths: 3 }, "2": { level: 12 } }));
  await store.set("history/2026-11-06", snap("2026-11-06", { "1": { level: 8, deaths: 1 }, "2": { level: 14 } }));
  await store.set("history/2026-11-12", snap("2026-11-12", { "1": { level: 20 }, "2": { level: 26 }, "5": { level: 40, deaths: 11 } }));
  await store.set("history/2026-11-17", snap("2026-11-17", {
    "1": { level: 25, equippedItemLevel: 14, professions: { "186": 80, "164": 5 }, deaths: 9, recipes: 12, dungeons: 4 },
    "2": { level: 31 },
    "5": { level: 44, deaths: 12 },
  }));

  const anna = (await get<WrappedView>("/api/wrapped/anna")).body;
  expect(anna).toMatchObject({
    month: "2026-11", months: ["2026-11"], from: "2026-11-05", to: "2026-11-17", since: null, serverStart: "2026-11-05",
    levels: { gained: 24, start: 1, end: 25 },
    // Emil 43, Bodo 30, Anna 24
    rank: { place: 3, of: 3 },
    // item level: current value; counters and profession points: full value.
    itemLevel: 14, professionPoints: 85, dungeons: 4, recipes: 12, deaths: 9,
  });

  // joined at level 40: these levels were also gained since the server start, no joining notice.
  expect((await get<WrappedView>("/api/wrapped/emil")).body).toMatchObject({
    from: "2026-11-05", since: null, serverStart: "2026-11-05",
    levels: { gained: 43, start: 1, end: 44 }, rank: { place: 1, of: 3 }, deaths: 12,
  });

  // counters the end snapshot does not know stay without a value.
  expect((await get<WrappedView>("/api/wrapped/bodo")).body).toMatchObject({ levels: { gained: 30 }, deaths: null, itemLevel: null });

  // before the server start there is nothing, even if a snapshot exists there.
  expect((await get<WrappedView>("/api/wrapped/anna/2026-10")).body).toMatchObject({ levels: null, rank: null, serverStart: null });
});

test("/api/wrapped: after the month of the server start the snapshot before the month applies again", async () => {
  serverStart = "2026-11-05";
  await store.set("history/2026-10-31", snap("2026-10-31", { "1": { level: 10 } }));
  await store.set("history/2026-11-30", snap("2026-11-30", { "1": { level: 30, deaths: 4 }, "2": { level: 31 } }));
  await store.set("history/2026-12-10", snap("2026-12-10", { "1": { level: 36, deaths: 6 }, "2": { level: 33 } }));
  const res = await handleApi(new Request("http://x/api/wrapped/anna"), store, () => new Date("2026-12-11T12:00:00.000Z"), { serverStart });
  expect(await res.json()).toMatchObject({
    month: "2026-12", months: ["2026-12", "2026-11"], from: "2026-11-30", to: "2026-12-10", serverStart: null,
    levels: { gained: 6, start: 30, end: 36 }, rank: { place: 1, of: 2 }, deaths: 2,
  });
});

test("guild weeks next to old ISO weeks: paging, archive with shortened transition week and badges", async () => {
  await store.set("weekly/2026-W46", weekly("2026-W46", "2026-11-09", "2026-11-15"));
  await store.set("weekly/2026-11-21", weekly("2026-11-21", "2026-11-16", "2026-11-21"));
  await store.set("weekly/2026-11-28", weekly("2026-11-28", "2026-11-22", "2026-11-28", { titles: [{ titleId: "dauerlaeufer", characterId: 1, value: 4 }] }));
  await store.set("weekly/index", {
    weeks: ["2026-W46", "2026-11-21", "2026-11-28"],
    entries: {
      "2026-W46": { headline: "Alt" },
      "2026-11-21": { headline: "Übergang", from: "2026-11-16", to: "2026-11-21" },
      "2026-11-28": { headline: "Neu", from: "2026-11-22", to: "2026-11-28" },
    },
  });
  const latest = await get<NewspaperView>("/api/zeitung");
  expect(latest.body).toMatchObject({ issue: 3, week: "2026-11-28", from: "2026-11-22", to: "2026-11-28", previous: "2026-11-21", next: null });
  const middle = await get<NewspaperView>("/api/zeitung/2026-11-21");
  expect(middle.body).toMatchObject({ issue: 2, from: "2026-11-16", to: "2026-11-21", previous: "2026-W46", next: "2026-11-28" });
  expect((await get("/api/zeitung/2026-11-22")).status).toBe(404); // not a Saturday
  expect((await get("/api/zeitung/2026-11-14")).status).toBe(404); // Saturday without an issue

  const archive = await get<{ issues: { issue: number; week: string; from: string; to: string }[] }>("/api/zeitung/archiv");
  expect(archive.body.issues.map((i) => [i.issue, i.week, i.from, i.to])).toEqual([
    [3, "2026-11-28", "2026-11-22", "2026-11-28"],
    [2, "2026-11-21", "2026-11-16", "2026-11-21"],
    [1, "2026-W46", "2026-11-09", "2026-11-15"],
  ]);

  const anna = await get<CharacterView>("/api/characters/anna");
  expect(anna.body.titles).toEqual([{ titleId: "dauerlaeufer", name: MARATHON_RUNNER, week: "2026-11-28", from: "2026-11-22", to: "2026-11-28", valueText: value("4 Level", "4 levels") }]);
});

test("/api/wrapped: a guild week belongs to the month of its Saturday", async () => {
  await store.set("history/2026-11-28", snap("2026-11-28", { "1": { level: 5 } }));
  await store.set("weekly/2026-W46", weekly("2026-W46", "2026-11-09", "2026-11-15"));
  await store.set("weekly/2026-10-31", weekly("2026-10-31", "2026-10-25", "2026-10-31"));
  await store.set("weekly/2026-11-28", weekly("2026-11-28", "2026-11-22", "2026-11-28"));
  await store.set("weekly/2026-12-05", weekly("2026-12-05", "2026-11-29", "2026-12-05"));
  await store.set("weekly/index", { weeks: ["2026-10-31", "2026-W46", "2026-11-28", "2026-12-05"] });
  const nov = await get<WrappedView>("/api/wrapped/anna/2026-11");
  expect(nov.body.titles.map((t) => t.week)).toEqual(["2026-W46", "2026-11-28"]);
  const dec = await get<WrappedView>("/api/wrapped/anna/2026-12");
  expect(dec.body.titles.map((t) => t.week)).toEqual(["2026-12-05"]);
});

test("shared title: card shows the title holder, ranking highlights all holders, character view counts for all", async () => {
  const shared = weekly("2026-11-21", "2026-11-15", "2026-11-21", {
    titles: [{ titleId: "pechvogel", characterId: 2, characterIds: [2, 1], value: 7 }],
    rankings: { pechvogel: [[2, 7], [1, 7]] },
  });
  await store.set("weekly/2026-11-21", shared);
  await store.set("weekly/index", { weeks: ["2026-11-21"] });

  const view = await get<TitlesView>("/api/titles");
  expect(view.body.current?.awards).toHaveLength(1);
  expect(view.body.current?.awards[0]).toMatchObject({ character: { id: 2, name: "Bodo" }, sharedWith: 1 });

  const ranking = await get<TitleRankingView>("/api/titles?titel=pechvogel&woche=2026-11-21");
  expect(ranking.body).toMatchObject({ winnerIds: [2, 1], entries: [[2, 7], [1, 7]] });

  // both have the title, also whoever is not on the card
  expect(characterTitles(shared, 1).map((t) => t.titleId)).toEqual(["pechvogel"]);
  expect(characterTitles(shared, 2).map((t) => t.titleId)).toEqual(["pechvogel"]);
  expect(characterTitles(shared, 3)).toEqual([]);
  const anna = await get<CharacterView>("/api/characters/anna");
  expect(anna.body.titles?.map((t) => t.titleId)).toEqual(["pechvogel"]);
});

test("old weeks with only one holder stay readable", async () => {
  const old = weekly("2026-W46", "2026-11-09", "2026-11-15");
  await store.set("weekly/2026-W46", old);
  await store.set("weekly/index", { weeks: ["2026-W46"] });
  const view = await get<TitlesView>("/api/titles");
  expect(view.body.current?.awards.map((a) => [a.titleId, a.character.id, a.sharedWith])).toEqual([["pechvogel", 1, 0], ["dauerlaeufer", 2, 0]]);
  expect(characterTitles(old, 1).map((t) => t.titleId)).toEqual(["pechvogel"]);
  const ranking = await get<TitleRankingView>("/api/titles?titel=dauerlaeufer&woche=2026-W46");
  expect(ranking.body).toMatchObject({ winnerIds: [2], entries: [[2, 3]], complete: false });
});
