import { describe, expect, test } from "vitest";
import { applyRecord, fetchOrder, mergeRoster, ownAchievementCount, parseRoster } from "../../src/collect/roster";
import { buildCharacterRecord } from "../../src/transform/character";
import { loadFixture } from "../helpers/fixtures";
import { entry, member } from "../helpers/members";

test("parseRoster liest alle 76 Mitglieder", () => {
  const r = parseRoster(loadFixture("roster").data);
  expect(r).toHaveLength(76);
  expect(r[0]).toEqual({
    id: 374723, name: "Seeroth", surname: "Totenglanz", slug: "seeroth-totenglanz",
    level: 6, classId: 2, raceId: 5, rank: 3,
  });
});

test("neues Mitglied wird angelegt", () => {
  const [m] = mergeRoster([], [entry({ id: 5, level: 6, rank: 3, name: "Neu" })], "t1", "bärenklaue");
  expect(m).toEqual({
    id: 5, name: "Neu", surname: null, slug: "m5", rank: 3, level: 6, classId: 1, raceId: 2,
    hasProfile: false, former: false, firstSeenAt: "t1", leftAt: null, lastFetchedAt: null,
    equippedItemLevel: null, mainSpecName: null, professions: [], guildSlug: "bärenklaue",
  });
});

test("Mitglied mit Profil behält sein Level trotz abweichendem Rosterlevel, übernimmt aber Rang und Name", () => {
  const prev = [member({ id: 1, level: 15, hasProfile: true, rank: 4 })];
  const [m] = mergeRoster(prev, [entry({ id: 1, level: 17, rank: 2, name: "Umbenannt", slug: "umbenannt-x" })], "t1", "bärenklaue");
  expect([m.level, m.rank, m.name, m.slug]).toEqual([15, 2, "Umbenannt", "umbenannt-x"]);
});

test("Mitglied ohne Profil übernimmt das Rosterlevel", () => {
  const [m] = mergeRoster([member({ id: 1, level: 6 })], [entry({ id: 1, level: 7 })], "t1", "bärenklaue");
  expect(m.level).toBe(7);
});

test("Austritt und Rückkehr", () => {
  const start = mergeRoster([], [entry({ id: 1 }), entry({ id: 2 })], "t0", "bärenklaue");
  const nachAustritt = mergeRoster(start, [entry({ id: 1 })], "t1", "bärenklaue");
  expect(nachAustritt.map((m) => [m.id, m.former, m.leftAt])).toEqual([[1, false, null], [2, true, "t1"]]);
  const nochmal = mergeRoster(nachAustritt, [entry({ id: 1 })], "t2", "bärenklaue");
  expect(nochmal[1].leftAt).toBe("t1");
  const rueckkehr = mergeRoster(nochmal, [entry({ id: 2 }), entry({ id: 1 })], "t3", "bärenklaue");
  expect(rueckkehr.map((m) => [m.id, m.former, m.leftAt, m.firstSeenAt])).toEqual([
    [2, false, null, "t0"], [1, false, null, "t0"],
  ]);
});

test("Wechsel zwischen Gilden: bleibt aktiv, Level mit Profil bleibt, nur guildSlug ändert sich", () => {
  const prev = [member({ id: 1, level: 15, hasProfile: true, guildSlug: "bärenklaue", firstSeenAt: "t0" })];
  const [m] = mergeRoster(prev, [entry({ id: 1, level: 14, guildSlug: "goldene-bärenklaue" })], "t1", "bärenklaue");
  expect(m).toEqual({ ...prev[0], guildSlug: "goldene-bärenklaue" });
});

test("Mitglieder einer nicht abrufbaren Gilde bleiben unverändert", () => {
  const prev = [member({ id: 1 }), member({ id: 2, level: 9, rank: 4, guildSlug: "b" })];
  const result = mergeRoster(prev, [entry({ id: 1 })], "t1", "bärenklaue", ["b"]);
  expect(result.find((m) => m.id === 2)).toEqual(prev[1]);
});

test("Mitglied einer abrufbaren Nebengilde wird ehemalig, wenn es fehlt", () => {
  const prev = [member({ id: 1 }), member({ id: 2, guildSlug: "b" })];
  const result = mergeRoster(prev, [entry({ id: 1 })], "t1", "bärenklaue", ["c"]);
  expect(result.find((m) => m.id === 2)).toMatchObject({ former: true, leftAt: "t1", guildSlug: "b" });
});

