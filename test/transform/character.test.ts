import { expect, test } from "vitest";
import {
  buildCharacterRecord,
  mapEquipment,
  mapAchievementProgress,
  mapBossKills,
  mapItemTooltip,
  mapMedia,
  mapProfessions,
  mapReputations,
  mapSpecs,
  mapStatValues,
  parseBossKillName,
  pickMainSpec,
  type RosterEntry,
} from "../../src/transform/character";
import { loadFixture } from "../helpers/fixtures";

const f = (name: string) => loadFixture(name).data;

const luvia: RosterEntry = { id: 382219, name: "Luvia", surname: "Stav", slug: "luvia-stav", level: 20, classId: 1, raceId: 96, rank: 3 };
const parts = {
  profile: f("luvia-profile"),
  specializations: f("luvia-specializations"),
  equipment: f("luvia-equipment"),
  media: f("luvia-media"),
  professions: f("luvia-professions"),
  raids: f("luvia-raids"),
  achievements: null,
  statistics: null,
  reputations: null,
};

test("header data comes from the profile, level takes precedence over the roster value", () => {
  const r = buildCharacterRecord(luvia, parts, "2026-11-06T10:00:00.000Z");
  expect(r).toMatchObject({
    id: 382219,
    hasProfile: true,
    level: 21,
    classId: 1,
    raceId: 96,
    className: "Krieger",
    raceName: "Himmelsgeborener der Windformer",
    gender: "Weiblich",
    rulesetName: "Normal",
    equippedItemLevel: 11,
    surname: "Stav",
    slug: "luvia-stav",
    fetchedAt: "2026-11-06T10:00:00.000Z",
    mainSpecId: 256,
  });
  expect(r.lastLoginAt).toBe(new Date(1793922719000).toISOString());
  expect(r.equipment).toHaveLength(12);
  expect(r.professions).toHaveLength(5);
});

test("equipment: 12 slots with item level and quality", () => {
  const e = mapEquipment(parts.equipment);
  expect(e).toHaveLength(12);
  expect(e[0]).toMatchObject({
    slot: "CHEST",
    slotName: "Brust",
    itemId: 10421,
    name: "Raue Kupferweste",
    quality: "UNCOMMON",
    itemLevel: 10,
    enchantments: [],
  });
  expect(mapEquipment(null)).toEqual([]);
});

test("tooltip fields of an armor piece", () => {
  const waist = mapEquipment(parts.equipment).find((i) => i.slot === "WAIST")!;
  expect(waist.tooltip).toEqual({
    binding: "Wird beim Aufheben gebunden", unique: null, slotType: "Taille", subclass: "Schwere Rüstung", containerSlots: null,
    armor: "104 Rüstung", block: null, damage: null, speed: null, dps: null,
    stats: ["+3 Stärke", "+7 Ausdauer"], spells: [], description: null,
    durability: "Haltbarkeit 34 / 35", requiredLevel: "Benötigt Stufe 15",
    sellPrice: { gold: 0, silver: 5, copper: 5 },
  });
});

test("tooltip fields of a weapon and a shield", () => {
  const items = mapEquipment(parts.equipment);
  expect(items.find((i) => i.slot === "MAIN_HAND")!.tooltip).toMatchObject({
    slotType: "Einhändig", subclass: "Schwert", damage: "26 - 50 Schaden", speed: "Tempo 2,60",
    dps: "(14,6 Schaden pro Sekunde)", sellPrice: { gold: 0, silver: 22, copper: 4 },
  });
  expect(items.find((i) => i.slot === "OFF_HAND")!.tooltip!.block).toBe("1.367 Blocken");
});

test("hidden subclass, equip effect and description", () => {
  expect(mapEquipment(parts.equipment).find((i) => i.slot === "BACK")!.tooltip!.subclass).toBeNull();
  const t = mapItemTooltip({ spells: [{ description: "Anlegen: Erhöht X." }], description: "Für Deliah",
    unique_equipped: "Einzigartig" });
  expect([t.spells, t.description, t.unique, t.stats, t.sellPrice]).toEqual([["Anlegen: Erhöht X."], "Für Deliah", "Einzigartig", [], null]);
});

test("enchantments as display text", () => {
  const main = mapEquipment(f("exalor-equipment")).find((i) => i.slot === "MAIN_HAND");
  expect(main?.enchantments).toEqual(["Beschwert +2"]);
});

