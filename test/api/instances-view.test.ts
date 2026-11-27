import { describe, expect, test } from "vitest";
import { buildInstancesView, instanceImage, raidName, type DungeonInfo, type ExtraDungeon } from "../../src/api/instances-view";
import { INSTANCE_CATEGORIES } from "../../src/collect/static";
import { DUNGEON_INFO, EXTRA_DUNGEONS, toDungeonInfo, toExtraDungeon } from "../../src/instance-images";
import type { IconMap, InstanceAchievement, InstanceAchievementsRecord, InstanceProgress } from "../../src/model";
import { loadFixture } from "../helpers/fixtures";

function def(id: number, order: number): InstanceAchievement {
  const raw = loadFixture(`achievement-${id}`).data;
  return {
    id,
    name: raw.name,
    kind: INSTANCE_CATEGORIES[raw.category.id],
    order,
    rootDescription: raw.criteria?.description ?? null,
    criteria: (raw.criteria?.child_criteria ?? []).map((c: { id: number; description: string }) => ({
      id: c.id,
      description: c.description,
    })),
  };
}

const defs: InstanceAchievementsRecord = {
  achievements: [def(62031, 0), def(64016, 3), def(62034, 0), def(684, 2)],
};

const BAZZALAN = new Date(1793887032000).toISOString();

const chordrak: InstanceProgress = {
  achievements: [{ id: 62031, completed: false, criteria: [230766, 230760] }],
  bossKills: [
    { boss: "Rath'mael", instance: "Ruinen von Lordaeron", quantity: 1, lastAt: "2026-11-05T10:00:00.000Z" },
    { boss: "Bazzalan", instance: "Flammenschlund", quantity: 1, lastAt: BAZZALAN },
  ],
};

