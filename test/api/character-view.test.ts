import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { buildCharacterView, findMember } from "../../src/api/character-view";
import type {
  CharacterRecord,
  GuildRecord,
  MemberSummary,
  NamedList,
} from "../../src/model";

const gelmar: CharacterRecord = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../fixtures/records/character-1647409.json", import.meta.url)),
    "utf-8",
  ),
);

function member(over: Partial<MemberSummary>): MemberSummary {
  return {
    id: 1,
    name: "Test",
    surname: null,
    slug: "test",
    rank: 0,
    level: 10,
    classId: 1,
    raceId: 1,
    hasProfile: true,
    former: false,
    firstSeenAt: "2026-11-01T00:00:00.000Z",
    leftAt: null,
    lastFetchedAt: "2026-11-06T10:00:00.000Z",
    equippedItemLevel: null,
    mainSpecName: null,
    professions: [],
    ...over,
  };
}

const gelmarMember = member({
  id: 1647409,
  name: "Gelmar",
  surname: "Soulvenn",
  slug: "gelmar-soulvenn",
  rank: 3,
  classId: 5,
  raceId: 5,
});
const noProfile = member({
  id: 7,
  name: "Leer",
  slug: "leer",
  classId: 2,
  raceId: 1,
  level: 14,
  hasProfile: false,
  lastFetchedAt: null,
});
const formerMember = member({ id: 8, name: "Weg", slug: "weg", former: true, leftAt: "2026-11-05T00:00:00.000Z" });
const dupActive = member({ id: 20, name: "Alt", slug: "alt-name", former: false });
const dupFormer = member({ id: 21, name: "Alt", slug: "alt-name", former: true });

function guildOf(members: MemberSummary[]): GuildRecord {
  return {
    fetchedAt: "2026-11-06T10:00:00.000Z",
    id: 99,
    name: "Bärenklaue",
    faction: "HORDE",
    memberCount: members.length,
    rulesetName: "Classic",
    members,
  };
}

const guild = guildOf([gelmarMember, noProfile, formerMember]);
const guildWithDuplicateSlug = guildOf([dupFormer, dupActive]);

const classes: NamedList = {
  items: [
    { id: 2, name: "Paladin" },
    { id: 5, name: "Priester" },
  ],
};
const races: NamedList = {
  items: [
    { id: 1, name: "Mensch" },
    { id: 5, name: "Untoter" },
  ],
};

const base = {
  member: gelmarMember,
  record: gelmar,
  guild,
  classes,
  races,
  itemIcons: null,
  rankNames: {},
};

const twoGuilds: GuildRecord["guilds"] = [
  { slug: "bärenklaue", id: 1, name: "Bärenklaue", faction: "HORDE", memberCount: 76, rulesetName: "Normal", main: true },
  { slug: "goldene-bärenklaue", id: 2, name: "Goldene Bärenklaue", faction: "ALLIANCE", memberCount: 19, rulesetName: "Normal", main: false },
];

