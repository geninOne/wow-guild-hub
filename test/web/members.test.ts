import { describe, expect, test } from "vitest";
import { classDistribution, filterMembers, levelDistribution, parseRankValue, raceDistribution, rankGroups, sortMembers } from "../../web/src/lib/members";
import type { MemberRow } from "../../src/api/types";

function row(over: Partial<MemberRow>): MemberRow {
  return {
    id: 1,
    name: "X",
    surname: null,
    slug: "x",
    level: 10,
    classId: 1,
    className: "Krieger",
    raceId: 1,
    raceName: "Mensch",
    rank: 3,
    rankName: "Rang 3",
    itemLevel: null,
    mainSpecName: null,
    hasProfile: true,
    former: false,
    guildSlug: "bärenklaue",
    guildName: "Bärenklaue",
    professions: [],
    ...over,
  };
}

const rows: MemberRow[] = [
  row({ id: 1, name: "Gelmar", surname: "Soulvenn", classId: 5, className: "Priester", rank: 3, itemLevel: 11 }),
  row({ id: 2, name: "Brom", classId: 1, className: "Krieger", rank: 2, itemLevel: 3 }),
  row({ id: 3, name: "Anja", classId: 5, className: "Priester", rank: 1, itemLevel: 3, guildSlug: "goldene-bärenklaue", guildName: "Goldene Bärenklaue" }),
  row({ id: 4, name: "Alter Hase", classId: 5, className: "Priester", rank: 3, itemLevel: null, former: true }),
];

test("former members hidden by default, shown with the switch", () => {
  expect(filterMembers(rows, { text: "", classId: null, rank: null, guildSlug: null, showFormer: false }).some((r) => r.former)).toBe(false);
  expect(filterMembers(rows, { text: "", classId: null, rank: null, guildSlug: null, showFormer: true })).toHaveLength(rows.length);
});

test("text search in name and surname, class and rank", () => {
  expect(filterMembers(rows, { text: "SOUL", classId: null, rank: null, guildSlug: null, showFormer: false }).map((r) => r.name)).toEqual(["Gelmar"]);
  expect(filterMembers(rows, { text: "", classId: 5, rank: 3, guildSlug: null, showFormer: false }).every((r) => r.classId === 5 && r.rank === 3)).toBe(true);
});

test("sorting with null last and name on a tie", () => {
  expect(sortMembers(rows, "itemLevel", "desc").map((r) => r.itemLevel)).toEqual([11, 3, 3, null]);
  expect(sortMembers(rows, "itemLevel", "asc").at(-1)!.itemLevel).toBeNull();
  expect(sortMembers(rows, "itemLevel", "desc").map((r) => r.name)).toEqual(["Gelmar", "Anja", "Brom", "Alter Hase"]);
});

test("class distribution without former members", () => {
  expect(classDistribution(rows)).toEqual([
    { classId: 5, className: "Priester", count: 2 },
    { classId: 1, className: "Krieger", count: 1 },
  ]);
});

test("level distribution in steps of ten, level 60 on its own, without former members", () => {
  const levels = levelDistribution([
    row({ level: 1 }), row({ level: 9 }), row({ level: 10 }), row({ level: 59 }), row({ level: 60 }), row({ level: 60, former: true }),
  ]);
  expect(levels.map((l) => [l.label, l.count])).toEqual([
    ["1 bis 9", 2], ["10 bis 19", 1], ["20 bis 29", 0], ["30 bis 39", 0], ["40 bis 49", 0], ["50 bis 59", 1], ["Level 60", 1],
  ]);
});

test("guild filter: only members of the selected guild, null shows all", () => {
  const f = { text: "", classId: null, rank: null, showFormer: false };
  expect(filterMembers(rows, { ...f, guildSlug: "goldene-bärenklaue" }).map((r) => r.name)).toEqual(["Anja"]);
  expect(filterMembers(rows, { ...f, guildSlug: "bärenklaue" }).map((r) => r.name)).toEqual(["Gelmar", "Brom"]);
  expect(filterMembers(rows, { ...f, guildSlug: null })).toHaveLength(3);
});

test("sorting by guild", () => {
  expect(sortMembers(rows, "guildName", "desc")[0].name).toBe("Anja");
});

const GUILDS = [
  { slug: "bärenklaue", name: "Bärenklaue", faction: "HORDE", memberCount: 2, main: true },
  { slug: "goldene-bärenklaue", name: "Goldene Bärenklaue", faction: "ALLIANCE", memberCount: 1, main: false },
];