describe("buildInstancesView", () => {
  test("not available without definitions", () => {
    expect(buildInstancesView(null, chordrak)).toEqual({ available: false, dungeonTiers: [], raids: [], otherKills: [] });
  });

  test("dungeons of tier Novize with completed dungeons and boss kills", () => {
    const v = buildInstancesView(defs, chordrak);
    expect(v.available).toBe(true);
    expect(v.dungeonTiers.map((t) => [t.tier, t.achievementId])).toEqual([["Novize", 62031]]);
    const [ragefire, ruins, wailing] = v.dungeonTiers[0].dungeons;
    expect(ragefire).toEqual({
      criterionId: 230766,
      name: "Flammenschlund",
      description: "Flammenschlund oder Halle der Thanen",
      completed: true,
      onAccount: false,
      tracked: true,
      kills: [{ boss: "Bazzalan", quantity: 1, lastAt: BAZZALAN }],
      image: null,
      levels: null,
      bosses: null,
      finalBosses: [],
      completedAt: BAZZALAN,
      timesCompleted: 1,
    });
    expect(ruins).toMatchObject({ name: "Ruinen von Lordaeron", completed: true, kills: [{ boss: "Rath'mael" }] });
    expect(wailing).toEqual({
      criterionId: 230763, name: "Höhlen des Wehklagens", description: "Höhlen des Wehklagens", completed: false, onAccount: false, tracked: true, kills: [], image: null, levels: null, bosses: null,
      finalBosses: [], completedAt: null, timesCompleted: 0,
    });
    expect(v.otherKills).toEqual([]);
  });

  test("kill in both alternatives shows the full description and counts as completed", () => {
    const v = buildInstancesView(defs, {
      achievements: [],
      bossKills: [
        { boss: "Bazzalan", instance: "Flammenschlund", quantity: 1, lastAt: null },
        { boss: "Durgen Dirgehammer", instance: "Halle der Thanen", quantity: 2, lastAt: null },
      ],
    });
    const first = v.dungeonTiers[0].dungeons[0];
    expect(first.name).toBe("Flammenschlund oder Halle der Thanen");
    // In Forever only final bosses appear in the statistics, so a kill means: completed.
    expect([first.completed, first.timesCompleted]).toEqual([true, 3]);
    expect(first.kills.map((k) => k.boss)).toEqual(["Bazzalan", "Durgen Dirgehammer"]);
  });

  test("progress only in the second series shows that one", () => {
    const v = buildInstancesView(defs, { achievements: [{ id: 64016, completed: false, criteria: [234131] }], bossKills: [] });
    expect(v.dungeonTiers[0].achievementId).toBe(64016);
    expect(v.dungeonTiers[0].dungeons.find((d) => d.criterionId === 234131)).toMatchObject({ completed: false, onAccount: true });
  });

  test("alt inherits the account-wide criteria, but only what its own statistics prove is completed", () => {
    // Same criteria as the main character (Blizzard delivers them account-wide), but no own victories.
    const twink = buildInstancesView(defs, { achievements: chordrak.achievements, bossKills: [] });
    const [ragefire, ruins, wailing] = twink.dungeonTiers[0].dungeons;
    expect([ragefire.completed, ragefire.onAccount]).toEqual([false, true]);
    expect([ruins.completed, ruins.onAccount]).toEqual([false, true]);
    expect([wailing.completed, wailing.onAccount]).toEqual([false, false]);
    const main = buildInstancesView(defs, chordrak);
    expect(main.dungeonTiers[0].dungeons.slice(0, 2).map((d) => [d.completed, d.onAccount])).toEqual([[true, false], [true, false]]);
  });

  test("raids with boss list, Onyxia as a single boss", () => {
    const v = buildInstancesView(defs, {
      achievements: [{ id: 62034, completed: false, criteria: [230812, 230813] }],
      bossKills: [{ boss: "Bandalar", instance: "Hyjalgipfel", quantity: 1, lastAt: "2026-11-04T20:00:00.000Z" }],
    });
    expect(v.raids.map((r) => [r.name, r.completed, r.onAccount, r.bosses.length])).toEqual([
      ["Hyjalgipfel", false, false, 13],
      ["Onyxia", false, false, 1],
    ]);
    expect(v.raids[0].bosses[0]).toEqual({ name: "Bandalar", defeated: true, lastAt: "2026-11-04T20:00:00.000Z" });
    // The criterion applies to the whole account, defeated only counts via the own statistics.
    expect(v.raids[0].bosses[1]).toEqual({ name: "Urtum des Verfalls", defeated: false, lastAt: null });
    expect(v.raids[1].bosses).toEqual([{ name: "Onyxia", defeated: false, lastAt: null }]);
    expect(v.otherKills).toEqual([]);
  });

  test("completed achievement without own victory: only on this account", () => {
    const v = buildInstancesView(defs, { achievements: [{ id: 684, completed: true, criteria: [] }], bossKills: [] });
    expect(v.raids[1]).toMatchObject({ completed: false, onAccount: true, bosses: [{ name: "Onyxia", defeated: false }] });
  });

  test("raid completed when the own statistics prove all bosses", () => {
    const v = buildInstancesView(defs, {
      achievements: [],
      bossKills: [{ boss: "Onyxia", instance: "Onyxias Hort", quantity: 1, lastAt: "2026-11-20T20:00:00.000Z" }],
    });
    expect(v.raids[1]).toMatchObject({ completed: true, onAccount: false, bosses: [{ name: "Onyxia", defeated: true }] });
  });

  test("raidName from the root criterion", () => {
    expect(raidName(def(62034, 0))).toBe("Hyjalgipfel");
    expect(raidName(def(684, 0))).toBe("Onyxia");
    expect(raidName({ ...def(684, 0), rootDescription: null })).toBe("Eroberer des Horts");
  });

  test("kill without a matching dungeon ends up under other victories", () => {
    const v = buildInstancesView(defs, {
      achievements: [],
      bossKills: [{ boss: "Baron Rivendare", instance: "Stratholme", quantity: 1, lastAt: null }],
    });
    expect(v.otherKills).toEqual([{ boss: "Baron Rivendare", instance: "Stratholme", quantity: 1, lastAt: null }]);
  });

  test("old record without progress", () => {
    const v = buildInstancesView(defs, undefined);
    expect(v.dungeonTiers[0].dungeons.every((d) => !d.completed && d.kills.length === 0)).toBe(true);
    expect(v.raids.every((r) => r.bosses.every((b) => !b.defeated))).toBe(true);
  });
});