test("Altdaten ohne guildSlug werden ergänzt", () => {
  const ohne = (m: ReturnType<typeof member>) => {
    const { guildSlug: _, ...rest } = m;
    return rest;
  };
  const prev = [ohne(member({ id: 1 })), ohne(member({ id: 2 })), ohne(member({ id: 3, former: true, leftAt: "t0" }))];
  const result = mergeRoster(prev, [entry({ id: 1, guildSlug: "b" })], "t1", "bärenklaue");
  expect(result.map((m) => [m.id, m.guildSlug, m.former])).toEqual([
    [1, "b", false], [2, "bärenklaue", true], [3, "bärenklaue", true],
  ]);
});

test("Charakter in zwei Rostern erscheint einmal mit der ersten Gilde", () => {
  const result = mergeRoster([], [entry({ id: 1, guildSlug: "a" }), entry({ id: 1, guildSlug: "b" })], "t1", "a");
  expect(result.map((m) => [m.id, m.guildSlug])).toEqual([[1, "a"]]);
});

test("fetchOrder: nie geholte zuerst, dann die ältesten, ohne Ehemalige", () => {
  const a = member({ id: 1, lastFetchedAt: "2026-11-06T10:00:00.000Z" });
  const b = member({ id: 2, lastFetchedAt: null });
  const c = member({ id: 3, lastFetchedAt: "2026-11-06T09:00:00.000Z" });
  const d = member({ id: 4, former: true, lastFetchedAt: null });
  expect(fetchOrder([a, b, c, d]).map((m) => m.id)).toEqual([2, 3, 1]);
});

test("applyRecord übernimmt Level, Gegenstandsstufe, Hauptbaum und Berufe", () => {
  const f = (n: string) => loadFixture(n).data;
  const rec = buildCharacterRecord(
    { id: 382219, name: "Luvia", surname: "Stav", slug: "luvia-stav", level: 20, classId: 1, raceId: 96, rank: 3 },
    { profile: f("luvia-profile"), specializations: f("luvia-specializations"), equipment: f("luvia-equipment"),
      media: f("luvia-media"), professions: f("luvia-professions"), raids: f("luvia-raids"), achievements: null, statistics: null, reputations: null },
    "t5",
  );
  const m = applyRecord(member({ id: 382219, level: 20, name: "alt" }), rec, "t5");
  expect(m).toMatchObject({
    level: 21, hasProfile: true, equippedItemLevel: 11, mainSpecName: "Furor", lastFetchedAt: "t5", name: "Luvia",
    surname: "Stav",
  });
  expect(m.professions).toEqual([
    { id: 186, skill: 91 }, { id: 164, skill: 65 }, { id: 185, skill: 40 }, { id: 356, skill: 1 }, { id: 129, skill: 70 },
  ]);
});

test("applyRecord ohne Profil übernimmt nur das Rosterlevel", () => {
  const rec = buildCharacterRecord(
    entry({ id: 9, level: 8, name: "Roster" }),
    { profile: null, specializations: null, equipment: null, media: null, professions: null, raids: null, achievements: null, statistics: null, reputations: null },
    "t5",
  );
  const m = applyRecord(member({ id: 9, level: 7, name: "Gespeichert" }), rec, "t5");
  expect([m.level, m.name, m.hasProfile, m.lastFetchedAt]).toEqual([8, "Gespeichert", false, "t5"]);
});

describe("eigene Erfolge", () => {
  const withAchievements = (raw: unknown[] | null) =>
    buildCharacterRecord(
      entry({ id: 9, level: 20 }),
      { profile: loadFixture("luvia-profile").data, specializations: null, equipment: null, media: null, professions: null, raids: null,
        statistics: null, reputations: null, achievements: raw === null ? null : { achievements: raw } },
      "t5",
    );
  const done = (id: number) => ({ id, criteria: { is_completed: true } });

  test("accountweite Erfolge zählen nicht, nicht accountweite und noch unbekannte schon", () => {
    const rec = withAchievements([done(62031), done(627), done(1176), { id: 5, criteria: { is_completed: false, child_criteria: [{ id: 1, is_completed: true }] } }]);
    expect(ownAchievementCount(rec, { "62031": true, "627": false })).toBe(2);
    expect(applyRecord(member({ id: 9 }), rec, "t5", { "62031": true, "627": false }).achievementCount).toBe(2);
  });

  test("ohne bekannte Angaben zählt jeder abgeschlossene Erfolg, Leereinträge auch", () => {
    const rec = withAchievements([done(62031), done(627)]);
    expect(ownAchievementCount(rec)).toBe(2);
    expect(ownAchievementCount(rec, { "62031": null })).toBe(2);
  });

  test("ohne Erfolgsdaten bleibt die Zahl offen", () => {
    expect(ownAchievementCount(withAchievements(null))).toBeNull();
    expect(applyRecord(member({ id: 9 }), withAchievements(null), "t5", { "62031": true }).achievementCount).toBeNull();
  });
});