describe("rank filter per guild", () => {
  const differing = [
    { guildSlug: "bärenklaue", rank: 0, name: "Gildenmeister" },
    { guildSlug: "bärenklaue", rank: 1, name: "Gildenleitung" },
    { guildSlug: "goldene-bärenklaue", rank: 0, name: "Rang 0" },
    { guildSlug: "goldene-bärenklaue", rank: 1, name: "Rang 1" },
  ];

  test("all guilds with differing names: grouped by guild", () => {
    const g = rankGroups(differing, GUILDS, null);
    expect(g.map((x) => x.label)).toEqual(["Bärenklaue", "Goldene Bärenklaue"]);
    expect(g[0].options).toEqual([
      { value: "bärenklaue:0", label: "Gildenmeister" },
      { value: "bärenklaue:1", label: "Gildenleitung" },
    ]);
    expect(g[1].options[0]).toEqual({ value: "goldene-bärenklaue:0", label: "Rang 0" });
  });

  test("selected guild: plain list with its names", () => {
    const g = rankGroups(differing, GUILDS, "bärenklaue");
    expect(g).toHaveLength(1);
    expect(g[0].label).toBeNull();
    expect(g[0].options.map((o) => o.label)).toEqual(["Gildenmeister", "Gildenleitung"]);
  });

  test("same names in all guilds: one plain list", () => {
    const same = [
      { guildSlug: "bärenklaue", rank: 1, name: "Offizier" },
      { guildSlug: "goldene-bärenklaue", rank: 1, name: "Offizier" },
      { guildSlug: "bärenklaue", rank: 7, name: "Rang 7" },
    ];
    expect(rankGroups(same, GUILDS, null)).toEqual([
      { label: null, options: [{ value: "1", label: "Offizier" }, { value: "7", label: "Rang 7" }] },
    ]);
  });

  test("select value back into rank and guild", () => {
    expect(parseRankValue("")).toEqual({ rank: null, rankGuildSlug: null });
    expect(parseRankValue("3")).toEqual({ rank: 3, rankGuildSlug: null });
    expect(parseRankValue("goldene-bärenklaue:2")).toEqual({ rank: 2, rankGuildSlug: "goldene-bärenklaue" });
  });

  test("filter with rankGuildSlug only matches members of that guild", () => {
    const f = { text: "", classId: null, showFormer: false, guildSlug: null };
    expect(filterMembers(rows, { ...f, rank: 1, rankGuildSlug: "goldene-bärenklaue" }).map((r) => r.name)).toEqual(["Anja"]);
    expect(filterMembers(rows, { ...f, rank: 1, rankGuildSlug: "bärenklaue" })).toEqual([]);
    expect(filterMembers(rows, { ...f, rank: 1 }).map((r) => r.name)).toEqual(["Anja"]);
  });
});

describe("race distribution", () => {
  const people = [
    row({ id: 1, raceId: 2, raceName: "Orc", classId: 1, level: 60 }),
    row({ id: 2, raceId: 2, raceName: "Orc", classId: 3, className: "Jäger", level: 14 }),
    row({ id: 3, raceId: 8, raceName: "Troll", classId: 1, level: 15 }),
    row({ id: 4, raceId: 5, raceName: "Untoter", classId: 5, className: "Priester", level: 60 }),
    row({ id: 5, raceId: 5, raceName: "Untoter", classId: 1, level: 60, former: true }),
  ];

  test("without a filter: all active, most common race first, ties alphabetically, shares sum to 1", () => {
    const d = raceDistribution(people, { classId: null, band: null });
    expect(d.map((s) => [s.raceName, s.count])).toEqual([["Orc", 2], ["Troll", 1], ["Untoter", 1]]);
    expect(d[0].share).toBe(0.5);
    expect(d.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1);
  });

  test("by class", () => {
    expect(raceDistribution(people, { classId: 1, band: null }).map((s) => [s.raceName, s.count, s.share])).toEqual([
      ["Orc", 1, 0.5], ["Troll", 1, 0.5],
    ]);
  });

  test("by level range, bounds inclusive", () => {
    expect(raceDistribution(people, { classId: null, band: { from: 10, to: 19 } }).map((s) => s.raceName)).toEqual(["Orc", "Troll"]);
    expect(raceDistribution(people, { classId: null, band: { from: 60, to: 60 } }).map((s) => [s.raceName, s.count])).toEqual([["Orc", 1], ["Untoter", 1]]);
  });

  test("class and level combined, empty without hits", () => {
    expect(raceDistribution(people, { classId: 1, band: { from: 60, to: 60 } }).map((s) => [s.raceName, s.share])).toEqual([["Orc", 1]]);
    expect(raceDistribution(people, { classId: 5, band: { from: 1, to: 9 } })).toEqual([]);
  });
});
