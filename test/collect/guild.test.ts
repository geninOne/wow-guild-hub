import { beforeEach, expect, test, vi } from "vitest";
import type { ApiResult } from "../../src/blizzard/client";
import { END_RESERVE_SHARE } from "../../src/collect/budget";
import { runGuildCollection } from "../../src/collect/guild";
import type { Config } from "../../src/config";
import { CHARACTER_INDEX_KEY } from "../../src/collect/character-index";
import type { ActivityWeek, CharacterIndex, CharacterRecord, DaySnapshot, GuildRecord, LevelUpLog } from "../../src/model";
import { createMemoryStore } from "../../src/store";
import type { StatsSnapshot } from "../../src/stats/snapshot";
import { createFakeClient } from "../helpers/fake-client";
import { loadFixture } from "../helpers/fixtures";

const LUVIA = 382219;
const SEEROTH = 374723;
const GUILD = "/data/wow/guild/b%C3%A4renklaue";
const ROSTER = `${GUILD}/roster`;
const LUVIA_BASE = "/profile/wow/character/luvia-stav";
const SEE_BASE = "/profile/wow/character/seeroth-totenglanz";

const config: Config = {
  clientId: "id", clientSecret: "s", guildSlugs: ["bärenklaue"], region: "eu", locale: "de_DE", gameVersion: "forever",
  concurrency: 2, budgetMs: 10_000,
};

let routes: Record<string, ApiResult>;
let store: ReturnType<typeof createMemoryStore>;
let fake: ReturnType<typeof createFakeClient>;

function rosterWith(levels: Record<number, number>, ids: number[] = [SEEROTH, LUVIA]): ApiResult {
  const raw = loadFixture("roster");
  const members = raw.data.members
    .filter((m: { character: { id: number } }) => ids.includes(m.character.id))
    .map((m: { character: { id: number; level: number } }) => ({
      ...m,
      character: { ...m.character, level: levels[m.character.id] ?? m.character.level },
    }));
  return { status: 200, data: { ...raw.data, members } };
}

/** Luvia's data under another base path, optionally with another ID and another level. */
function characterRoutes(base: string, over: { id?: number; level?: number } = {}): Record<string, ApiResult> {
  const profile = loadFixture("luvia-profile");
  return {
    [base]: { status: 200, data: { ...profile.data, ...over } },
    [`${base}/specializations`]: loadFixture("luvia-specializations"),
    [`${base}/equipment`]: loadFixture("luvia-equipment"),
    [`${base}/character-media`]: loadFixture("luvia-media"),
    [`${base}/professions`]: loadFixture("luvia-professions"),
    [`${base}/encounters/raids`]: loadFixture("luvia-raids"),
    [`${base}/achievements`]: loadFixture("chordrak-achievements"),
    [`${base}/achievements/statistics`]: loadFixture("chordrak-statistics"),
    [`${base}/reputations`]: loadFixture("chordrak-reputations"),
  };
}

function run(iso: string, cfg: Partial<Config> = {}) {
  return runGuildCollection({ client: fake, store, config: { ...config, ...cfg }, now: () => new Date(iso) });
}

const T10 = "2026-11-06T10:00:00.000Z";
const T11 = "2026-11-06T11:00:00.000Z";
const T12 = "2026-11-06T12:00:00.000Z";
const T13 = "2026-11-06T13:00:00.000Z";

beforeEach(() => {
  routes = {
    [GUILD]: loadFixture("guild"),
    [ROSTER]: rosterWith({}),
    ...characterRoutes(LUVIA_BASE),
  };
  store = createMemoryStore();
  fake = createFakeClient(routes);
});

