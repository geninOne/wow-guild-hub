import { describe, expect, test } from "vitest";
import { applyRecord, fetchOrder, isTwink, mergeRoster, ownAchievementCount, parseRoster } from "../../src/collect/roster";
import { buildCharacterRecord } from "../../src/transform/character";
import { loadFixture } from "../helpers/fixtures";
import { entry, member } from "../helpers/members";

test("parseRoster reads all 76 members", () => {
  const r = parseRoster(loadFixture("roster").data);
  expect(r).toHaveLength(76);
  expect(r[0]).toEqual({
    id: 374723, name: "Seeroth", surname: "Totenglanz", slug: "seeroth-totenglanz",
    level: 6, classId: 2, raceId: 5, rank: 3,
  });
});

test("new member is created", () => {
  const [m] = mergeRoster([], [entry({ id: 5, level: 6, rank: 3, name: "New" })], "t1", "bärenklaue");
  expect(m).toEqual({
    id: 5, name: "New", surname: null, slug: "m5", rank: 3, level: 6, classId: 1, raceId: 2,
    hasProfile: false, former: false, firstSeenAt: "t1", leftAt: null, lastFetchedAt: null,
    equippedItemLevel: null, mainSpecName: null, professions: [], guildSlug: "bärenklaue",
  });
});

test("member with profile keeps its level despite a different roster level, but takes over rank and name", () => {
  const prev = [member({ id: 1, level: 15, hasProfile: true, rank: 4 })];
  const [m] = mergeRoster(prev, [entry({ id: 1, level: 17, rank: 2, name: "Renamed", slug: "renamed-x" })], "t1", "bärenklaue");
  expect([m.level, m.rank, m.name, m.slug]).toEqual([15, 2, "Renamed", "renamed-x"]);
});

test("member without profile takes over the roster level", () => {
  const [m] = mergeRoster([member({ id: 1, level: 6 })], [entry({ id: 1, level: 7 })], "t1", "bärenklaue");
  expect(m.level).toBe(7);
});

test("leaving and returning", () => {
  const start = mergeRoster([], [entry({ id: 1 }), entry({ id: 2 })], "t0", "bärenklaue");
  const afterLeaving = mergeRoster(start, [entry({ id: 1 })], "t1", "bärenklaue");
  expect(afterLeaving.map((m) => [m.id, m.former, m.leftAt])).toEqual([[1, false, null], [2, true, "t1"]]);
  const again = mergeRoster(afterLeaving, [entry({ id: 1 })], "t2", "bärenklaue");
  expect(again[1].leftAt).toBe("t1");
  const returned = mergeRoster(again, [entry({ id: 2 }), entry({ id: 1 })], "t3", "bärenklaue");
  expect(returned.map((m) => [m.id, m.former, m.leftAt, m.firstSeenAt])).toEqual([
    [2, false, null, "t0"], [1, false, null, "t0"],
  ]);
});

test("switching between guilds: stays active, level with profile stays, only guildSlug changes", () => {
  const prev = [member({ id: 1, level: 15, hasProfile: true, guildSlug: "bärenklaue", firstSeenAt: "t0" })];
  const [m] = mergeRoster(prev, [entry({ id: 1, level: 14, guildSlug: "goldene-bärenklaue" })], "t1", "bärenklaue");
  expect(m).toEqual({ ...prev[0], guildSlug: "goldene-bärenklaue" });
});

test("members of a guild that cannot be fetched stay unchanged", () => {
  const prev = [member({ id: 1 }), member({ id: 2, level: 9, rank: 4, guildSlug: "b" })];
  const result = mergeRoster(prev, [entry({ id: 1 })], "t1", "bärenklaue", ["b"]);
  expect(result.find((m) => m.id === 2)).toEqual(prev[1]);
});

test("member of a fetchable secondary guild becomes former when missing", () => {
  const prev = [member({ id: 1 }), member({ id: 2, guildSlug: "b" })];
  const result = mergeRoster(prev, [entry({ id: 1 })], "t1", "bärenklaue", ["c"]);
  expect(result.find((m) => m.id === 2)).toMatchObject({ former: true, leftAt: "t1", guildSlug: "b" });
});

test("legacy data without guildSlug is completed", () => {
  const without = (m: ReturnType<typeof member>) => {
    const { guildSlug: _, ...rest } = m;
    return rest;
  };
  const prev = [without(member({ id: 1 })), without(member({ id: 2 })), without(member({ id: 3, former: true, leftAt: "t0" }))];
  const result = mergeRoster(prev, [entry({ id: 1, guildSlug: "b" })], "t1", "bärenklaue");
  expect(result.map((m) => [m.id, m.guildSlug, m.former])).toEqual([
    [1, "b", false], [2, "bärenklaue", true], [3, "bärenklaue", true],
  ]);
});

test("character in two rosters appears once with the first guild", () => {
  const result = mergeRoster([], [entry({ id: 1, guildSlug: "a" }), entry({ id: 1, guildSlug: "b" })], "t1", "a");
  expect(result.map((m) => [m.id, m.guildSlug])).toEqual([[1, "a"]]);
});