const TILES: IconMap = {
  "63": "https://render.worldofwarcraft.com/eu/zones/deadmines-small.jpg",
  "226": "https://render.worldofwarcraft.com/eu/zones/ragefire-chasm-small.jpg",
  "760": "https://render.worldofwarcraft.com/eu/zones/onyxias-lair-small.jpg",
  "240": null,
};

describe("instance images", () => {
  test("instanceImage via the mapping table, normalized, first alternative with an image", () => {
    expect(instanceImage("Die Todesminen", TILES)).toBe(TILES["63"]);
    expect(instanceImage("Flammenschlund oder Halle der Thanen", TILES)).toBe(TILES["226"]);
    expect(instanceImage("Halle der Thanen oder Flammenschlund", TILES)).toBe("/dungeons/halle-der-thanen.jpg");
    expect(instanceImage("Ruinen von Lordaeron", TILES)).toBe("/dungeons/ruinen-von-lordaeron.jpg");
    expect(instanceImage("Ragefireabgrund oder Halle der Thanen", TILES)).toBe(TILES["226"]);
    expect(instanceImage("Höhlen des Wehklagens", TILES)).toBeNull();
    expect(instanceImage("Höhlen des Wehklagens oder Halle der Thanen", TILES)).toBe("/dungeons/halle-der-thanen.jpg");
    expect(instanceImage("Unbekannter Ort", TILES)).toBeNull();
    expect(instanceImage("Todesminen", null)).toBeNull();
    expect(instanceImage("Stratholme: Tot", null)).toBe("https://render.worldofwarcraft.com/eu/zones/stratholme-small.jpg");
  });

  test("dungeons and raids carry their image", () => {
    const v = buildInstancesView(defs, chordrak, TILES);
    const byName = Object.fromEntries(v.dungeonTiers[0].dungeons.map((d) => [d.name, d.image]));
    expect(byName["Flammenschlund"]).toBe(TILES["226"]);
    expect(byName["Todesminen"]).toBe(TILES["63"]);
    expect(byName["Ruinen von Lordaeron"]).toBe("/dungeons/ruinen-von-lordaeron.jpg");
    expect(v.raids.map((r) => [r.name, r.image])).toEqual([
      ["Hyjalgipfel", "https://render.worldofwarcraft.com/eu/zones/the-battle-for-mount-hyjal-small.jpg"],
      ["Onyxia", TILES["760"]],
    ]);
  });
});

const INFO: Record<string, DungeonInfo> = {
  Flammenschlund: { levels: [13, 18], bosses: ["Oggleflint", "Taragaman der Hungerleider", "Jergosh der Herbeirufer", "Bazzalan"], statisticEntries: [], withoutStatistic: false },
  "Halle der Thanen": { levels: [15, 20], bosses: ["Faldrim Anvilmar", "Durgen Dirgehammer"], statisticEntries: [], withoutStatistic: false },
  Todesminen: { levels: [17, 26], bosses: ["Rhahk'Zor", "Edwin van Cleef"], statisticEntries: [], withoutStatistic: false },
  Hyjalgipfel: { levels: [60, 60], bosses: [], statisticEntries: [], withoutStatistic: false },
};