test("first run creates characters, guild and daily snapshot, but no level-ups", async () => {
  const rep = await run(T10);
  expect(rep).toMatchObject({ at: T10, fetched: 2, failed: 0, skipped: 0, levelUps: 0 });
  expect((await store.get<CharacterRecord>(`characters/${LUVIA}`))?.level).toBe(21);
  expect((await store.get<CharacterRecord>(`characters/${SEEROTH}`))?.hasProfile).toBe(false);
  const guild = await store.get<GuildRecord>("guild");
  expect(guild).toMatchObject({ fetchedAt: T10, id: 194131, name: "Bärenklaue", faction: "HORDE", memberCount: 76, rulesetName: "Normal" });
  expect(guild?.members.map((m) => [m.id, m.level, m.lastFetchedAt])).toEqual([[SEEROTH, 6, T10], [LUVIA, 21, T10]]);
  expect(guild?.members[1].mainSpecName).toBe("Furor");
  const snap = await store.get<DaySnapshot>("history/2026-11-06");
  expect(snap?.characters[String(LUVIA)].level).toBe(21);
  expect(snap?.characters[String(SEEROTH)].level).toBe(6);
  expect(await store.get("levelups")).toBeNull();
});

test("second run with level 23 records 22 and 23 with the same time", async () => {
  await run(T10);
  Object.assign(routes, characterRoutes(LUVIA_BASE, { level: 23 }));
  const rep = await run(T11);
  expect(rep.levelUps).toBe(2);
  expect((await store.get<LevelUpLog>("levelups"))?.events).toEqual([
    { characterId: LUVIA, level: 22, at: T11 },
    { characterId: LUVIA, level: 23, at: T11 },
  ]);
});

test("error in a partial fetch: old state stays, the rest continues", async () => {
  await run(T10);
  routes[`${LUVIA_BASE}/equipment`] = { status: 500, data: null };
  const rep = await run(T11);
  expect(rep).toMatchObject({ fetched: 1, failed: 1 });
  expect(rep.errors).toEqual([{ id: LUVIA, message: expect.stringContaining("500") }]);
  expect((await store.get<CharacterRecord>(`characters/${LUVIA}`))?.fetchedAt).toBe(T10);
  const guild = await store.get<GuildRecord>("guild");
  expect(guild?.members.find((m) => m.id === LUVIA)?.lastFetchedAt).toBe(T10);
  expect(guild?.members.find((m) => m.id === SEEROTH)?.lastFetchedAt).toBe(T11);
});

test.each([
  ["equipment", "/equipment"],
  ["specs", "/specializations"],
  ["professions", "/professions"],
] as const)("partial fetch %s returns 404 with an existing profile: previous state of this part stays", async (field, path) => {
  await run(T10);
  const before = await store.get<CharacterRecord>(`characters/${LUVIA}`);
  expect(before?.[field].length).toBeGreaterThan(0);
  routes[`${LUVIA_BASE}${path}`] = { status: 404, data: null };
  const rep = await run(T11);
  expect(rep).toMatchObject({ fetched: 2, failed: 0 });
  const after = await store.get<CharacterRecord>(`characters/${LUVIA}`);
  expect(after?.fetchedAt).toBe(T11);
  expect(after?.[field]).toEqual(before?.[field]);
  expect(after?.mainSpecId).toBe(before?.mainSpecId);
  expect(after?.equipment.length).toBeGreaterThan(0);
});

test("partial fetch 404 without previous state stays empty", async () => {
  routes[`${LUVIA_BASE}/equipment`] = { status: 404, data: null };
  await run(T10);
  expect((await store.get<CharacterRecord>(`characters/${LUVIA}`))?.equipment).toEqual([]);
});

test("character media 404 is normal and becomes null, even if it was there before", async () => {
  await run(T10);
  expect((await store.get<CharacterRecord>(`characters/${LUVIA}`))?.media).not.toBeNull();
  routes[`${LUVIA_BASE}/character-media`] = { status: 404, data: null };
  await run(T11);
  expect((await store.get<CharacterRecord>(`characters/${LUVIA}`))?.media).toBeNull();
});

test("profile disappears: rich record is kept", async () => {
  await run(T10);
  delete routes[LUVIA_BASE];
  const rep = await run(T11);
  expect(rep.failed).toBe(1);
  const rec = await store.get<CharacterRecord>(`characters/${LUVIA}`);
  expect([rec?.hasProfile, rec?.fetchedAt]).toEqual([true, T10]);
  expect((await store.get<GuildRecord>("guild"))?.members.find((m) => m.id === LUVIA)?.hasProfile).toBe(true);
});

