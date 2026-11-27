import { beforeEach, expect, test, vi } from "vitest";
import type { ApiResult } from "../../src/blizzard/client";
import { END_RESERVE_SHARE } from "../../src/collect/budget";
import { runGuildCollection } from "../../src/collect/guild";
import type { Config } from "../../src/config";
import { CHARACTER_INDEX_KEY } from "../../src/collect/character-index";
import type { ActivityWeek, CharacterIndex, CharacterRecord, DaySnapshot, GuildRecord, LevelUpLog } from "../../src/model";
import { createMemoryStore } from "../../src/store";
import type { StatsStand } from "../../src/stats/stand";
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

/** Luvia-Daten unter fremder Basis, optional mit anderer ID und anderem Level. */
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

test("erster Lauf legt Charaktere, Gilde und Tagesstand an, aber keine Aufstiege", async () => {
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

test("zweiter Lauf mit Level 23 hält 22 und 23 mit demselben Zeitpunkt fest", async () => {
  await run(T10);
  Object.assign(routes, characterRoutes(LUVIA_BASE, { level: 23 }));
  const rep = await run(T11);
  expect(rep.levelUps).toBe(2);
  expect((await store.get<LevelUpLog>("levelups"))?.events).toEqual([
    { characterId: LUVIA, level: 22, at: T11 },
    { characterId: LUVIA, level: 23, at: T11 },
  ]);
});

test("Fehler bei einem Teilabruf: alter Stand bleibt, Rest läuft weiter", async () => {
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
] as const)("Teilabruf %s liefert 404 bei vorhandenem Profil: vorheriger Stand dieses Teils bleibt", async (feld, pfad) => {
  await run(T10);
  const vorher = await store.get<CharacterRecord>(`characters/${LUVIA}`);
  expect(vorher?.[feld].length).toBeGreaterThan(0);
  routes[`${LUVIA_BASE}${pfad}`] = { status: 404, data: null };
  const rep = await run(T11);
  expect(rep).toMatchObject({ fetched: 2, failed: 0 });
  const nachher = await store.get<CharacterRecord>(`characters/${LUVIA}`);
  expect(nachher?.fetchedAt).toBe(T11);
  expect(nachher?.[feld]).toEqual(vorher?.[feld]);
  expect(nachher?.mainSpecId).toBe(vorher?.mainSpecId);
  expect(nachher?.equipment.length).toBeGreaterThan(0);
});

test("Teilabruf 404 ohne vorherigen Stand bleibt leer", async () => {
  routes[`${LUVIA_BASE}/equipment`] = { status: 404, data: null };
  await run(T10);
  expect((await store.get<CharacterRecord>(`characters/${LUVIA}`))?.equipment).toEqual([]);
});

test("Charakterbild 404 ist normal und wird null, auch wenn es vorher da war", async () => {
  await run(T10);
  expect((await store.get<CharacterRecord>(`characters/${LUVIA}`))?.media).not.toBeNull();
  routes[`${LUVIA_BASE}/character-media`] = { status: 404, data: null };
  await run(T11);
  expect((await store.get<CharacterRecord>(`characters/${LUVIA}`))?.media).toBeNull();
});

test("Profil verschwindet: reicher Datensatz bleibt erhalten", async () => {
  await run(T10);
  delete routes[LUVIA_BASE];
  const rep = await run(T11);
  expect(rep.failed).toBe(1);
  const rec = await store.get<CharacterRecord>(`characters/${LUVIA}`);
  expect([rec?.hasProfile, rec?.fetchedAt]).toEqual([true, T10]);
  expect((await store.get<GuildRecord>("guild"))?.members.find((m) => m.id === LUVIA)?.hasProfile).toBe(true);
});

test("Wechsel von Roster- auf Profilquelle erzeugt keine doppelten Aufstiege", async () => {
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

test("Rückkehrer mit höherem Level bekommt keine Ereignisse für die Abwesenheit", async () => {
  await run(T10);
  routes[ROSTER] = rosterWith({}, [LUVIA]);
  await run(T11);
  const nachAustritt = await store.get<GuildRecord>("guild");
  expect(nachAustritt?.members.find((m) => m.id === SEEROTH)).toMatchObject({ former: true, leftAt: T11 });
  expect((await store.get<DaySnapshot>("history/2026-11-06"))?.characters[String(SEEROTH)]).toBeUndefined();
  routes[ROSTER] = rosterWith({ [SEEROTH]: 15 });
  await run(T12);
  expect(await store.get("levelups")).toBeNull();
  expect((await store.get<GuildRecord>("guild"))?.members.find((m) => m.id === SEEROTH)).toMatchObject({
    former: false, leftAt: null, level: 15,
  });
});

test("neues Mitglied, dessen erster Abruf scheitert, bekommt keine Ereignisse für Level vor dem Beitritt", async () => {
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

test("Zeitbudget 0: nichts geholt, Gilde trotzdem geschrieben", async () => {
  const rep = await run(T10, { budgetMs: 0 });
  expect(rep).toMatchObject({ fetched: 0, skipped: 2 });
  expect((await store.get<GuildRecord>("guild"))?.members).toHaveLength(2);
  expect(await store.list("characters/")).toEqual([]);
  expect(await store.get(CHARACTER_INDEX_KEY)).toBeNull();
});

test("Charakterindex für collect-static: Gegenstände, Stufen, Rezepte und Login je geholtem Charakter", async () => {
  const rep = await run(T10);
  expect(Object.keys(rep.phases)).toEqual(["guild", "characters", "write"]);
  const index = await store.get<CharacterIndex>(CHARACTER_INDEX_KEY);
  const luvia = await store.get<CharacterRecord>(`characters/${LUVIA}`);
  expect(index?.[String(LUVIA)]).toMatchObject({ slug: "luvia-stav", hasProfile: true, lastLoginAt: luvia?.lastLoginAt });
  expect(index?.[String(LUVIA)].itemIds).toEqual(luvia?.equipment.filter((e) => e.itemId).map((e) => e.itemId));
  expect(index?.[String(LUVIA)].recipeIds).toEqual(luvia?.professions.flatMap((p) => p.recipeIds ?? []));
  expect(index?.[String(SEEROTH)]).toMatchObject({ hasProfile: false, itemIds: [] });
});

test("Charakterindex: nicht geholte Charaktere behalten ihren Eintrag", async () => {
  await run(T10);
  const before = await store.get<CharacterIndex>(CHARACTER_INDEX_KEY);
  // Nur einer passt ins Budget; der andere behält seinen Eintrag aus dem vorigen Lauf.
  await store.set(CHARACTER_INDEX_KEY, { ...before, [String(SEEROTH)]: { ...before![String(SEEROTH)], slug: "alt" } });
  await run(T11, { budgetMs: 0 });
  expect((await store.get<CharacterIndex>(CHARACTER_INDEX_KEY))?.[String(SEEROTH)].slug).toBe("alt");
  await run(T12);
  expect((await store.get<CharacterIndex>(CHARACTER_INDEX_KEY))?.[String(SEEROTH)].slug).not.toBe("alt");
});

test("Roster nicht abrufbar: Fehler, Speicher unverändert", async () => {
  await run(T10);
  const vorher = structuredClone(store.dump());
  routes[ROSTER] = { status: 503, data: null };
  await expect(run(T11)).rejects.toThrow("503");
  expect(store.dump()).toEqual(vorher);
});

test("Gildenslug mit Umlaut wird kodiert", async () => {
  await run(T10);
  expect(fake.calls).toContain("/data/wow/guild/b%C3%A4renklaue");
  expect(fake.calls).toContain("/data/wow/guild/b%C3%A4renklaue/roster");
});

// Zweite Gilde, aus den Bärenklaue-Fixtures abgeleitet.
const BRELDA = 401669;
const BRELDA_BASE = "/profile/wow/character/brelda-graskl%C3%A4nge";
const GOLD = "/data/wow/guild/goldene-b%C3%A4renklaue";
const GOLD_ROSTER = `${GOLD}/roster`;
const BEIDE = { guildSlugs: ["bärenklaue", "goldene-bärenklaue"] };

function goldGuild(): ApiResult {
  const raw = loadFixture("guild");
  return {
    status: 200,
    data: { ...raw.data, id: 777, name: "Goldene Bärenklaue", slug: "goldene-bärenklaue", member_count: 19,
      faction: { type: "ALLIANCE", name: "Allianz" } },
  };
}

function mitGold(ids: number[] = [BRELDA], levels: Record<number, number> = {}) {
  routes[GOLD] = goldGuild();
  routes[GOLD_ROSTER] = rosterWith(levels, ids);
}

const BAERENKLAUE_INFO = {
  slug: "bärenklaue", id: 194131, name: "Bärenklaue", faction: "HORDE", memberCount: 76, rulesetName: "Normal", main: true,
};
const GOLD_INFO = {
  slug: "goldene-bärenklaue", id: 777, name: "Goldene Bärenklaue", faction: "ALLIANCE", memberCount: 19,
  rulesetName: "Normal", main: false,
};

test("zwei Gilden: eine Mitgliederliste mit guildSlug, guilds mit Hauptgilde zuerst", async () => {
  mitGold();
  const rep = await run(T10, BEIDE);
  expect(rep).toMatchObject({ fetched: 3, failed: 0, guildErrors: [] });
  const guild = await store.get<GuildRecord>("guild");
  expect(guild).toMatchObject({ id: 194131, name: "Bärenklaue", faction: "HORDE", memberCount: 76, rulesetName: "Normal" });
  expect(guild?.guilds).toEqual([BAERENKLAUE_INFO, GOLD_INFO]);
  expect(guild?.members.map((m) => [m.id, m.guildSlug, m.former])).toEqual([
    [SEEROTH, "bärenklaue", false], [LUVIA, "bärenklaue", false], [BRELDA, "goldene-bärenklaue", false],
  ]);
  expect((await store.get<DaySnapshot>("history/2026-11-06"))?.characters[String(BRELDA)].level).toBe(11);
  expect(fake.calls).toContain(GOLD_ROSTER);
});

test.each([["Gilde", GOLD], ["Roster", GOLD_ROSTER]])(
  "%s der Nebengilde nicht abrufbar: Mitglieder bleiben aktiv, Lauf schreibt, Fehler im Bericht",
  async (_, pfad) => {
    mitGold();
    await run(T10, BEIDE);
    const vorher = (await store.get<GuildRecord>("guild"))?.members.find((m) => m.id === BRELDA);
    routes[pfad] = { status: 503, data: null };
    const rep = await run(T11, BEIDE);
    expect(rep.guildErrors).toEqual([{ slug: "goldene-bärenklaue", message: expect.stringContaining("503") }]);
    const guild = await store.get<GuildRecord>("guild");
    expect(guild?.fetchedAt).toBe(T11);
    expect(guild?.guilds).toEqual([BAERENKLAUE_INFO, GOLD_INFO]);
    expect(guild?.members.find((m) => m.id === BRELDA)).toEqual({ ...vorher, lastFetchedAt: T11 });
    expect((await store.get<DaySnapshot>("history/2026-11-06"))?.characters[String(BRELDA)]).toBeDefined();
  },
);

test("Nebengilde schon beim ersten Lauf nicht abrufbar: nur die Hauptgilde in guilds", async () => {
  routes[GOLD] = { status: 500, data: null };
  const rep = await run(T10, BEIDE);
  expect(rep.guildErrors).toHaveLength(1);
  expect((await store.get<GuildRecord>("guild"))?.guilds).toEqual([BAERENKLAUE_INFO]);
});

test.each([["Gilde", GUILD], ["Roster", ROSTER]])(
  "%s der Hauptgilde nicht abrufbar: Lauf scheitert, Speicher unverändert",
  async (_, pfad) => {
    mitGold();
    await run(T10, BEIDE);
    const vorher = structuredClone(store.dump());
    routes[pfad] = { status: 503, data: null };
    await expect(run(T11, BEIDE)).rejects.toThrow("503");
    expect(store.dump()).toEqual(vorher);
  },
);

test("Wechsel von Bärenklaue zu Goldene Bärenklaue: bleibt aktiv, nur guildSlug ändert sich, keine Aufstiege", async () => {
  mitGold();
  await run(T10, BEIDE);
  const vorher = (await store.get<GuildRecord>("guild"))?.members.find((m) => m.id === LUVIA);
  routes[ROSTER] = rosterWith({}, [SEEROTH]);
  routes[GOLD_ROSTER] = rosterWith({ [LUVIA]: 19 }, [BRELDA, LUVIA]);
  await run(T11, BEIDE);
  const luvia = (await store.get<GuildRecord>("guild"))?.members.find((m) => m.id === LUVIA);
  expect(luvia).toEqual({ ...vorher, guildSlug: "goldene-bärenklaue", lastFetchedAt: T11 });
  expect(await store.get("levelups")).toBeNull();
});

test("neues Mitglied der zweiten Gilde: keine Aufstiege vor dem ersten erfolgreichen Abruf", async () => {
  await run(T10);
  mitGold([BRELDA], { [BRELDA]: 56 });
  Object.assign(routes, characterRoutes(BRELDA_BASE, { id: BRELDA, level: 60 }));
  await run(T11, BEIDE);
  expect(await store.get("levelups")).toBeNull();
  Object.assign(routes, characterRoutes(BRELDA_BASE, { id: BRELDA, level: 61 }));
  await run(T12, BEIDE);
  expect((await store.get<LevelUpLog>("levelups"))?.events).toEqual([{ characterId: BRELDA, level: 61, at: T12 }]);
});

test("Altdaten ohne guildSlug und guilds werden im nächsten Lauf ergänzt", async () => {
  routes[ROSTER] = rosterWith({}, [SEEROTH, LUVIA, BRELDA]);
  await run(T10);
  const alt = (await store.get<GuildRecord>("guild"))!;
  delete alt.guilds;
  for (const m of alt.members) delete m.guildSlug;
  await store.set("guild", alt);
  routes[ROSTER] = rosterWith({}, [SEEROTH, LUVIA]);
  mitGold([]);
  await run(T11, BEIDE);
  const guild = await store.get<GuildRecord>("guild");
  expect(guild?.guilds).toEqual([BAERENKLAUE_INFO, GOLD_INFO]);
  expect(guild?.members.map((m) => [m.id, m.guildSlug, m.former])).toEqual([
    [SEEROTH, "bärenklaue", false], [LUVIA, "bärenklaue", false], [BRELDA, "bärenklaue", true],
  ]);
});

test("Dungeon- und Raidfortschritt wird gespeichert, 404 behält den vorigen Stand je Teil", async () => {
  await run(T10);
  const vorher = await store.get<CharacterRecord>(`characters/${LUVIA}`);
  expect(vorher?.instances?.achievements).toEqual([{ id: 62031, completed: false, criteria: [230766, 230760] }]);
  expect(vorher?.instances?.bossKills).toHaveLength(2);

  routes[`${LUVIA_BASE}/achievements/statistics`] = { status: 404, data: null };
  routes[`${LUVIA_BASE}/achievements`] = {
    status: 200,
    data: { achievements: [{ id: 62031, criteria: { id: 1, is_completed: false, child_criteria: [{ id: 230763, is_completed: true }] } }] },
  };
  await run(T11);
  const teil = await store.get<CharacterRecord>(`characters/${LUVIA}`);
  expect(teil?.instances?.achievements).toEqual([{ id: 62031, completed: false, criteria: [230763] }]);
  expect(teil?.instances?.bossKills).toEqual(vorher?.instances?.bossKills);

  routes[`${LUVIA_BASE}/achievements`] = { status: 404, data: null };
  await run(T12);
  const beide = await store.get<CharacterRecord>(`characters/${LUVIA}`);
  expect(beide?.instances).toEqual(teil?.instances);
});

test("Ruf wird gespeichert, 404 behält den vorigen Stand", async () => {
  await run(T10);
  const vorher = await store.get<CharacterRecord>(`characters/${LUVIA}`);
  expect(vorher?.reputations).toHaveLength(11);
  routes[`${LUVIA_BASE}/reputations`] = { status: 404, data: null };
  await run(T11);
  expect((await store.get<CharacterRecord>(`characters/${LUVIA}`))?.reputations).toEqual(vorher?.reputations);
});

test("geänderter Login-Zeitpunkt wird als Aktivität der Woche festgehalten, der erste Lauf nur als Basislinie", async () => {
  const rep1 = await run(T10);
  expect(rep1.logins).toBe(0);
  expect(await store.list("activity/")).toEqual([]);
  const rep2 = await run(T11);
  expect(rep2.logins).toBe(0);

  // Montag, 16.11.2026, 20:10 Uhr Berliner Zeit
  const login = Date.parse("2026-11-16T19:10:00.000Z");
  Object.assign(routes, characterRoutes(LUVIA_BASE));
  routes[LUVIA_BASE] = { status: 200, data: { ...loadFixture("luvia-profile").data, last_login_timestamp: login } };
  const rep3 = await run("2026-11-16T20:00:00.000Z");
  expect(rep3.logins).toBe(1);
  const week = await store.get<ActivityWeek>("activity/2026-W47");
  expect(week?.characters).toEqual({ [String(LUVIA)]: [20] });
  // Der Fixture-Login liegt lange zurück: Luvia gilt als Rückkehrerin mit der Pause in Tagen.
  const before = loadFixture("luvia-profile").data.last_login_timestamp as number;
  expect(week?.returns).toEqual({ [String(LUVIA)]: Math.floor((login - before) / 86_400_000) });
  const rep4 = await run("2026-11-16T21:00:00.000Z");
  expect(rep4.logins).toBe(0);
});

test("Tode, betretene Dungeons und Rezeptanzahl landen im Datensatz und im Tagesstand", async () => {
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

test("Vollständige Statistik im Datensatz, 404 behält den vorigen Stand", async () => {
  await run(T10);
  const vorher = await store.get<CharacterRecord>(`characters/${LUVIA}`);
  expect(vorher?.statValues?.["1197"]).toBe(1590);
  routes[`${LUVIA_BASE}/achievements/statistics`] = { status: 404, data: null };
  await run(T11);
  const nachher = await store.get<CharacterRecord>(`characters/${LUVIA}`);
  expect(nachher?.statValues).toEqual(vorher?.statValues);
  expect(nachher?.statTexts).toEqual({ "1336": "Humanoid", "1489": "Östliche Königreiche" });
});

test("Jeder Lauf schreibt den Statistik-Stand der laufenden Bärenklaue-Woche, nur Charaktere mit Statistik", async () => {
  const rep = await run(T10);
  expect(rep.statsWeek).toBe("2026-11-07");
  const stand = await store.get<StatsStand>("stats/2026-11-07");
  expect(stand?.takenAt).toBe(T10);
  expect(Object.keys(stand?.characters ?? {})).toEqual([String(LUVIA)]);
  expect(stand?.characters[String(LUVIA)]["60"]).toBe(4);
});

test("Nicht geholte behalten im Statistik-Stand ihren letzten Wert, Ehemalige verschwinden", async () => {
  await run(T10);
  const stand = (await store.get<StatsStand>("stats/2026-11-07"))?.characters;
  await run(T11, { budgetMs: 0 });
  expect((await store.get<StatsStand>("stats/2026-11-07"))?.characters).toEqual(stand);
  expect((await store.get<StatsStand>("stats/2026-11-07"))?.takenAt).toBe(T11);
  routes[ROSTER] = rosterWith({}, [SEEROTH]);
  await run(T12);
  expect((await store.get<StatsStand>("stats/2026-11-07"))?.characters).toEqual({});
});

test("neue Charaktere nur bis kurz vor Budgetende, danach noch Schreiben", async () => {
  // Jede Anfrage kostet 100 ms auf der vorgetäuschten Uhr; Date.now() steht sonst still.
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