describe("boss lists and levels from the maintained file", () => {
  test("dungeon: boss names as info, final boss is the last entry, completion from the final boss kill", () => {
    const v = buildInstancesView(defs, chordrak, null, INFO);
    const ragefire = v.dungeonTiers[0].dungeons[0];
    expect(ragefire.levels).toEqual({ min: 13, max: 18 });
    expect(ragefire.bosses).toEqual(["Oggleflint", "Taragaman der Hungerleider", "Jergosh der Herbeirufer", "Bazzalan"]);
    expect(ragefire.finalBosses).toEqual(["Bazzalan"]);
    expect([ragefire.completed, ragefire.completedAt, ragefire.timesCompleted]).toEqual([true, BAZZALAN, 1]);
  });

  test("final boss kill without a completed criterion counts as completed, count from quantity", () => {
    const v = buildInstancesView(
      defs,
      { achievements: [], bossKills: [{ boss: "Edwin van Cleef", instance: "Todesminen", quantity: 3, lastAt: "2026-11-05T18:00:00.000Z" }] },
      null,
      INFO,
    );
    const deadmines = v.dungeonTiers[0].dungeons.find((d) => d.name === "Todesminen")!;
    expect([deadmines.completed, deadmines.completedAt, deadmines.timesCompleted]).toEqual([true, "2026-11-05T18:00:00.000Z", 3]);
    expect(deadmines.finalBosses).toEqual(["Edwin van Cleef"]);
  });

  test("criterion done but no kill in the statistics: not completed, only on this account", () => {
    const v = buildInstancesView(defs, { achievements: [{ id: 62031, completed: false, criteria: [230762] }], bossKills: [] }, null, INFO);
    const deadmines = v.dungeonTiers[0].dungeons.find((d) => d.name === "Todesminen")!;
    expect([deadmines.completed, deadmines.onAccount, deadmines.completedAt, deadmines.timesCompleted]).toEqual([false, true, null, 0]);
  });

  test("kill of a boss other than the final boss does not complete", () => {
    const v = buildInstancesView(
      defs,
      { achievements: [], bossKills: [{ boss: "Rhahk'Zor", instance: "Todesminen", quantity: 1, lastAt: null }] },
      null,
      INFO,
    );
    const deadmines = v.dungeonTiers[0].dungeons.find((d) => d.name === "Todesminen")!;
    expect([deadmines.completed, deadmines.timesCompleted, deadmines.kills.length]).toEqual([false, 0, 1]);
  });

  test("without a kill the data of the first alternative, without an entry null", () => {
    const v = buildInstancesView(defs, { achievements: [], bossKills: [] }, null, INFO);
    const [ragefire, ruins] = v.dungeonTiers[0].dungeons;
    expect(ragefire.name).toBe("Flammenschlund oder Halle der Thanen");
    expect(ragefire.levels).toEqual({ min: 13, max: 18 });
    expect(ragefire.bosses).toHaveLength(4);
    expect(ragefire.completed).toBe(false);
    expect([ruins.levels, ruins.bosses, ruins.finalBosses]).toEqual([null, null, []]);
  });

  test("kill in the other alternative: its boss list and final boss", () => {
    const v = buildInstancesView(
      defs,
      { achievements: [], bossKills: [{ boss: "Durgen Dirgehammer", instance: "Halle der Thanen", quantity: 1, lastAt: "2026-11-05T10:00:00.000Z" }] },
      null,
      INFO,
    );
    const thanen = v.dungeonTiers[0].dungeons[0];
    expect(thanen.name).toBe("Halle der Thanen");
    expect(thanen.levels).toEqual({ min: 15, max: 20 });
    expect(thanen.bosses).toEqual(["Faldrim Anvilmar", "Durgen Dirgehammer"]);
    expect([thanen.completedAt, thanen.finalBosses]).toEqual(["2026-11-05T10:00:00.000Z", ["Durgen Dirgehammer"]]);
  });

  test("kills in both alternatives: bosses of both, both final bosses, latest date, summed count", () => {
    const v = buildInstancesView(
      defs,
      {
        achievements: [],
        bossKills: [
          { boss: "Bazzalan", instance: "Flammenschlund", quantity: 2, lastAt: "2026-11-03T10:00:00.000Z" },
          { boss: "Durgen Dirgehammer", instance: "Halle der Thanen", quantity: 1, lastAt: "2026-11-05T10:00:00.000Z" },
        ],
      },
      null,
      INFO,
    );
    const both = v.dungeonTiers[0].dungeons[0];
    expect(both.bosses).toEqual([
      "Oggleflint", "Taragaman der Hungerleider", "Jergosh der Herbeirufer", "Bazzalan", "Faldrim Anvilmar", "Durgen Dirgehammer",
    ]);
    expect(both.finalBosses).toEqual(["Bazzalan", "Durgen Dirgehammer"]);
    expect([both.completedAt, both.timesCompleted]).toEqual(["2026-11-05T10:00:00.000Z", 3]);
  });

  test("raids get their level range", () => {
    const v = buildInstancesView(defs, chordrak, null, INFO);
    expect(v.raids.map((r) => r.levels)).toEqual([{ min: 60, max: 60 }, null]);
  });
});