test("switching from roster to profile source creates no duplicate level-ups", async () => {
  routes[ROSTER] = rosterWith({ [SEEROTH]: 9 });
  await run(T10);
  routes[ROSTER] = rosterWith({ [SEEROTH]: 11 });
  await run(T11);
  Object.assign(routes, characterRoutes(SEE_BASE, { id: SEEROTH, level: 10 }));
  await run(T12);
  Object.assign(routes, characterRoutes(SEE_BASE, { id: SEEROTH, level: 12 }));
  await run(T13);
  const events = (await store.get<LevelUpLog>("levelups"))?.events.filter((e) => e.characterId === SEEROTH);
  expect(events).toEqual([
    { characterId: SEEROTH, level: 10, at: T11 },
    { characterId: SEEROTH, level: 11, at: T11 },
    { characterId: SEEROTH, level: 12, at: T13 },
  ]);
  expect((await store.get<CharacterRecord>(`characters/${SEEROTH}`))?.id).toBe(SEEROTH);
});

test("returner with a higher level gets no events for the absence", async () => {
  await run(T10);
  routes[ROSTER] = rosterWith({}, [LUVIA]);
  await run(T11);
  const afterLeaving = await store.get<GuildRecord>("guild");
  expect(afterLeaving?.members.find((m) => m.id === SEEROTH)).toMatchObject({ former: true, leftAt: T11 });
  expect((await store.get<DaySnapshot>("history/2026-11-06"))?.characters[String(SEEROTH)]).toBeUndefined();
  routes[ROSTER] = rosterWith({ [SEEROTH]: 15 });
  await run(T12);
  expect(await store.get("levelups")).toBeNull();
  expect((await store.get<GuildRecord>("guild"))?.members.find((m) => m.id === SEEROTH)).toMatchObject({
    former: false, leftAt: null, level: 15,
  });
});

test("new member whose first fetch fails gets no events for levels before joining", async () => {
  routes[ROSTER] = rosterWith({ [SEEROTH]: 56 });
  Object.assign(routes, characterRoutes(SEE_BASE, { id: SEEROTH, level: 60 }));
  routes[`${SEE_BASE}/equipment`] = { status: 429, data: null };
  await run(T10);
  routes[`${SEE_BASE}/equipment`] = loadFixture("luvia-equipment");
  await run(T11);
  expect(await store.get("levelups")).toBeNull();
  Object.assign(routes, characterRoutes(SEE_BASE, { id: SEEROTH, level: 61 }));
  await run(T12);
  expect((await store.get<LevelUpLog>("levelups"))?.events).toEqual([{ characterId: SEEROTH, level: 61, at: T12 }]);
});

test("time budget 0: nothing fetched, guild written anyway", async () => {
  const rep = await run(T10, { budgetMs: 0 });
  expect(rep).toMatchObject({ fetched: 0, skipped: 2 });
  expect((await store.get<GuildRecord>("guild"))?.members).toHaveLength(2);
  expect(await store.list("characters/")).toEqual([]);
  expect(await store.get(CHARACTER_INDEX_KEY)).toBeNull();
});

test("character index for collect-static: items, levels, recipes and login per fetched character", async () => {
  const rep = await run(T10);
  expect(Object.keys(rep.phases)).toEqual(["guild", "characters", "write"]);
  const index = await store.get<CharacterIndex>(CHARACTER_INDEX_KEY);
  const luvia = await store.get<CharacterRecord>(`characters/${LUVIA}`);
  expect(index?.[String(LUVIA)]).toMatchObject({ slug: "luvia-stav", hasProfile: true, lastLoginAt: luvia?.lastLoginAt });
  expect(index?.[String(LUVIA)].itemIds).toEqual(luvia?.equipment.filter((e) => e.itemId).map((e) => e.itemId));
  expect(index?.[String(LUVIA)].recipeIds).toEqual(luvia?.professions.flatMap((p) => p.recipeIds ?? []));
  expect(index?.[String(LUVIA)].achievementIds).toEqual(luvia?.instances?.achievements.filter((a) => a.completed).map((a) => a.id));
  expect(index?.[String(SEEROTH)]).toMatchObject({ hasProfile: false, itemIds: [] });
});

