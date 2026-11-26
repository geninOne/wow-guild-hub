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
const ohneProfil = member({
  id: 7,
  name: "Leer",
  slug: "leer",
  classId: 2,
  raceId: 1,
  level: 14,
  hasProfile: false,
  lastFetchedAt: null,
});
const ehemalig = member({ id: 8, name: "Weg", slug: "weg", former: true, leftAt: "2026-11-05T00:00:00.000Z" });
const altAktiv = member({ id: 20, name: "Alt", slug: "alt-name", former: false });
const altEhemalig = member({ id: 21, name: "Alt", slug: "alt-name", former: true });

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

const guild = guildOf([gelmarMember, ohneProfil, ehemalig]);
const guildMitDoppeltemSlug = guildOf([altEhemalig, altAktiv]);

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

const zweiGilden: GuildRecord["guilds"] = [
  { slug: "bärenklaue", id: 1, name: "Bärenklaue", faction: "HORDE", memberCount: 76, rulesetName: "Normal", main: true },
  { slug: "goldene-bärenklaue", id: 2, name: "Goldene Bärenklaue", faction: "ALLIANCE", memberCount: 19, rulesetName: "Normal", main: false },
];

describe("Charakteransicht", () => {
  test("findMember per Slug, ID und mit Vorrang für Aktive", () => {
    expect(findMember(guild, "Gelmar-Soulvenn")?.id).toBe(1647409);
    expect(findMember(guild, "1647409")?.slug).toBe("gelmar-soulvenn");
    expect(findMember(guildMitDoppeltemSlug, "alt-name")?.former).toBe(false);
    expect(findMember(guild, "gibt-es-nicht")).toBeNull();
  });

  test("Vollständige Statistik bleibt im Speicher und geht nicht an die Seite", () => {
    const record = { ...gelmar, statValues: { "60": 4 }, statTexts: { "1336": "Humanoid" } };
    const v = buildCharacterView({ ...base, record })!;
    expect(v.character).not.toHaveProperty("statValues");
    expect(v.character).not.toHaveProperty("statTexts");
  });

  test("Gelmar: Kopf, Rang und nur eigene Icons", () => {
    const v = buildCharacterView({
      ...base,
      guild: { ...guild, guilds: zweiGilden },
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

  test("Mitglied ohne gespeicherten Record ergibt Rumpfansicht", () => {
    const v = buildCharacterView({ ...base, member: ohneProfil, record: null })!;
    expect(v.character).toMatchObject({
      hasProfile: false,
      equipment: [],
      specs: [],
      media: null,
      level: ohneProfil.level,
    });
    expect(v.character.fetchedAt).toBe(ohneProfil.firstSeenAt);
    expect(v.className).toBe("Paladin");
  });

  test("Ehemaliger und Fremder", () => {
    expect(buildCharacterView({ ...base, member: ehemalig, record: null })!.former).toBe(true);
    expect(buildCharacterView({ ...base, member: null, record: null })).toBeNull();
  });

  test("Record ohne Mitglied hat keinen Rang", () => {
    const v = buildCharacterView({ ...base, member: null })!;
    expect(v.rank).toBeNull();
    expect(v.rankName).toBeNull();
    expect(v.former).toBe(false);
  });
});

describe("Gilde und Rezepte in der Charakteransicht", () => {
  test("Mitglied der Goldenen Bärenklaue zeigt deren Namen und Fraktion", () => {
    const allianz = { ...gelmarMember, guildSlug: "goldene-bärenklaue" };
    const g: GuildRecord = {
      ...guildOf([allianz]),
      guilds: [
        { slug: "bärenklaue", id: 1, name: "Bärenklaue", faction: "HORDE", memberCount: 76, rulesetName: "Normal", main: true },
        { slug: "goldene-bärenklaue", id: 2, name: "Goldene Bärenklaue", faction: "ALLIANCE", memberCount: 19, rulesetName: "Normal", main: false },
      ],
    };
    const v = buildCharacterView({ ...base, member: allianz, guild: g });
    expect([v?.guildName, v?.guildFaction]).toEqual(["Goldene Bärenklaue", "ALLIANCE"]);
    expect(buildCharacterView(base)?.guildFaction).toBe("HORDE");
  });

  test("Rangname im Charakterkopf je Gilde, Rückfall Rang N", () => {
    const names = { bärenklaue: { "3": "Mitglied" }, "goldene-bärenklaue": { "4": "Veteran" } };
    const g: GuildRecord = { ...guildOf([gelmarMember]), guilds: zweiGilden };
    const horde = buildCharacterView({ ...base, guild: g, rankNames: names });
    expect(horde?.rankName).toBe("Mitglied");
    const allianz = { ...gelmarMember, guildSlug: "goldene-bärenklaue" };
    const ally = buildCharacterView({ ...base, member: allianz, guild: { ...guildOf([allianz]), guilds: zweiGilden }, rankNames: names });
    expect(ally?.rankName).toBe("Rang 3");
  });

  test("Rezepte deutsch, englisch als Rückfall", () => {
    const record: CharacterRecord = {
      ...gelmar,
      professions: [{ id: 186, name: "Bergbau", nameEn: "Mining", skill: 1, max: 75, primary: true, recipes: ["Smelt Tin", "Mining"], recipeIds: [1848, 1570] }],
    };
    const v = buildCharacterView({ ...base, record, recipeNames: { "1848": "Zinn verhütten", "1570": null } });
    expect(v?.character.professions[0].recipes).toEqual(["Zinn verhütten", "Mining"]);
    expect(record.professions[0].recipes).toEqual(["Smelt Tin", "Mining"]);
  });
});
