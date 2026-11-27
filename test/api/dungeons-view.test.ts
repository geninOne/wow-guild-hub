import { describe, expect, test } from "vitest";
import { buildGuildDungeons } from "../../src/api/dungeons-view";
import { handleApi } from "../../src/api/router";
import type { GuildDungeonsView } from "../../src/api/types";
import { EXTRA_DUNGEONS, type ExtraDungeon } from "../../src/instance-images";
import type { CharacterRecord, GuildRecord, InstanceAchievementsRecord, InstanceProgress, MemberSummary } from "../../src/model";
import { createMemoryStore } from "../../src/store";

function member(over: Partial<MemberSummary>): MemberSummary {
  return {
    id: 1, name: "Test", surname: null, slug: "test", rank: 0, level: 30, classId: 1, raceId: 1,
    hasProfile: true, former: false, firstSeenAt: "2026-11-01T00:00:00.000Z", leftAt: null,
    lastFetchedAt: "2026-11-06T10:00:00.000Z", equippedItemLevel: null, mainSpecName: null,
    professions: [], ...over,
  };
}

const guild: GuildRecord = {
  fetchedAt: "2026-11-21T10:00:00.000Z", id: 1, name: "Bärenklaue", faction: "HORDE", memberCount: 3, rulesetName: "Classic",
  members: [
    member({ id: 1, name: "Anna", slug: "anna", guildSlug: "bärenklaue" }),
    member({ id: 2, name: "Bodo", slug: "bodo", guildSlug: "goldene-bärenklaue" }),
    member({ id: 3, name: "Cleo", slug: "cleo", guildSlug: "bärenklaue" }),
  ],
  guilds: [
    { slug: "bärenklaue", id: 1, name: "Bärenklaue", faction: "HORDE", memberCount: 2, rulesetName: "Classic", main: true },
    { slug: "goldene-bärenklaue", id: 2, name: "Goldene Bärenklaue", faction: "ALLIANCE", memberCount: 1, rulesetName: "Classic", main: false },
  ],
};

const defs: InstanceAchievementsRecord = {
  achievements: [
    {
      id: 10, name: "Novize: Dungeons", kind: "dungeon", order: 0, rootDescription: null,
      criteria: [
        { id: 101, description: "Flammenschlund oder Halle der Thanen" },
        { id: 102, description: "Todesminen" },
        { id: 103, description: "Maraudon" },
      ],
    },
    { id: 20, name: "Onyxia", kind: "raid", order: 0, rootDescription: "Tötet Onyxia", criteria: [] },
  ],
};

function record(id: number, instances: InstanceProgress): CharacterRecord {
  return {
    id, name: `C${id}`, surname: null, slug: `c${id}`, fetchedAt: "2026-11-06T10:00:00.000Z",
    hasProfile: true, level: 30, classId: 1, raceId: 1, className: null, raceName: null, gender: null,
    rulesetName: null, equippedItemLevel: null, lastLoginAt: null, media: null, equipment: [],
    specs: [], mainSpecId: null, professions: [], raidsRaw: null, instances,
  };
}

const records = [
  // Anna: Flammenschlund three times, Todesminen once (kills); the Todesminen criterion applies to her whole account
  record(1, {
    achievements: [{ id: 10, completed: false, criteria: [102] }],
    bossKills: [
      { boss: "Bazzalan", instance: "Flammenschlund", quantity: 3, lastAt: "2026-11-10T10:00:00.000Z" },
      { boss: "Edwin van Cleef", instance: "Todesminen", quantity: 1, lastAt: "2026-11-09T10:00:00.000Z" },
    ],
  }),
  // Bodo (Alliance): the Alliance counterpart once
  record(2, {
    achievements: [],
    bossKills: [{ boss: "Durgen Dirgehammer", instance: "Halle der Thanen", quantity: 1, lastAt: "2026-11-12T10:00:00.000Z" }],
  }),
  // Cleo: nothing
  record(3, { achievements: [], bossKills: [] }),
];