test("character index: characters not fetched keep their entry", async () => {
  await run(T10);
  const before = await store.get<CharacterIndex>(CHARACTER_INDEX_KEY);
  // Only one fits into the budget; the other keeps its entry from the previous run.
  await store.set(CHARACTER_INDEX_KEY, { ...before, [String(SEEROTH)]: { ...before![String(SEEROTH)], slug: "old" } });
  await run(T11, { budgetMs: 0 });
  expect((await store.get<CharacterIndex>(CHARACTER_INDEX_KEY))?.[String(SEEROTH)].slug).toBe("old");
  await run(T12);
  expect((await store.get<CharacterIndex>(CHARACTER_INDEX_KEY))?.[String(SEEROTH)].slug).not.toBe("old");
});

test("roster not available: error, store unchanged", async () => {
  await run(T10);
  const before = structuredClone(store.dump());
  routes[ROSTER] = { status: 503, data: null };
  await expect(run(T11)).rejects.toThrow("503");
  expect(store.dump()).toEqual(before);
});

test("guild slug with umlaut is encoded", async () => {
  await run(T10);
  expect(fake.calls).toContain("/data/wow/guild/b%C3%A4renklaue");
  expect(fake.calls).toContain("/data/wow/guild/b%C3%A4renklaue/roster");
});

// Second guild, derived from the main guild fixtures.
const BRELDA = 401669;
const BRELDA_BASE = "/profile/wow/character/brelda-graskl%C3%A4nge";
const GOLD = "/data/wow/guild/goldene-b%C3%A4renklaue";
const GOLD_ROSTER = `${GOLD}/roster`;
const BOTH = { guildSlugs: ["bärenklaue", "goldene-bärenklaue"] };

function goldGuild(): ApiResult {
  const raw = loadFixture("guild");
  return {
    status: 200,
    data: { ...raw.data, id: 777, name: "Goldene Bärenklaue", slug: "goldene-bärenklaue", member_count: 19,
      faction: { type: "ALLIANCE", name: "Allianz" } },
  };
}

function withGold(ids: number[] = [BRELDA], levels: Record<number, number> = {}) {
  routes[GOLD] = goldGuild();
  routes[GOLD_ROSTER] = rosterWith(levels, ids);
}

const MAIN_GUILD_INFO = {
  slug: "bärenklaue", id: 194131, name: "Bärenklaue", faction: "HORDE", memberCount: 76, rulesetName: "Normal", main: true,
};
const GOLD_INFO = {
  slug: "goldene-bärenklaue", id: 777, name: "Goldene Bärenklaue", faction: "ALLIANCE", memberCount: 19,
  rulesetName: "Normal", main: false,
};

test("two guilds: one member list with guildSlug, guilds with the main guild first", async () => {
  withGold();
  const rep = await run(T10, BOTH);
  expect(rep).toMatchObject({ fetched: 3, failed: 0, guildErrors: [] });
  const guild = await store.get<GuildRecord>("guild");
  expect(guild).toMatchObject({ id: 194131, name: "Bärenklaue", faction: "HORDE", memberCount: 76, rulesetName: "Normal" });
  expect(guild?.guilds).toEqual([MAIN_GUILD_INFO, GOLD_INFO]);
  expect(guild?.members.map((m) => [m.id, m.guildSlug, m.former])).toEqual([
    [SEEROTH, "bärenklaue", false], [LUVIA, "bärenklaue", false], [BRELDA, "goldene-bärenklaue", false],
  ]);
  expect((await store.get<DaySnapshot>("history/2026-11-06"))?.characters[String(BRELDA)].level).toBe(11);
  expect(fake.calls).toContain(GOLD_ROSTER);
});

