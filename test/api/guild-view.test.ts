import { describe, expect, test } from "vitest";
import { buildGuildView, guildRefs, memberGuild } from "../../src/api/guild-view";
import { parseRankNames, rankName } from "../../src/api/config";

const RANK_NAMES = parseRankNames(JSON.stringify({
  _hinweis: "Kommentar",
  bärenklaue: ["Gildenmeister", "Gildenleitung", "Twink GL", "Ratsmitglied", "Mitglied", "Allianz Spion!", "Twink", "Frischling"],
  "goldene-bärenklaue": { "0": "Gildenmeister", "1": "Gildenleitung", "2": "Twink GL", "3": "Ratsmitglied", "4": "Mitglied", "5": "Horde Spion!", "6": "Twink", "7": "Frischling", x: "ignoriert" },
  andere: { "0": "Chef", "3": 4 },
}));
import type { GuildInfo, GuildRecord, MemberSummary, NamedList } from "../../src/model";

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

const guild: GuildRecord = {
  fetchedAt: "2026-11-06T10:00:00.000Z",
  id: 99,
  name: "Bärenklaue",
  faction: "HORDE",
  memberCount: 2,
  rulesetName: "Classic",
  members: [
    member({
      id: 1647409,
      name: "Gelmar",
      surname: "Soulvenn",
      slug: "gelmar-soulvenn",
      classId: 5,
      raceId: 5,
      rank: 3,
      level: 25,
      equippedItemLevel: 3,
      mainSpecName: "Disziplin",
      professions: [{ id: 197, skill: 37 }],
    }),
    member({ id: 2, name: "Ohneprofil", slug: "ohneprofil", hasProfile: false }),
    member({ id: 3, name: "Gegangen", slug: "gegangen", rank: 7, former: true }),
  ],
};

const classes: NamedList = { items: [{ id: 5, name: "Priester" }] };
const races: NamedList = { items: [{ id: 5, name: "Untoter" }] };

const GUILDS: GuildInfo[] = [
  { slug: "bärenklaue", id: 1, name: "Bärenklaue", faction: "HORDE", memberCount: 76, rulesetName: "Normal", main: true },
  { slug: "goldene-bärenklaue", id: 2, name: "Goldene Bärenklaue", faction: "ALLIANCE", memberCount: 19, rulesetName: "Normal", main: false },
];

describe("buildGuildView", () => {
  test("names for class, race, rank and profession", () => {
    const v = buildGuildView({ ...guild, guilds: GUILDS }, classes, races, { bärenklaue: { "3": "Mitglied" } });
    expect(v.members[0]).toMatchObject({
      className: "Priester",
      raceName: "Untoter",
      rankName: "Mitglied",
      itemLevel: 3,
      professions: [{ id: 197, name: "Schneiderei", skill: 37 }],
    });
  });

  test("missing names yield readable placeholders", () => {
    const v = buildGuildView(guild, null, null, {});
    expect([v.members[0].className, v.members[0].raceName, v.members[2].rankName]).toEqual([
      "Klasse 5",
      "Volk 5",
      "Rang 7",
    ]);
  });

  test("unknown profession yields a placeholder", () => {
    const g = { ...guild, members: [member({ professions: [{ id: 9999, skill: 1 }] })] };
    expect(buildGuildView(g, classes, races, {}).members[0].professions[0].name).toBe("Beruf 9999");
  });

  test("rank list per guild from configuration and ranks in use", () => {
    // Both guilds have ranks 0 to 7 in the configuration, rank 7 also occurs for a former member.
    const v = buildGuildView({ ...guild, guilds: GUILDS }, classes, races, RANK_NAMES);
    const of = (slug: string) => v.ranks.filter((r) => r.guildSlug === slug).map((r) => r.rank);
    expect(of("bärenklaue")).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(of("goldene-bärenklaue")).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(v.ranks.find((r) => r.guildSlug === "bärenklaue" && r.rank === 0)?.name).toBe("Gildenmeister");
    expect(v.ranks.find((r) => r.guildSlug === "goldene-bärenklaue" && r.rank === 0)?.name).toBe("Gildenmeister");
    expect(v.ranks.find((r) => r.guildSlug === "bärenklaue" && r.rank === 7)?.name).toBe("Frischling");
  });

  test("former members stay in the response, marked", () => {
    const v = buildGuildView(guild, classes, races, RANK_NAMES);
    expect(v.members[2].former).toBe(true);
    expect(v.members).toHaveLength(3);
  });

  test("class list and header data", () => {
    const v = buildGuildView(guild, classes, races, RANK_NAMES);
    expect(v).toMatchObject({ name: "Bärenklaue", faction: "HORDE", memberCount: 2, rulesetName: "Classic" });
    expect(v.classes).toEqual([{ id: 1, name: "Klasse 1" }, { id: 5, name: "Priester" }]);
  });
});