test("maintained file is validated on load", () => {
  expect(toDungeonInfo({ levels: [13, 18], bosses: ["A", 3] })).toEqual({ levels: [13, 18], bosses: ["A"], statisticEntries: [], withoutStatistic: false });
  expect(toDungeonInfo({ levels: [13], bosses: "x" })).toEqual({ levels: null, bosses: [], statisticEntries: [], withoutStatistic: false });
  expect(toDungeonInfo({})).toEqual({ levels: null, bosses: [], statisticEntries: [], withoutStatistic: false });
  expect(toDungeonInfo({ statisticEntries: [{ instance: "I", finalBoss: "E" }, { instance: 1 }, null] })).toEqual({
    levels: null, bosses: [], statisticEntries: [{ instance: "I", finalBoss: "E" }], withoutStatistic: false,
  });
  expect(DUNGEON_INFO["Todesminen"].levels).toEqual([17, 26]);
  expect(DUNGEON_INFO["Todesminen"].bosses).toContain("Edwin van Cleef");
  expect(DUNGEON_INFO["Flammenschlund"].bosses).toContain("Bazzalan");
});

describe("extra dungeons without an achievement", () => {
  const stockade: ExtraDungeon = {
    name: "Das Verlies",
    tier: "Novize",
    info: { levels: [24, 32], bosses: ["Targorr der Schreckliche", "Bazil Thredd"], statisticEntries: [], withoutStatistic: false },
    source: { instance: "Verlies von Stormwind", finalBoss: "Bazil Thredd" },
    image: null, faction: null, replaces: [],
  };
  const info: Record<string, DungeonInfo> = {
    "Burg Shadowfang": { levels: [22, 30], bosses: [], statisticEntries: [], withoutStatistic: false },
    "Ausgrabungsstätte: Sumpfland": { levels: [24, 29], bosses: [], statisticEntries: [], withoutStatistic: false },
  };

  test("appears in its tier, sorted by minimum level", () => {
    const v = buildInstancesView(defs, chordrak, null, info, [stockade]);
    const names = v.dungeonTiers[0].dungeons.map((d) => d.name);
    expect(names.slice(-3)).toEqual(["Burg Shadowfang", "Ausgrabungsstätte: Sumpfland", "Das Verlies"]);
    const d = v.dungeonTiers[0].dungeons.at(-1);
    expect(d).toMatchObject({ criterionId: -1, levels: { min: 24, max: 32 }, finalBosses: ["Bazil Thredd"], completed: false });
  });

  test("victories over the final boss count as completion and are missing from other victories", () => {
    const v = buildInstancesView(defs, {
      achievements: [],
      bossKills: [{ boss: "Bazil Thredd", instance: "Verlies von Stormwind", quantity: 3, lastAt: "2026-11-15T12:14:19.000Z" }],
    }, null, info, [stockade]);
    const d = v.dungeonTiers[0].dungeons.find((x) => x.name === "Das Verlies");
    expect(d).toMatchObject({ completed: true, timesCompleted: 3, completedAt: "2026-11-15T12:14:19.000Z" });
    expect(v.otherKills).toEqual([]);
  });

  test("0 completions without data", () => {
    for (const progress of [undefined, { achievements: [], bossKills: [] }]) {
      const d = buildInstancesView(defs, progress, null, info, [stockade]).dungeonTiers[0].dungeons.find((x) => x.name === "Das Verlies");
      expect(d).toMatchObject({ completed: false, timesCompleted: 0, completedAt: null, kills: [] });
    }
  });

  test("own group without a matching tier", () => {
    const v = buildInstancesView(defs, chordrak, null, info, [{ ...stockade, tier: "Meister" }]);
    expect(v.dungeonTiers.map((t) => t.tier)).toEqual(["Novize", "Meister"]);
  });

  test("configuration: Das Verlies is listed with level, source and Blizzard image", () => {
    const v = EXTRA_DUNGEONS.find((d) => d.name === "Das Verlies");
    expect(v).toMatchObject({ tier: "Novize", info: { levels: [24, 32] }, source: { instance: "Verlies von Stormwind", finalBoss: "Bazil Thredd" } });
    expect(instanceImage("Das Verlies", null)).toBe("https://render.worldofwarcraft.com/eu/zones/the-stockade-small.jpg");
    expect(toExtraDungeon({ name: "Ohne Quelle", tier: "Novize" })).toBeNull();
  });
});