describe("buildGuildDungeons", () => {
  test("image matches the displayed name, even if the first character only played the counterpart", () => {
    const tiles = { "226": "https://render.worldofwarcraft.com/eu/zones/ragefire-chasm-small.jpg" };
    const hallOnly = buildGuildDungeons(guild, [records[1]], defs, tiles, null).dungeons[0];
    expect(hallOnly).toMatchObject({ name: "Halle der Thanen", image: "/dungeons/halle-der-thanen.jpg" });
    const both = buildGuildDungeons(guild, [records[1], records[0]], defs, tiles, null).dungeons[0];
    expect(both).toMatchObject({ name: "Flammenschlund oder Halle der Thanen", image: tiles["226"] });
  });

  test("counterparts of both factions count together, record holder and guild frontier", () => {
    const v = buildGuildDungeons(guild, records, defs, null, null);
    expect(v).toMatchObject({ available: true, characters: 3, guild: null });
    const [ragefire, deadmines, maraudon] = v.dungeons;
    expect(ragefire).toMatchObject({
      key: "flammenschlund", name: "Flammenschlund oder Halle der Thanen", tier: "Novize", completed: 2, timesCompleted: 4,
      lastAt: "2026-11-12T10:00:00.000Z",
    });
    expect(ragefire.best).toMatchObject({ character: { name: "Anna" }, times: 3 });
    expect(deadmines).toMatchObject({ name: "Todesminen", completed: 1, timesCompleted: 1, best: { character: { name: "Anna" }, times: 1 } });
    expect(maraudon).toMatchObject({ completed: 0 });
    expect(v.raids).toEqual([{ name: "Onyxia", image: null, levels: expect.anything(), completed: 0, bosses: [{ name: "Onyxia", defeated: 0 }], who: [] }]);
    expect(v.frontier).toMatchObject({ dungeon: "Todesminen", characters: [{ name: "Anna" }] });
  });

  test("member list: who completed it, with final boss victories, most first; raids with defeated bosses", () => {
    const onyxia = record(3, {
      achievements: [],
      bossKills: [{ boss: "Onyxia", instance: "Onyxias Hort", quantity: 2, lastAt: "2026-11-14T10:00:00.000Z" }],
    });
    const v = buildGuildDungeons(guild, [records[0], records[1], onyxia], defs, null, null);
    const [ragefire, deadmines, maraudon] = v.dungeons;
    expect(ragefire.who).toEqual([[1, 3], [2, 1]]);
    expect(deadmines.who).toEqual([[1, 1]]);
    expect(maraudon.who).toEqual([]);
    expect(v.raids[0]).toMatchObject({ name: "Onyxia", who: [[3, 1]] });
    expect(buildGuildDungeons(guild, records, defs, null, "goldene-bärenklaue").dungeons[0].who).toEqual([[2, 1]]);
  });

  test("guild filter: Horde sees only Flammenschlund, Alliance only Halle der Thanen", () => {
    const horde = buildGuildDungeons(guild, records, defs, null, "bärenklaue");
    expect(horde.characters).toBe(2);
    expect(horde.dungeons[0]).toMatchObject({ name: "Flammenschlund", completed: 1, timesCompleted: 3 });
    const alliance = buildGuildDungeons(guild, records, defs, null, "goldene-bärenklaue");
    expect(alliance.dungeons[0]).toMatchObject({ name: "Halle der Thanen", completed: 1 });
    expect(alliance.frontier).toMatchObject({ characters: [{ name: "Bodo" }] });
  });

  test("alt with the same account-wide achievements does not count twice", () => {
    // Cleo is an alt on Anna's account: Blizzard delivers the same criteria and achievements, but no own victories.
    const twink = record(3, { achievements: records[0].instances!.achievements, bossKills: [] });
    const v = buildGuildDungeons(guild, [records[0], twink], defs, null, null);
    const [ragefire, deadmines] = v.dungeons;
    expect([ragefire.completed, ragefire.who]).toEqual([1, [[1, 3]]]);
    expect([deadmines.completed, deadmines.who]).toEqual([1, [[1, 1]]]);
    expect(v.frontier).toMatchObject({ dungeon: "Todesminen", characters: [{ name: "Anna" }] });
  });

  test("not available without definitions", () => {
    expect(buildGuildDungeons(guild, records, null, null, null)).toMatchObject({ available: false, dungeons: [], raids: [] });
  });
});

