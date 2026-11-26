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
  test("ohne Definitionen nicht verfügbar", () => {
    expect(buildInstancesView(null, chordrak)).toEqual({ available: false, dungeonTiers: [], raids: [], otherKills: [] });
  });

  test("Dungeons der Stufe Novize mit erledigten Dungeons und Boss-Kills", () => {
    const v = buildInstancesView(defs, chordrak);
    expect(v.available).toBe(true);
    expect(v.dungeonTiers.map((t) => [t.tier, t.achievementId])).toEqual([["Novize", 62031]]);
    const [flamme, ruinen, hoehlen] = v.dungeonTiers[0].dungeons;
    expect(flamme).toEqual({
      criterionId: 230766,
      name: "Flammenschlund",
      description: "Flammenschlund oder Halle der Thanen",
      completed: true,
      kills: [{ boss: "Bazzalan", quantity: 1, lastAt: BAZZALAN }],
      image: null,
      levels: null,
      bosses: null,
      finalBosses: [],
      completedAt: BAZZALAN,
      timesCompleted: 1,
    });
    expect(ruinen).toMatchObject({ name: "Ruinen von Lordaeron", completed: true, kills: [{ boss: "Rath'mael" }] });
    expect(hoehlen).toEqual({
      criterionId: 230763, name: "Höhlen des Wehklagens", description: "Höhlen des Wehklagens", completed: false, kills: [], image: null, levels: null, bosses: null,
      finalBosses: [], completedAt: null, timesCompleted: 0,
    });
    expect(v.otherKills).toEqual([]);
  });

  test("Kill in beiden Alternativen zeigt die volle Beschreibung und gilt als abgeschlossen", () => {
    const v = buildInstancesView(defs, {
      achievements: [],
      bossKills: [
        { boss: "Bazzalan", instance: "Flammenschlund", quantity: 1, lastAt: null },
        { boss: "Durgen Dirgehammer", instance: "Halle der Thanen", quantity: 2, lastAt: null },
      ],
    });
    const erster = v.dungeonTiers[0].dungeons[0];
    expect(erster.name).toBe("Flammenschlund oder Halle der Thanen");
    // In Forever erscheinen nur Endbosse in der Statistik, ein Kill heißt also: abgeschlossen.
    expect([erster.completed, erster.timesCompleted]).toEqual([true, 3]);
    expect(erster.kills.map((k) => k.boss)).toEqual(["Bazzalan", "Durgen Dirgehammer"]);
  });

  test("Fortschritt nur in der zweiten Reihe zeigt diese", () => {
    const v = buildInstancesView(defs, { achievements: [{ id: 64016, completed: false, criteria: [234131] }], bossKills: [] });
    expect(v.dungeonTiers[0].achievementId).toBe(64016);
    expect(v.dungeonTiers[0].dungeons.find((d) => d.criterionId === 234131)?.completed).toBe(true);
  });

  test("Raids mit Bossliste, Onyxia als einzelner Boss", () => {
    const v = buildInstancesView(defs, {
      achievements: [{ id: 62034, completed: false, criteria: [230812, 230813] }],
      bossKills: [{ boss: "Bandalar", instance: "Hyjalgipfel", quantity: 1, lastAt: "2026-11-04T20:00:00.000Z" }],
    });
    expect(v.raids.map((r) => [r.name, r.completed, r.bosses.length])).toEqual([
      ["Hyjalgipfel", false, 13],
      ["Onyxia", false, 1],
    ]);
    expect(v.raids[0].bosses[0]).toEqual({ name: "Bandalar", defeated: true, lastAt: "2026-11-04T20:00:00.000Z" });
    expect(v.raids[0].bosses[1]).toEqual({ name: "Urtum des Verfalls", defeated: true, lastAt: null });
    expect(v.raids[1].bosses).toEqual([{ name: "Onyxia", defeated: false, lastAt: null }]);
    expect(v.otherKills).toEqual([]);
  });

  test("erledigter Erfolg markiert alles, auch Onyxia ohne Kriterien", () => {
    const v = buildInstancesView(defs, { achievements: [{ id: 684, completed: true, criteria: [] }], bossKills: [] });
    expect(v.raids[1]).toMatchObject({ completed: true, bosses: [{ name: "Onyxia", defeated: true }] });
  });

  test("raidName aus dem Wurzelkriterium", () => {
    expect(raidName(def(62034, 0))).toBe("Hyjalgipfel");
    expect(raidName(def(684, 0))).toBe("Onyxia");
    expect(raidName({ ...def(684, 0), rootDescription: null })).toBe("Eroberer des Horts");
  });

  test("Kill ohne passenden Dungeon landet unter weiteren Siegen", () => {
    const v = buildInstancesView(defs, {
      achievements: [],
      bossKills: [{ boss: "Baron Rivendare", instance: "Stratholme", quantity: 1, lastAt: null }],
    });
    expect(v.otherKills).toEqual([{ boss: "Baron Rivendare", instance: "Stratholme", quantity: 1, lastAt: null }]);
  });

  test("alter Datensatz ohne Fortschritt", () => {
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

describe("Instanzbilder", () => {
  test("instanceImage über die Zuordnungstabelle, normalisiert, erste Alternative mit Bild", () => {
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

  test("Dungeons und Raids tragen ihr Bild", () => {
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
  Flammenschlund: { stufe: [13, 18], bosse: ["Oggleflint", "Taragaman der Hungerleider", "Jergosh der Herbeirufer", "Bazzalan"] },
  "Halle der Thanen": { stufe: [15, 20], bosse: ["Faldrim Anvilmar", "Durgen Dirgehammer"] },
  Todesminen: { stufe: [17, 26], bosse: ["Rhahk'Zor", "Edwin van Cleef"] },
  Hyjalgipfel: { stufe: [60, 60], bosse: [] },
};

describe("Bosslisten und Stufen aus der gepflegten Datei", () => {
  test("Dungeon: Bossnamen als Info, Endboss ist der letzte Eintrag, Abschluss aus dem Endboss-Kill", () => {
    const v = buildInstancesView(defs, chordrak, null, INFO);
    const flamme = v.dungeonTiers[0].dungeons[0];
    expect(flamme.levels).toEqual({ min: 13, max: 18 });
    expect(flamme.bosses).toEqual(["Oggleflint", "Taragaman der Hungerleider", "Jergosh der Herbeirufer", "Bazzalan"]);
    expect(flamme.finalBosses).toEqual(["Bazzalan"]);
    expect([flamme.completed, flamme.completedAt, flamme.timesCompleted]).toEqual([true, BAZZALAN, 1]);
  });

  test("Endboss-Kill ohne erledigtes Kriterium gilt als abgeschlossen, Anzahl aus quantity", () => {
    const v = buildInstancesView(
      defs,
      { achievements: [], bossKills: [{ boss: "Edwin van Cleef", instance: "Todesminen", quantity: 3, lastAt: "2026-11-05T18:00:00.000Z" }] },
      null,
      INFO,
    );
    const minen = v.dungeonTiers[0].dungeons.find((d) => d.name === "Todesminen")!;
    expect([minen.completed, minen.completedAt, minen.timesCompleted]).toEqual([true, "2026-11-05T18:00:00.000Z", 3]);
    expect(minen.finalBosses).toEqual(["Edwin van Cleef"]);
  });

  test("Kriterium erledigt, aber kein Kill in der Statistik: abgeschlossen ohne Datum", () => {
    const v = buildInstancesView(defs, { achievements: [{ id: 62031, completed: false, criteria: [230762] }], bossKills: [] }, null, INFO);
    const minen = v.dungeonTiers[0].dungeons.find((d) => d.name === "Todesminen")!;
    expect([minen.completed, minen.completedAt, minen.timesCompleted]).toEqual([true, null, 0]);
  });

  test("ohne Kill die Angaben der ersten Alternative, ohne Eintrag null", () => {
    const v = buildInstancesView(defs, { achievements: [], bossKills: [] }, null, INFO);
    const [flamme, ruinen] = v.dungeonTiers[0].dungeons;
    expect(flamme.name).toBe("Flammenschlund oder Halle der Thanen");
    expect(flamme.levels).toEqual({ min: 13, max: 18 });
    expect(flamme.bosses).toHaveLength(4);
    expect(flamme.completed).toBe(false);
    expect([ruinen.levels, ruinen.bosses, ruinen.finalBosses]).toEqual([null, null, []]);
  });

  test("Kill in der anderen Alternative: deren Bossliste und Endboss", () => {
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

  test("Kills in beiden Alternativen: Bosse beider, beide Endbosse, jüngstes Datum, Anzahl zusammen", () => {
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
    const beide = v.dungeonTiers[0].dungeons[0];
    expect(beide.bosses).toEqual([
      "Oggleflint", "Taragaman der Hungerleider", "Jergosh der Herbeirufer", "Bazzalan", "Faldrim Anvilmar", "Durgen Dirgehammer",
    ]);
    expect(beide.finalBosses).toEqual(["Bazzalan", "Durgen Dirgehammer"]);
    expect([beide.completedAt, beide.timesCompleted]).toEqual(["2026-11-05T10:00:00.000Z", 3]);
  });

  test("Raids bekommen ihren Levelbereich", () => {
    const v = buildInstancesView(defs, chordrak, null, INFO);
    expect(v.raids.map((r) => r.levels)).toEqual([{ min: 60, max: 60 }, null]);
  });
});

test("gepflegte Datei wird geprüft geladen", () => {
  expect(toDungeonInfo({ stufe: [13, 18], bosse: ["A", 3] })).toEqual({ stufe: [13, 18], bosse: ["A"] });
  expect(toDungeonInfo({ stufe: [13], bosse: "x" })).toEqual({ stufe: null, bosse: [] });
  expect(toDungeonInfo({})).toEqual({ stufe: null, bosse: [] });
  expect(DUNGEON_INFO["Todesminen"].stufe).toEqual([17, 26]);
  expect(DUNGEON_INFO["Todesminen"].bosse).toContain("Edwin van Cleef");
  expect(DUNGEON_INFO["Flammenschlund"].bosse).toContain("Bazzalan");
});

describe("Zusatz-Dungeons ohne Erfolg", () => {
  const verlies: ExtraDungeon = {
    name: "Das Verlies",
    tier: "Novize",
    info: { stufe: [24, 32], bosse: ["Targorr der Schreckliche", "Bazil Thredd"] },
    source: { instance: "Verlies von Stormwind", finalBoss: "Bazil Thredd" },
    image: null, faction: null, replaces: [],
  };
  const info: Record<string, DungeonInfo> = {
    "Burg Shadowfang": { stufe: [22, 30], bosse: [] },
    "Ausgrabungsstätte: Sumpfland": { stufe: [24, 29], bosse: [] },
  };

  test("erscheint in seiner Stufe nach Mindestlevel einsortiert", () => {
    const v = buildInstancesView(defs, chordrak, null, info, [verlies]);
    const names = v.dungeonTiers[0].dungeons.map((d) => d.name);
    expect(names.slice(-3)).toEqual(["Burg Shadowfang", "Ausgrabungsstätte: Sumpfland", "Das Verlies"]);
    const d = v.dungeonTiers[0].dungeons.at(-1);
    expect(d).toMatchObject({ criterionId: -1, levels: { min: 24, max: 32 }, finalBosses: ["Bazil Thredd"], completed: false });
  });

  test("Siege über den Endboss zählen als Abschluss und fehlen bei den weiteren Siegen", () => {
    const v = buildInstancesView(defs, {
      achievements: [],
      bossKills: [{ boss: "Bazil Thredd", instance: "Verlies von Stormwind", quantity: 3, lastAt: "2026-11-15T12:14:19.000Z" }],
    }, null, info, [verlies]);
    const d = v.dungeonTiers[0].dungeons.find((x) => x.name === "Das Verlies");
    expect(d).toMatchObject({ completed: true, timesCompleted: 3, completedAt: "2026-11-15T12:14:19.000Z" });
    expect(v.otherKills).toEqual([]);
  });

  test("ohne Daten 0 Abschlüsse", () => {
    for (const progress of [undefined, { achievements: [], bossKills: [] }]) {
      const d = buildInstancesView(defs, progress, null, info, [verlies]).dungeonTiers[0].dungeons.find((x) => x.name === "Das Verlies");
      expect(d).toMatchObject({ completed: false, timesCompleted: 0, completedAt: null, kills: [] });
    }
  });

  test("ohne passende Stufe eine eigene Gruppe", () => {
    const v = buildInstancesView(defs, chordrak, null, info, [{ ...verlies, tier: "Meister" }]);
    expect(v.dungeonTiers.map((t) => t.tier)).toEqual(["Novize", "Meister"]);
  });

  test("Konfiguration: das Verlies steht mit Stufe, Quelle und Blizzard-Bild drin", () => {
    const v = EXTRA_DUNGEONS.find((d) => d.name === "Das Verlies");
    expect(v).toMatchObject({ tier: "Novize", info: { stufe: [24, 32] }, source: { instance: "Verlies von Stormwind", finalBoss: "Bazil Thredd" } });
    expect(instanceImage("Das Verlies", null)).toBe("https://render.worldofwarcraft.com/eu/zones/the-stockade-small.jpg");
    expect(toExtraDungeon({ name: "Ohne Quelle", rang: "Novize" })).toBeNull();
  });
});

test("Zusatz-Dungeon landet vor dem ersten Dungeon mit höherem Mindestlevel", () => {
  const extra: ExtraDungeon = {
    name: "Das Verlies", tier: "Novize", info: { stufe: [16, 20], bosse: [] },
    source: { instance: "Verlies von Stormwind", finalBoss: "Bazil Thredd" }, image: null, faction: null, replaces: [],
  };
  const v = buildInstancesView(defs, undefined, null, DUNGEON_INFO, [extra]);
  const names = v.dungeonTiers[0].dungeons.map((d) => d.name);
  expect(names.slice(1, 4)).toEqual(["Ruinen von Lordaeron", "Das Verlies", "Höhlen des Wehklagens"]);
});

describe("Gegenstücke beider Fraktionen getrennt", () => {
  const ersetzt = ["Flammenschlund oder Halle der Thanen", "Ragefireabgrund oder Halle der Thanen"];
  const flamme: ExtraDungeon = {
    name: "Flammenschlund", tier: "Novize", info: DUNGEON_INFO["Flammenschlund"],
    source: { instance: "Flammenschlund", finalBoss: "Bazzalan" }, image: null, faction: "HORDE", replaces: ersetzt,
  };
  const halle: ExtraDungeon = {
    name: "Halle der Thanen", tier: "Novize", info: DUNGEON_INFO["Halle der Thanen"],
    source: { instance: "Halle der Thanen", finalBoss: "Durgen Dirgehammer" }, image: null, faction: "ALLIANCE", replaces: ersetzt,
  };
  const extras = [flamme, halle];
  const find = (v: ReturnType<typeof buildInstancesView>, name: string) =>
    v.dungeonTiers.flatMap((t) => t.dungeons).find((d) => d.name === name);

  test("zwei eigene Einträge vorn statt des gemeinsamen Kriteriums", () => {
    const v = buildInstancesView(defs, undefined, null, DUNGEON_INFO, extras, "HORDE");
    expect(v.dungeonTiers[0].dungeons.slice(0, 3).map((d) => d.name)).toEqual(["Flammenschlund", "Halle der Thanen", "Ruinen von Lordaeron"]);
    expect(v.dungeonTiers[0].dungeons.some((d) => d.description.includes(" oder "))).toBe(false);
  });

  test("Horde: Bazzalan zählt für den Flammenschlund", () => {
    const v = buildInstancesView(defs, chordrak, null, DUNGEON_INFO, extras, "HORDE");
    expect(find(v, "Flammenschlund")).toMatchObject({ completed: true, timesCompleted: 1, completedAt: BAZZALAN });
    expect(find(v, "Halle der Thanen")).toMatchObject({ completed: false, timesCompleted: 0 });
    expect(v.otherKills.map((k) => k.boss)).toEqual([]);
  });

  test("Allianz: gespiegelter Bazzalan zählt nicht, Durgen Dirgehammer für die Halle", () => {
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

  test("erledigtes Kriterium ohne Statistik zählt für die eigene Fraktion", () => {
    const progress = { achievements: [{ id: 64016, completed: false, criteria: [234135] }], bossKills: [] };
    const allianz = buildInstancesView(defs, progress, null, DUNGEON_INFO, extras, "ALLIANCE");
    expect(find(allianz, "Halle der Thanen")).toMatchObject({ completed: true, timesCompleted: 0 });
    expect(find(allianz, "Flammenschlund")).toMatchObject({ completed: false });
    const horde = buildInstancesView(defs, progress, null, DUNGEON_INFO, extras, "HORDE");
    expect(find(horde, "Flammenschlund")).toMatchObject({ completed: true });
    expect(find(horde, "Halle der Thanen")).toMatchObject({ completed: false });
  });

  test("ohne Daten 0 Abschlüsse", () => {
    const v = buildInstancesView(defs, undefined, null, DUNGEON_INFO, extras, "ALLIANCE");
    for (const name of ["Flammenschlund", "Halle der Thanen"]) expect(find(v, name)).toMatchObject({ completed: false, timesCompleted: 0 });
  });

  test("Konfiguration: beide getrennt, Stufe und Bilder aus den gepflegten Angaben", () => {
    const byName = new Map(EXTRA_DUNGEONS.map((d) => [d.name, d]));
    expect(byName.get("Flammenschlund")).toMatchObject({ faction: "HORDE", replaces: ersetzt, info: { stufe: [13, 18] } });
    expect(byName.get("Halle der Thanen")).toMatchObject({ faction: "ALLIANCE", replaces: ersetzt, info: { stufe: [13, 18] } });
    expect(byName.get("Halle der Thanen")?.info.bosse.at(-1)).toBe("Durgen Dirgehammer");
    expect(instanceImage("Halle der Thanen", null)).toBe("/dungeons/halle-der-thanen.jpg");
  });
});