test.each([["guild", GOLD], ["roster", GOLD_ROSTER]])(
  "%s of the secondary guild not available: members stay active, run writes, error in the report",
  async (_, path) => {
    withGold();
    await run(T10, BOTH);
    const before = (await store.get<GuildRecord>("guild"))?.members.find((m) => m.id === BRELDA);
    routes[path] = { status: 503, data: null };
    const rep = await run(T11, BOTH);
    expect(rep.guildErrors).toEqual([{ slug: "goldene-bärenklaue", message: expect.stringContaining("503") }]);
    const guild = await store.get<GuildRecord>("guild");
    expect(guild?.fetchedAt).toBe(T11);
    expect(guild?.guilds).toEqual([MAIN_GUILD_INFO, GOLD_INFO]);
    expect(guild?.members.find((m) => m.id === BRELDA)).toEqual({ ...before, lastFetchedAt: T11 });
    expect((await store.get<DaySnapshot>("history/2026-11-06"))?.characters[String(BRELDA)]).toBeDefined();
  },
);

test("secondary guild not available on the first run: only the main guild in guilds", async () => {
  routes[GOLD] = { status: 500, data: null };
  const rep = await run(T10, BOTH);
  expect(rep.guildErrors).toHaveLength(1);
  expect((await store.get<GuildRecord>("guild"))?.guilds).toEqual([MAIN_GUILD_INFO]);
});

test.each([["guild", GUILD], ["roster", ROSTER]])(
  "%s of the main guild not available: run fails, store unchanged",
  async (_, path) => {
    withGold();
    await run(T10, BOTH);
    const before = structuredClone(store.dump());
    routes[path] = { status: 503, data: null };
    await expect(run(T11, BOTH)).rejects.toThrow("503");
    expect(store.dump()).toEqual(before);
  },
);

test("switching from the main to the second guild: stays active, only guildSlug changes, no level-ups", async () => {
  withGold();
  await run(T10, BOTH);
  const before = (await store.get<GuildRecord>("guild"))?.members.find((m) => m.id === LUVIA);
  routes[ROSTER] = rosterWith({}, [SEEROTH]);
  routes[GOLD_ROSTER] = rosterWith({ [LUVIA]: 19 }, [BRELDA, LUVIA]);
  await run(T11, BOTH);
  const luvia = (await store.get<GuildRecord>("guild"))?.members.find((m) => m.id === LUVIA);
  expect(luvia).toEqual({ ...before, guildSlug: "goldene-bärenklaue", lastFetchedAt: T11 });
  expect(await store.get("levelups")).toBeNull();
});

test("new member of the second guild: no level-ups before the first successful fetch", async () => {
  await run(T10);
  withGold([BRELDA], { [BRELDA]: 56 });
  Object.assign(routes, characterRoutes(BRELDA_BASE, { id: BRELDA, level: 60 }));
  await run(T11, BOTH);
  expect(await store.get("levelups")).toBeNull();
  Object.assign(routes, characterRoutes(BRELDA_BASE, { id: BRELDA, level: 61 }));
  await run(T12, BOTH);
  expect((await store.get<LevelUpLog>("levelups"))?.events).toEqual([{ characterId: BRELDA, level: 61, at: T12 }]);
});

test("legacy data without guildSlug and guilds is completed in the next run", async () => {
  routes[ROSTER] = rosterWith({}, [SEEROTH, LUVIA, BRELDA]);
  await run(T10);
  const legacy = (await store.get<GuildRecord>("guild"))!;
  delete legacy.guilds;
  for (const m of legacy.members) delete m.guildSlug;
  await store.set("guild", legacy);
  routes[ROSTER] = rosterWith({}, [SEEROTH, LUVIA]);
  withGold([]);
  await run(T11, BOTH);
  const guild = await store.get<GuildRecord>("guild");
  expect(guild?.guilds).toEqual([MAIN_GUILD_INFO, GOLD_INFO]);
  expect(guild?.members.map((m) => [m.id, m.guildSlug, m.former])).toEqual([
    [SEEROTH, "bärenklaue", false], [LUVIA, "bärenklaue", false], [BRELDA, "bärenklaue", true],
  ]);
});