test("fetchOrder: never fetched first, then the oldest, without former members", () => {
  const a = member({ id: 1, lastFetchedAt: "2026-11-06T10:00:00.000Z" });
  const b = member({ id: 2, lastFetchedAt: null });
  const c = member({ id: 3, lastFetchedAt: "2026-11-06T09:00:00.000Z" });
  const d = member({ id: 4, former: true, lastFetchedAt: null });
  expect(fetchOrder([a, b, c, d]).map((m) => m.id)).toEqual([2, 3, 1]);
});

test("applyRecord takes over level, item level, main spec and professions", () => {
  const f = (n: string) => loadFixture(n).data;
  const rec = buildCharacterRecord(
    { id: 382219, name: "Luvia", surname: "Stav", slug: "luvia-stav", level: 20, classId: 1, raceId: 96, rank: 3 },
    { profile: f("luvia-profile"), specializations: f("luvia-specializations"), equipment: f("luvia-equipment"),
      media: f("luvia-media"), professions: f("luvia-professions"), raids: f("luvia-raids"), achievements: null, statistics: null, reputations: null },
    "t5",
  );
  const m = applyRecord(member({ id: 382219, level: 20, name: "old" }), rec, "t5");
  expect(m).toMatchObject({
    level: 21, hasProfile: true, equippedItemLevel: 11, mainSpecName: "Furor", lastFetchedAt: "t5", name: "Luvia",
    surname: "Stav",
  });
  expect(m.professions).toEqual([
    { id: 186, skill: 91 }, { id: 164, skill: 65 }, { id: 185, skill: 40 }, { id: 356, skill: 1 }, { id: 129, skill: 70 },
  ]);
});

test("applyRecord without profile takes over only the roster level", () => {
  const rec = buildCharacterRecord(
    entry({ id: 9, level: 8, name: "Roster" }),
    { profile: null, specializations: null, equipment: null, media: null, professions: null, raids: null, achievements: null, statistics: null, reputations: null },
    "t5",
  );
  const m = applyRecord(member({ id: 9, level: 7, name: "Stored" }), rec, "t5");
  expect([m.level, m.name, m.hasProfile, m.lastFetchedAt]).toEqual([8, "Stored", false, "t5"]);
});

describe("own achievements", () => {
  const withAchievements = (raw: unknown[] | null) =>
    buildCharacterRecord(
      entry({ id: 9, level: 20 }),
      { profile: loadFixture("luvia-profile").data, specializations: null, equipment: null, media: null, professions: null, raids: null,
        statistics: null, reputations: null, achievements: raw === null ? null : { achievements: raw } },
      "t5",
    );
  const done = (id: number) => ({ id, criteria: { is_completed: true } });

  const flags = { "62031": true, "627": false };

  test("alt: account-wide achievements do not count, non-account-wide and still unknown ones do", () => {
    const rec = withAchievements([done(62031), done(627), done(1176), { id: 5, criteria: { is_completed: false, child_criteria: [{ id: 1, is_completed: true }] } }]);
    expect(ownAchievementCount(rec, flags, true)).toBe(2);
    const m = applyRecord(member({ id: 9 }), rec, "t5", { accountWide: flags, twink: true });
    expect([m.achievementCount, m.achievementsTwink]).toEqual([2, true]);
  });

  test("main character: account-wide achievements count too", () => {
    const rec = withAchievements([done(62031), done(627), done(1176)]);
    expect(ownAchievementCount(rec, flags)).toBe(3);
    const m = applyRecord(member({ id: 9, achievementsTwink: true }), rec, "t5", { accountWide: flags });
    expect([m.achievementCount, m.achievementsTwink]).toEqual([3, false]);
  });

  test("isTwink via guild and rank, main guild without guildSlug, slug independent of the Unicode form", () => {
    const ranks = { ["bärenklaue".normalize("NFC")]: [4, 5] };
    expect(isTwink(member({ id: 1, rank: 4 }), "bärenklaue", ranks)).toBe(true);
    expect(isTwink(member({ id: 1, rank: 3 }), "bärenklaue", ranks)).toBe(false);
    expect(isTwink(member({ id: 1, rank: 4, guildSlug: "other" }), "bärenklaue", ranks)).toBe(false);
    expect(isTwink({ ...member({ id: 1, rank: 5 }), guildSlug: undefined }, "bärenklaue".normalize("NFD"), ranks)).toBe(true);
    expect(isTwink(member({ id: 1, rank: 4 }), "bärenklaue")).toBe(false);
  });

  test("without known flags every completed achievement counts, empty entries too", () => {
    const rec = withAchievements([done(62031), done(627)]);
    expect(ownAchievementCount(rec, {}, true)).toBe(2);
    expect(ownAchievementCount(rec, { "62031": null }, true)).toBe(2);
  });

  test("without achievement data the count stays open", () => {
    expect(ownAchievementCount(withAchievements(null))).toBeNull();
    expect(applyRecord(member({ id: 9 }), withAchievements(null), "t5", { accountWide: flags, twink: true }).achievementCount).toBeNull();
  });
});