test("extra dungeon lands before the first dungeon with a higher minimum level", () => {
  const extra: ExtraDungeon = {
    name: "Das Verlies", tier: "Novize", info: { levels: [16, 20], bosses: [], statisticEntries: [], withoutStatistic: false },
    source: { instance: "Verlies von Stormwind", finalBoss: "Bazil Thredd" }, image: null, faction: null, replaces: [],
  };
  const v = buildInstancesView(defs, undefined, null, DUNGEON_INFO, [extra]);
  const names = v.dungeonTiers[0].dungeons.map((d) => d.name);
  expect(names.slice(1, 4)).toEqual(["Ruinen von Lordaeron", "Das Verlies", "Höhlen des Wehklagens"]);
});

describe("counterparts of both factions separate", () => {
  const replaced = ["Flammenschlund oder Halle der Thanen", "Ragefireabgrund oder Halle der Thanen"];
  const ragefire: ExtraDungeon = {
    name: "Flammenschlund", tier: "Novize", info: DUNGEON_INFO["Flammenschlund"],
    source: { instance: "Flammenschlund", finalBoss: "Bazzalan" }, image: null, faction: "HORDE", replaces: replaced,
  };
  const hall: ExtraDungeon = {
    name: "Halle der Thanen", tier: "Novize", info: DUNGEON_INFO["Halle der Thanen"],
    source: { instance: "Halle der Thanen", finalBoss: "Durgen Dirgehammer" }, image: null, faction: "ALLIANCE", replaces: replaced,
  };
  const extras = [ragefire, hall];
  const find = (v: ReturnType<typeof buildInstancesView>, name: string) =>
    v.dungeonTiers.flatMap((t) => t.dungeons).find((d) => d.name === name);

  test("two own entries at the front instead of the shared criterion", () => {
    const v = buildInstancesView(defs, undefined, null, DUNGEON_INFO, extras, "HORDE");
    expect(v.dungeonTiers[0].dungeons.slice(0, 3).map((d) => d.name)).toEqual(["Flammenschlund", "Halle der Thanen", "Ruinen von Lordaeron"]);
    expect(v.dungeonTiers[0].dungeons.some((d) => d.description.includes(" oder "))).toBe(false);
  });

  test("Horde: Bazzalan counts for Flammenschlund", () => {
    const v = buildInstancesView(defs, chordrak, null, DUNGEON_INFO, extras, "HORDE");
    expect(find(v, "Flammenschlund")).toMatchObject({ completed: true, timesCompleted: 1, completedAt: BAZZALAN });
    expect(find(v, "Halle der Thanen")).toMatchObject({ completed: false, timesCompleted: 0 });
    expect(v.otherKills.map((k) => k.boss)).toEqual([]);
  });

  test("Alliance: mirrored Bazzalan does not count, Durgen Dirgehammer counts for the hall", () => {
    const v = buildInstancesView(defs, {
      achievements: [{ id: 62031, completed: false, criteria: [230766] }],
      bossKills: [
        { boss: "Bazzalan", instance: "Flammenschlund", quantity: 2, lastAt: "2026-11-08T21:12:46.000Z" },
        { boss: "Durgen Dirgehammer", instance: "Halle der Thanen", quantity: 2, lastAt: "2026-11-08T21:12:46.000Z" },
      ],
    }, null, DUNGEON_INFO, extras, "ALLIANCE");
    expect(find(v, "Flammenschlund")).toMatchObject({ completed: false, timesCompleted: 0, kills: [] });
    expect(find(v, "Halle der Thanen")).toMatchObject({ completed: true, timesCompleted: 2 });
    expect(v.otherKills).toEqual([]);
  });

  test("completed criterion without statistics shows only \"on this account\" for the own faction", () => {
    const progress = { achievements: [{ id: 64016, completed: false, criteria: [234135] }], bossKills: [] };
    const alliance = buildInstancesView(defs, progress, null, DUNGEON_INFO, extras, "ALLIANCE");
    expect(find(alliance, "Halle der Thanen")).toMatchObject({ completed: false, onAccount: true, timesCompleted: 0 });
    expect(find(alliance, "Flammenschlund")).toMatchObject({ completed: false, onAccount: false });
    const horde = buildInstancesView(defs, progress, null, DUNGEON_INFO, extras, "HORDE");
    expect(find(horde, "Flammenschlund")).toMatchObject({ completed: false, onAccount: true });
    expect(find(horde, "Halle der Thanen")).toMatchObject({ completed: false, onAccount: false });
  });

  test("0 completions without data", () => {
    const v = buildInstancesView(defs, undefined, null, DUNGEON_INFO, extras, "ALLIANCE");
    for (const name of ["Flammenschlund", "Halle der Thanen"]) expect(find(v, name)).toMatchObject({ completed: false, timesCompleted: 0 });
  });

  test("configuration: both separate, level and images from the maintained data", () => {
    const byName = new Map(EXTRA_DUNGEONS.map((d) => [d.name, d]));
    expect(byName.get("Flammenschlund")).toMatchObject({ faction: "HORDE", replaces: replaced, info: { levels: [13, 18] } });
    expect(byName.get("Halle der Thanen")).toMatchObject({ faction: "ALLIANCE", replaces: replaced, info: { levels: [13, 18] } });
    expect(byName.get("Halle der Thanen")?.info.bosses.at(-1)).toBe("Durgen Dirgehammer");
    expect(instanceImage("Halle der Thanen", null)).toBe("/dungeons/halle-der-thanen.jpg");
  });
});