test("specialization and main tree", () => {
  const s = mapSpecs(parts.specializations);
  expect(s.map((x) => [x.specId, x.spentPoints, x.talents.length])).toEqual([
    [26, 5, 1],
    [256, 7, 2],
  ]);
  expect(s[0].talents[0]).toEqual({
    talentId: 135488,
    spellId: 16462,
    name: "Abwehr",
    rank: 5,
    description: "Erhöht Eure Parierchance um 5%.",
  });
  expect(pickMainSpec(s)).toBe(256);
});

test("main tree null on a tie at the top or without points", () => {
  const spec = (id: number, p: number) => ({ specId: id, name: "x", spentPoints: p, talents: [] });
  expect(pickMainSpec([spec(1, 4), spec(2, 4), spec(3, 1)])).toBeNull();
  expect(pickMainSpec([spec(1, 0), spec(2, 0)])).toBeNull();
  expect(pickMainSpec([])).toBeNull();
  expect(pickMainSpec([spec(1, 2), spec(2, 2), spec(3, 4)])).toBe(3);
});

test("no specialization (field missing) yields an empty list", () => {
  expect(mapSpecs(f("thulmor-specializations"))).toEqual([]);
  expect(mapSpecs(null)).toEqual([]);
});

test("professions in German, recipes in English", () => {
  const p = mapProfessions(parts.professions);
  expect(p.map((x) => [x.id, x.name, x.skill, x.max, x.primary, x.recipes.length])).toEqual([
    [186, "Bergbau", 91, 150, true, 6],
    [164, "Schmiedekunst", 65, 150, true, 28],
    [185, "Kochkunst", 40, 75, false, 9],
    [356, "Angeln", 1, 75, false, 1],
    [129, "Erste Hilfe", 70, 75, false, 4],
  ]);
  expect(p[0].recipes).toContain("Smelt Tin");
  expect(p[0].nameEn).toBe("Mining");
});

test("unknown profession keeps the English name, missing lists count as empty", () => {
  const p = mapProfessions({
    primaries: [{ profession: { id: 999, name: "Archaeology" }, tiers: [{ skill_points: 3, max_skill_points: 75 }] }],
  });
  expect(p).toEqual([
    { id: 999, name: "Archaeology", nameEn: "Archaeology", skill: 3, max: 75, primary: true, recipes: [], recipeIds: [] },
  ]);
  expect(mapProfessions(null)).toEqual([]);
});

test("images as a key to URL table, null without images", () => {
  expect(mapMedia(parts.media)?.["main-raw"]).toBe(
    "https://render.worldofwarcraft.com/forever-eu/character/11/382219-main-raw.png",
  );
  expect(Object.keys(mapMedia(parts.media) ?? {})).toEqual(["main-raw", "main-sd-raw", "avatar", "avatar-sd"]);
  expect(mapMedia(null)).toBeNull();
});

test("without a profile (404) only roster data", () => {
  const seeroth: RosterEntry = {
    id: 374723, name: "Seeroth", surname: "Totenglanz", slug: "seeroth-totenglanz", level: 6, classId: 2, raceId: 5, rank: 3,
  };
  const r = buildCharacterRecord(
    seeroth,
    { profile: null, specializations: null, equipment: null, media: null, professions: null, raids: null, achievements: null, statistics: null, reputations: null },
    "t",
  );
  expect(r).toEqual({
    id: 374723, name: "Seeroth", surname: "Totenglanz", slug: "seeroth-totenglanz", fetchedAt: "t", hasProfile: false,
    level: 6, classId: 2, raceId: 5, className: null, raceName: null, gender: null, rulesetName: null,
    equippedItemLevel: null, lastLoginAt: null, media: null, equipment: [], specs: [], mainSpecId: null,
    professions: [], raidsRaw: null, instances: null, reputations: null, stats: null, statValues: null, statTexts: null,
  });
});

test("profile without images and without specialization", () => {
  const r = buildCharacterRecord(luvia, { ...parts, media: null, specializations: f("thulmor-specializations") }, "t");
  expect(r.media).toBeNull();
  expect(r.specs).toEqual([]);
  expect(r.mainSpecId).toBeNull();
});

test("raid response is stored unchanged without _links and character", () => {
  expect(buildCharacterRecord(luvia, parts, "t").raidsRaw).toEqual({});
  const withData = { ...parts, raids: { _links: {}, character: {}, expansions: [{ id: 1 }] } };
  expect(buildCharacterRecord(luvia, withData, "t").raidsRaw).toEqual({ expansions: [{ id: 1 }] });
});

test("recipe IDs parallel to the recipe names", () => {
  const p = mapProfessions(parts.professions);
  expect(p[0].recipes[0]).toBe("Smelt Tin");
  expect(p[0].recipeIds?.[0]).toBe(1848);
  for (const x of p) expect(x.recipeIds).toHaveLength(x.recipes.length);
});