test("dungeon and raid progress is stored, 404 keeps the previous state per part", async () => {
  await run(T10);
  const before = await store.get<CharacterRecord>(`characters/${LUVIA}`);
  expect(before?.instances?.achievements).toEqual([{ id: 62031, completed: false, criteria: [230766, 230760] }]);
  expect(before?.instances?.bossKills).toHaveLength(2);

  routes[`${LUVIA_BASE}/achievements/statistics`] = { status: 404, data: null };
  routes[`${LUVIA_BASE}/achievements`] = {
    status: 200,
    data: { achievements: [{ id: 62031, criteria: { id: 1, is_completed: false, child_criteria: [{ id: 230763, is_completed: true }] } }] },
  };
  await run(T11);
  const partial = await store.get<CharacterRecord>(`characters/${LUVIA}`);
  expect(partial?.instances?.achievements).toEqual([{ id: 62031, completed: false, criteria: [230763] }]);
  expect(partial?.instances?.bossKills).toEqual(before?.instances?.bossKills);

  routes[`${LUVIA_BASE}/achievements`] = { status: 404, data: null };
  await run(T12);
  const both = await store.get<CharacterRecord>(`characters/${LUVIA}`);
  expect(both?.instances).toEqual(partial?.instances);
});

test("reputation is stored, 404 keeps the previous state", async () => {
  await run(T10);
  const before = await store.get<CharacterRecord>(`characters/${LUVIA}`);
  expect(before?.reputations).toHaveLength(11);
  routes[`${LUVIA_BASE}/reputations`] = { status: 404, data: null };
  await run(T11);
  expect((await store.get<CharacterRecord>(`characters/${LUVIA}`))?.reputations).toEqual(before?.reputations);
});

test("changed login time is recorded as activity of the week, the first run only as baseline", async () => {
  const rep1 = await run(T10);
  expect(rep1.logins).toBe(0);
  expect(await store.list("activity/")).toEqual([]);
  const rep2 = await run(T11);
  expect(rep2.logins).toBe(0);

  // Monday, 2026-11-16, 20:10 Berlin time
  const login = Date.parse("2026-11-16T19:10:00.000Z");
  Object.assign(routes, characterRoutes(LUVIA_BASE));
  routes[LUVIA_BASE] = { status: 200, data: { ...loadFixture("luvia-profile").data, last_login_timestamp: login } };
  const rep3 = await run("2026-11-16T20:00:00.000Z");
  expect(rep3.logins).toBe(1);
  const week = await store.get<ActivityWeek>("activity/2026-W47");
  expect(week?.characters).toEqual({ [String(LUVIA)]: [20] });
  // The fixture login is long ago: Luvia counts as a returner with the break in days.
  const before = loadFixture("luvia-profile").data.last_login_timestamp as number;
  expect(week?.returns).toEqual({ [String(LUVIA)]: Math.floor((login - before) / 86_400_000) });
  const rep4 = await run("2026-11-16T21:00:00.000Z");
  expect(rep4.logins).toBe(0);
});

test("deaths, dungeons entered and recipe count end up in the record and the daily snapshot", async () => {
  await run(T10);
  const record = await store.get<CharacterRecord>(`characters/${LUVIA}`);
  expect(record?.stats).toEqual({ deaths: 4, dungeonsEntered: 2 });
  const snap = await store.get<DaySnapshot>("history/2026-11-06");
  const luvia = snap?.characters[String(LUVIA)];
  expect(luvia).toMatchObject({ deaths: 4, dungeons: 2 });
  expect(luvia?.recipes).toBe(record?.professions.reduce((n, p) => n + p.recipes.length, 0));
  expect(snap?.characters[String(SEEROTH)]).not.toHaveProperty("deaths");
  const completed = record?.instances?.achievements.filter((x) => x.completed).length;
  const tiers = record?.reputations?.reduce((sum, r) => sum + r.tier, 0);
  expect(luvia).toMatchObject({ achievements: completed, reputation: tiers });
  expect(tiers).toBeGreaterThan(0);

  routes[`${LUVIA_BASE}/achievements/statistics`] = { status: 404, data: null };
  await run(T11);
  expect((await store.get<CharacterRecord>(`characters/${LUVIA}`))?.stats).toEqual({ deaths: 4, dungeonsEntered: 2 });
});