describe("statistics names from config/dungeons.json", () => {
  const masterDefs: InstanceAchievementsRecord = { achievements: [def(62031, 0), loadDef(62033)] };
  function loadDef(id: number): InstanceAchievement {
    // Meister tier without a fixture: criteria as in the static data set.
    const names = ["Hügel von Razorfen", "Uldaman", "Blackrocktiefen", "Stratholme: Lebendig", "Stratholme: Tot", "Düsterbruch: Ost", "Düsterbruch: Nord"];
    return { id, name: "Meister: Dungeonerforscher", kind: "dungeon", order: 1, rootDescription: null, criteria: names.map((description, i) => ({ id: 900 + i, description })) };
  }
  const all = (v: ReturnType<typeof buildInstancesView>) => v.dungeonTiers.flatMap((t) => t.dungeons);
  const find = (v: ReturnType<typeof buildInstancesView>, name: string) => all(v).find((d) => d.name === name)!;
  const kill = (boss: string, instance: string, quantity = 1) => ({ boss, instance, quantity, lastAt: "2026-11-20T20:00:00.000Z" });

  test("differing instance name of the statistics counts for the dungeon", () => {
    const v = buildInstancesView(masterDefs, {
      achievements: [],
      bossKills: [kill("Erzmagier Arugal", "Burg Schattenfang", 2), kill("Imperator Dagran Thaurissan", "Schwarzfelstiefen")],
    }, null, DUNGEON_INFO);
    expect(find(v, "Burg Shadowfang")).toMatchObject({ completed: true, timesCompleted: 2 });
    expect(find(v, "Blackrocktiefen")).toMatchObject({ completed: true, timesCompleted: 1 });
    expect(v.otherKills).toEqual([]);
  });

  test("shared instance name of several wings: the final boss decides", () => {
    const v = buildInstancesView(masterDefs, {
      achievements: [],
      bossKills: [kill("Baron Rivendare", "Stratholme"), kill("König Gordok", "Düsterbruch")],
    }, null, DUNGEON_INFO);
    expect(find(v, "Stratholme: Lebendig").completed).toBe(false);
    expect(find(v, "Stratholme: Tot").completed).toBe(true);
    expect(find(v, "Düsterbruch: Ost").completed).toBe(false);
    expect(find(v, "Düsterbruch: Nord").completed).toBe(true);
  });

  test("inflected boss names in the statistics match the final boss", () => {
    const v = buildInstancesView(masterDefs, {
      achievements: [],
      bossKills: [kill("Mutanus den Verschlinger", "Höhlen des Wehklagens", 2), kill("Amnennar den Kältebringer", "Hügel von Razorfen")],
    }, null, DUNGEON_INFO);
    expect(find(v, "Höhlen des Wehklagens")).toMatchObject({ completed: true, timesCompleted: 2 });
    expect(find(v, "Hügel von Razorfen")).toMatchObject({ completed: true, timesCompleted: 1 });
  });

  test("Kathedrale: two mirrored statistics count as one completion", () => {
    const sm: InstanceAchievementsRecord = {
      achievements: [{ id: 1, name: "Erfahren: Dungeonerforscher", kind: "dungeon", order: 0, rootDescription: null, criteria: [{ id: 1, description: "Scharlachrotes Kloster: Kathedrale" }] }],
    };
    const v = buildInstancesView(sm, {
      achievements: [],
      bossKills: [kill("Kommandant Mograine", "Scharlachrotes Kloster", 3), kill("Flammenwirker Koegler", "Scharlachrote Hallen", 3)],
    }, null, DUNGEON_INFO);
    expect(find(v, "Scharlachrotes Kloster: Kathedrale")).toMatchObject({ completed: true, timesCompleted: 3 });
    expect(v.otherKills).toEqual([]);
  });

  test("dungeon without statistics: not provable, with criterion only on this account", () => {
    const swamp = buildInstancesView(defs, { achievements: [{ id: 62031, completed: false, criteria: [230761] }], bossKills: [] }, null, DUNGEON_INFO);
    expect(find(swamp, "Ausgrabungsstätte: Sumpfland")).toMatchObject({ completed: false, onAccount: true, tracked: false });
    expect(find(swamp, "Todesminen")).toMatchObject({ tracked: true });
  });

  test("Dalaran: the final boss is the archmage's shade, Lyn alone does not complete", () => {
    const dal: InstanceAchievementsRecord = {
      achievements: [{ id: 1, name: "Erfahren: Dungeonerforscher", kind: "dungeon", order: 0, rootDescription: null, criteria: [{ id: 1, description: "Dalaran" }] }],
    };
    expect(find(buildInstancesView(dal, { achievements: [], bossKills: [kill("Lyn der Ignorierte", "Dalaran")] }, null, DUNGEON_INFO), "Dalaran").completed).toBe(false);
    expect(find(buildInstancesView(dal, { achievements: [], bossKills: [kill("den Schemen des Erzmagiers", "Dalaran")] }, null, DUNGEON_INFO), "Dalaran").completed).toBe(true);
  });
});