test("achievement progress: only achievements with completed criteria, only their IDs", () => {
  expect(mapAchievementProgress(f("chordrak-achievements"))).toEqual([
    { id: 62031, completed: false, criteria: [230766, 230760] },
  ]);
  const done = { achievements: [{ id: 684, completed_timestamp: 1793887032000, criteria: { id: 230797, is_completed: true } }] };
  expect(mapAchievementProgress(done)).toEqual([{ id: 684, completed: true, criteria: [] }]);
  expect(mapAchievementProgress(null)).toEqual([]);
});

test("achievement with an account-wide timestamp but an open own criterion does not count (alt)", () => {
  // This is how Blizzard returns "Erkundet Steinkrallengebirge" for an alt whose main character explored the zone.
  const twink = {
    achievements: [
      {
        id: 847,
        completed_timestamp: 1794775500000,
        criteria: { id: 1, is_completed: false, child_criteria: [{ id: 127489, is_completed: false }] },
      },
      { id: 62000, completed_timestamp: 1794609000000 },
    ],
  };
  expect(mapAchievementProgress(twink)).toEqual([{ id: 62000, completed: true, criteria: [] }]);
});

test("boss kills from the dungeons and raids statistics category", () => {
  const kills = mapBossKills(f("chordrak-statistics"));
  expect(kills).toContainEqual({
    boss: "Bazzalan",
    instance: "Flammenschlund",
    quantity: 1,
    lastAt: new Date(1793887032000).toISOString(),
  });
  expect(kills).toContainEqual(expect.objectContaining({ boss: "Rath'mael", instance: "Ruinen von Lordaeron" }));
  expect(kills).toHaveLength(2);
  expect(mapBossKills(null)).toEqual([]);
});

test("boss name with and without instance in parentheses", () => {
  expect(parseBossKillName("Siege über Bazzalan (Flammenschlund)")).toEqual({ boss: "Bazzalan", instance: "Flammenschlund" });
  expect(parseBossKillName("Siege über Onyxia")).toEqual({ boss: "Onyxia", instance: null });
  expect(parseBossKillName("Etwas anderes")).toEqual({ boss: "Etwas anderes", instance: null });
});

test("dungeon and raid progress in the record, null without both parts", () => {
  expect(buildCharacterRecord(luvia, parts, "t").instances).toBeNull();
  const r = buildCharacterRecord(luvia, { ...parts, achievements: f("chordrak-achievements"), statistics: f("chordrak-statistics") }, "t");
  expect(r.instances?.achievements).toHaveLength(1);
  expect(r.instances?.bossKills).toHaveLength(2);
});

test("reputation: faction, tier and progress within the tier", () => {
  const reps = mapReputations(f("chordrak-reputations"));
  expect(reps).toHaveLength(11);
  expect(reps.find((r) => r.factionId === 76)).toEqual({
    factionId: 76, name: "Orgrimmar", tier: 4, tierName: "Freundlich", value: 1485, max: 6000,
  });
  expect(mapReputations(null)).toEqual([]);
  expect(buildCharacterRecord(luvia, parts, "t").reputations).toBeNull();
  expect(buildCharacterRecord(luvia, { ...parts, reputations: f("chordrak-reputations") }, "t").reputations).toHaveLength(11);
});

test("complete statistics in compact form: ID to value, texts of the \"most often\" statistics separately", () => {
  const s = mapStatValues(f("chordrak-statistics"));
  expect(Object.keys(s!.values)).toHaveLength(41);
  expect(s!.values["60"]).toBe(4);
  expect(s!.values["353"]).toBe(4);
  expect(s!.values["63571"]).toBe(1);
  expect(s!.texts).toEqual({ "1336": "Humanoid", "1489": "Östliche Königreiche" });
  expect(mapStatValues(null)).toBeNull();
  expect(mapStatValues({ categories: [{ id: 1, statistics: [{ id: 2, quantity: "x" }, { id: 3, quantity: 5 }] }] })).toEqual({ values: { "3": 5 }, texts: {} });
});

test("record carries the complete statistics, null without statistics", () => {
  expect(buildCharacterRecord(luvia, parts, "t").statValues).toBeNull();
  const r = buildCharacterRecord(luvia, { ...parts, statistics: f("chordrak-statistics") }, "t");
  expect(r.statValues?.["1197"]).toBe(1590);
  expect(r.statTexts?.["1336"]).toBe("Humanoid");
});