test("account-wide achievements count only for the main character, alt rank from the configuration", async () => {
  const done = (id: number) => ({ id, criteria: { id: 1, is_completed: true } });
  routes[`${LUVIA_BASE}/achievements`] = { status: 200, data: { achievements: [done(62031), done(627), done(1176)] } };
  await store.set("static/achievement-account-wide", { "62031": true, "627": false });
  await run(T10);
  const luvia = async () => (await store.get<GuildRecord>("guild"))?.members.find((m) => m.id === LUVIA);
  // Without alt ranks everything counts.
  expect((await luvia())?.achievementCount).toBe(3);
  const rank = (await luvia())!.rank;
  await run(T11, { twinkRanks: { ["bärenklaue".normalize("NFC")]: [rank] } });
  expect(await luvia()).toMatchObject({ achievementCount: 2, achievementsTwink: true });
  expect((await store.get<DaySnapshot>("history/2026-11-06"))?.characters[String(LUVIA)]).toMatchObject({ achievements: 2, achievementsTwink: true });
  await run(T12, { twinkRanks: { ["bärenklaue".normalize("NFC")]: [rank + 1] } });
  expect(await luvia()).toMatchObject({ achievementCount: 3, achievementsTwink: false });
  expect((await store.get<DaySnapshot>("history/2026-11-06"))?.characters[String(LUVIA)]).not.toHaveProperty("achievementsTwink");
});

test("full statistics in the record, 404 keeps the previous state", async () => {
  await run(T10);
  const before = await store.get<CharacterRecord>(`characters/${LUVIA}`);
  expect(before?.statValues?.["1197"]).toBe(1590);
  routes[`${LUVIA_BASE}/achievements/statistics`] = { status: 404, data: null };
  await run(T11);
  const after = await store.get<CharacterRecord>(`characters/${LUVIA}`);
  expect(after?.statValues).toEqual(before?.statValues);
  expect(after?.statTexts).toEqual({ "1336": "Humanoid", "1489": "Östliche Königreiche" });
});

test("every run writes the stats snapshot of the current scoring week, only characters with statistics", async () => {
  const rep = await run(T10);
  expect(rep.statsWeek).toBe("2026-11-07");
  const snapshot = await store.get<StatsSnapshot>("stats/2026-11-07");
  expect(snapshot?.takenAt).toBe(T10);
  expect(Object.keys(snapshot?.characters ?? {})).toEqual([String(LUVIA)]);
  expect(snapshot?.characters[String(LUVIA)]["60"]).toBe(4);
});

test("characters not fetched keep their last value in the stats snapshot, former members disappear", async () => {
  await run(T10);
  const snapshot = (await store.get<StatsSnapshot>("stats/2026-11-07"))?.characters;
  await run(T11, { budgetMs: 0 });
  expect((await store.get<StatsSnapshot>("stats/2026-11-07"))?.characters).toEqual(snapshot);
  expect((await store.get<StatsSnapshot>("stats/2026-11-07"))?.takenAt).toBe(T11);
  routes[ROSTER] = rosterWith({}, [SEEROTH]);
  await run(T12);
  expect((await store.get<StatsSnapshot>("stats/2026-11-07"))?.characters).toEqual({});
});

test("new characters only until shortly before the budget ends, then still writes", async () => {
  // Each request costs 100 ms on the fake clock; Date.now() stands still otherwise.
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    const start = Date.parse(T10);
    vi.setSystemTime(start);
    const all = loadFixture("roster").data.members.map((m: { character: { id: number } }) => m.character.id);
    routes[ROSTER] = rosterWith({}, all);
    const profileStarts: number[] = [];
    const slow = {
      async get(path: string, ns: Parameters<typeof fake.get>[1]) {
        if (/^\/profile\/wow\/character\/[^/]+$/.test(path)) profileStarts.push(Date.now() - start);
        vi.setSystemTime(Date.now() + 100);
        return fake.get(path, ns);
      },
    };
    const budgetMs = 3000;
    const rep = await runGuildCollection({ client: slow, store, config: { ...config, budgetMs }, now: () => new Date(T10) });
    expect(rep.skipped).toBeGreaterThan(0);
    expect(Math.max(...profileStarts)).toBeLessThan(budgetMs * (1 - END_RESERVE_SHARE));
    expect(rep.durationMs).toBeLessThanOrEqual(budgetMs);
  } finally {
    vi.useRealTimers();
  }
});