describe("two guilds", () => {
  const twoGuilds: GuildRecord = {
    ...guild,
    guilds: GUILDS,
    members: [
      member({ id: 1, name: "Horde", slug: "horde", guildSlug: "bärenklaue" }),
      member({ id: 2, name: "Allianz", slug: "allianz", guildSlug: "goldene-bärenklaue" }),
      member({ id: 3, name: "Alt", slug: "alt" }),
    ],
  };

  test("guilds in order, main guild first", () => {
    expect(buildGuildView(twoGuilds, classes, races, {}).guilds).toEqual([
      { slug: "bärenklaue", name: "Bärenklaue", faction: "HORDE", memberCount: 76, main: true },
      { slug: "goldene-bärenklaue", name: "Goldene Bärenklaue", faction: "ALLIANCE", memberCount: 19, main: false },
    ]);
  });

  test("members carry their guild, the main guild without guildSlug", () => {
    const v = buildGuildView(twoGuilds, classes, races, {});
    expect(v.members.map((m) => [m.name, m.guildSlug, m.guildName])).toEqual([
      ["Horde", "bärenklaue", "Bärenklaue"],
      ["Allianz", "goldene-bärenklaue", "Goldene Bärenklaue"],
      ["Alt", "bärenklaue", "Bärenklaue"],
    ]);
  });

  test("rank name follows the member's guild", () => {
    const names = { bärenklaue: { "0": "Gildenmeister" }, "goldene-bärenklaue": { "0": "Anführer" } };
    const v = buildGuildView(
      { ...twoGuilds, members: [member({ id: 1, rank: 0, guildSlug: "bärenklaue" }), member({ id: 2, rank: 0, guildSlug: "goldene-bärenklaue" }), member({ id: 3, rank: 0 })] },
      classes, races, names,
    );
    expect(v.members.map((m) => m.rankName)).toEqual(["Gildenmeister", "Anführer", "Gildenmeister"]);
  });

  test("GUILD_RANKS: list and object per guild", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((r) => rankName(r, "bärenklaue", RANK_NAMES))).toEqual([
      "Gildenmeister", "Gildenleitung", "Twink GL", "Ratsmitglied", "Mitglied", "Allianz Spion!", "Twink", "Frischling",
    ]);
    expect([0, 5, 7].map((r) => rankName(r, "goldene-bärenklaue", RANK_NAMES))).toEqual(["Gildenmeister", "Horde Spion!", "Frischling"]);
  });

  test("fallback Rang N for a missing guild, a missing rank or a comment entry", () => {
    expect(rankName(2, "unbekannt", RANK_NAMES)).toBe("Rang 2");
    expect(rankName(9, "bärenklaue", RANK_NAMES)).toBe("Rang 9");
    expect(rankName(0, "_hinweis", RANK_NAMES)).toBe("Rang 0");
    expect(Object.keys(RANK_NAMES)).toEqual(["bärenklaue", "goldene-bärenklaue", "andere"]);
    expect(rankName(0, "bärenklaue", {})).toBe("Rang 0");
  });

  test("empty or broken GUILD_RANKS yields no names", () => {
    expect(parseRankNames(undefined)).toEqual({});
    expect(parseRankNames("")).toEqual({});
    expect(parseRankNames("{kaputt")).toEqual({});
    expect(parseRankNames("[1,2]")).toEqual({});
    expect(rankName(3, "andere", RANK_NAMES)).toBe("Rang 3");
  });

  test("guild name in a different Unicode form finds the names", () => {
    expect(rankName(0, "ba\u0308renklaue", RANK_NAMES)).toBe("Gildenmeister");
  });

  test("old blob without guilds yields one guild from the header fields", () => {
    expect(guildRefs(guild)).toEqual([{ slug: "", name: "Bärenklaue", faction: "HORDE", memberCount: 2, main: true }]);
    expect(buildGuildView(guild, classes, races, {}).members[0]).toMatchObject({ guildSlug: "", guildName: "Bärenklaue" });
    expect(memberGuild(twoGuilds, null).slug).toBe("bärenklaue");
    expect(memberGuild(twoGuilds, member({ guildSlug: "unbekannt" })).slug).toBe("bärenklaue");
  });
});