describe("character view", () => {
  test("findMember by slug, by ID and with priority for active members", () => {
    expect(findMember(guild, "Gelmar-Soulvenn")?.id).toBe(1647409);
    expect(findMember(guild, "1647409")?.slug).toBe("gelmar-soulvenn");
    expect(findMember(guildWithDuplicateSlug, "alt-name")?.former).toBe(false);
    expect(findMember(guild, "gibt-es-nicht")).toBeNull();
  });

  test("full statistics stay in storage and are not sent to the page", () => {
    const record = { ...gelmar, statValues: { "60": 4 }, statTexts: { "1336": "Humanoid" } };
    const v = buildCharacterView({ ...base, record })!;
    expect(v.character).not.toHaveProperty("statValues");
    expect(v.character).not.toHaveProperty("statTexts");
  });

  test("missing item level from static/item-levels, a delivered level takes precedence", () => {
    const [a, b, c] = gelmar.equipment;
    const record = { ...gelmar, equipment: [{ ...a, itemLevel: null }, { ...b, itemLevel: 20 }, { ...c, itemLevel: null }] };
    const itemLevels = { [a.itemId]: 31, [b.itemId]: 99, [c.itemId]: null };
    const v = buildCharacterView({ ...base, record, itemLevels })!;
    expect(v.character.equipment.map((e) => e.itemLevel)).toEqual([31, 20, null]);
    expect(buildCharacterView({ ...base, record })!.character.equipment[0].itemLevel).toBeNull();
  });

  test("Gelmar: header, rank and only own icons", () => {
    const v = buildCharacterView({
      ...base,
      guild: { ...guild, guilds: twoGuilds },
      itemIcons: { "53": "https://render.worldofwarcraft.com/a.jpg", "999999": "x" },
      rankNames: { bärenklaue: { "3": "Mitglied" } },
    })!;
    expect(v).toMatchObject({
      className: "Priester",
      raceName: "Untoter",
      guildName: "Bärenklaue",
      rank: 3,
      rankName: "Mitglied",
      former: false,
    });
    expect(Object.keys(v.itemIcons).sort()).toEqual(
      gelmar.equipment.map((i) => String(i.itemId)).sort(),
    );
    expect(v.itemIcons["999999"]).toBeUndefined();
    expect(v.itemIcons["53"]).toBe("https://render.worldofwarcraft.com/a.jpg");
  });

  test("member without a stored record yields a minimal view", () => {
    const v = buildCharacterView({ ...base, member: noProfile, record: null })!;
    expect(v.character).toMatchObject({
      hasProfile: false,
      equipment: [],
      specs: [],
      media: null,
      level: noProfile.level,
    });
    expect(v.character.fetchedAt).toBe(noProfile.firstSeenAt);
    expect(v.className).toBe("Paladin");
  });

  test("former member and stranger", () => {
    expect(buildCharacterView({ ...base, member: formerMember, record: null })!.former).toBe(true);
    expect(buildCharacterView({ ...base, member: null, record: null })).toBeNull();
  });

  test("record without a member has no rank", () => {
    const v = buildCharacterView({ ...base, member: null })!;
    expect(v.rank).toBeNull();
    expect(v.rankName).toBeNull();
    expect(v.former).toBe(false);
  });
});

describe("guild and recipes in the character view", () => {
  test("member of Goldene Bärenklaue shows its name and faction", () => {
    const alliance = { ...gelmarMember, guildSlug: "goldene-bärenklaue" };
    const g: GuildRecord = {
      ...guildOf([alliance]),
      guilds: [
        { slug: "bärenklaue", id: 1, name: "Bärenklaue", faction: "HORDE", memberCount: 76, rulesetName: "Normal", main: true },
        { slug: "goldene-bärenklaue", id: 2, name: "Goldene Bärenklaue", faction: "ALLIANCE", memberCount: 19, rulesetName: "Normal", main: false },
      ],
    };
    const v = buildCharacterView({ ...base, member: alliance, guild: g });
    expect([v?.guildName, v?.guildFaction]).toEqual(["Goldene Bärenklaue", "ALLIANCE"]);
    expect(buildCharacterView(base)?.guildFaction).toBe("HORDE");
  });

  test("rank name in the character header per guild, fallback Rang N", () => {
    const names = { bärenklaue: { "3": "Mitglied" }, "goldene-bärenklaue": { "4": "Veteran" } };
    const g: GuildRecord = { ...guildOf([gelmarMember]), guilds: twoGuilds };
    const horde = buildCharacterView({ ...base, guild: g, rankNames: names });
    expect(horde?.rankName).toBe("Mitglied");
    const alliance = { ...gelmarMember, guildSlug: "goldene-bärenklaue" };
    const ally = buildCharacterView({ ...base, member: alliance, guild: { ...guildOf([alliance]), guilds: twoGuilds }, rankNames: names });
    expect(ally?.rankName).toBe("Rang 3");
  });

  test("recipes in German, English as fallback", () => {
    const record: CharacterRecord = {
      ...gelmar,
      professions: [{ id: 186, name: "Bergbau", nameEn: "Mining", skill: 1, max: 75, primary: true, recipes: ["Smelt Tin", "Mining"], recipeIds: [1848, 1570] }],
    };
    const v = buildCharacterView({ ...base, record, recipeNames: { "1848": "Zinn verhütten", "1570": null } });
    expect(v?.character.professions[0].recipes).toEqual(["Zinn verhütten", "Mining"]);
    expect(record.professions[0].recipes).toEqual(["Smelt Tin", "Mining"]);
  });
});