describe("extra dungeons", () => {
  const stockade: ExtraDungeon = {
    name: "Das Verlies", tier: "Novize", info: { levels: [24, 32], bosses: ["Bazil Thredd"], statisticEntries: [], withoutStatistic: false },
    source: { instance: "Verlies von Stormwind", finalBoss: "Bazil Thredd" }, image: null, faction: null, replaces: [],
  };
  const thredd = (id: number, quantity: number) =>
    record(id, { achievements: [], bossKills: [{ boss: "Bazil Thredd", instance: "Verlies von Stormwind", quantity, lastAt: "2026-11-15T12:00:00.000Z" }] });

  test("appears by minimum level, counts completions and opens the member list", () => {
    const v = buildGuildDungeons(guild, [records[0], thredd(2, 3), thredd(3, 1)], defs, null, null, [stockade]);
    expect(v.dungeons.map((d) => d.name)).toEqual(["Flammenschlund", "Todesminen", "Das Verlies", "Maraudon"]);
    expect(v.dungeons[2]).toMatchObject({
      key: "verlies", tier: "Novize", completed: 2, timesCompleted: 4, levels: { min: 24, max: 32 }, who: [[2, 3], [3, 1]],
      best: { character: { name: "Bodo" }, times: 3 },
    });
    // Guild frontier: the dungeon with the highest minimum level that someone has completed.
    expect(v.frontier).toMatchObject({ dungeon: "Das Verlies", characters: [{ name: "Bodo" }, { name: "Cleo" }] });
  });

  test("0 completions without data", () => {
    const v = buildGuildDungeons(guild, records, defs, null, null, [stockade]);
    expect(v.dungeons.find((d) => d.key === "verlies")).toMatchObject({ completed: 0, timesCompleted: 0, who: [], best: null });
    expect(v.frontier).toMatchObject({ dungeon: "Todesminen" });
  });
});

describe("faction counterparts sharing one criterion stay separate", () => {
  test("own completions, image and member list per faction", () => {
    // Bodo (Alliance) also has the mirrored Bazzalan in his statistics.
    const bodo = record(2, {
      achievements: [],
      bossKills: [
        { boss: "Bazzalan", instance: "Flammenschlund", quantity: 1, lastAt: "2026-11-12T10:00:00.000Z" },
        { boss: "Durgen Dirgehammer", instance: "Halle der Thanen", quantity: 1, lastAt: "2026-11-12T10:00:00.000Z" },
      ],
    });
    const tiles = { "226": "https://render.worldofwarcraft.com/eu/zones/ragefire-chasm-small.jpg" };
    const v = buildGuildDungeons(guild, [records[0], bodo, records[2]], defs, tiles, null, EXTRA_DUNGEONS);
    const [ragefire, hall] = v.dungeons;
    expect(ragefire).toMatchObject({ key: "flammenschlund", name: "Flammenschlund", completed: 1, timesCompleted: 3, who: [[1, 3]], image: tiles["226"] });
    expect(hall).toMatchObject({ key: "halle der thanen", name: "Halle der Thanen", completed: 1, timesCompleted: 1, who: [[2, 1]], image: "/dungeons/halle-der-thanen.jpg" });
    expect(v.dungeons.map((d) => d.name)).not.toContain("Flammenschlund oder Halle der Thanen");
  });
});

describe("/api/dungeons", () => {
  test("delivers the guild, filters via ?gilde= and knows no foreign guilds", async () => {
    const store = createMemoryStore();
    await store.set("guild", guild);
    await store.set("static/instance-achievements", defs);
    for (const r of records) await store.set(`characters/${r.id}`, r);
    const get = (path: string) => handleApi(new Request(`http://x${path}`), store, () => new Date("2026-11-21T12:00:00Z"));
    const all = (await (await get("/api/dungeons")).json()) as GuildDungeonsView;
    expect(all.dungeons.slice(0, 2).map((d) => [d.name, d.completed])).toEqual([["Flammenschlund", 1], ["Halle der Thanen", 1]]);
    expect(all.dungeons.map((d) => d.name)).toContain("Das Verlies");
    const horde = (await (await get(`/api/dungeons?gilde=${encodeURIComponent("bärenklaue")}`)).json()) as GuildDungeonsView;
    expect(horde).toMatchObject({ guild: "bärenklaue", characters: 2 });
    expect((await get("/api/dungeons?gilde=quatsch")).status).toBe(404);
    expect(await (await get(`/api/dungeons?guild=${encodeURIComponent("bärenklaue")}`)).json()).toEqual(horde);
    expect((await get("/api/dungeons/x")).status).toBe(404);
  });
});
