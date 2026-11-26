import { expect, test } from "vitest";
import { parseServerStart, serverStartSnapshot, sinceServerStart, startsWithin } from "../../src/lib/serverstart";
import { SERVER_START } from "../../src/serverstart";

test("parseServerStart liest das Datum, null heißt kein Serverstart, Unsinn bricht ab", () => {
  expect(parseServerStart({ _hinweis: "x", datum: "2026-11-05" })).toBe("2026-11-05");
  expect(parseServerStart({ datum: null })).toBeNull();
  expect(parseServerStart({})).toBeNull();
  for (const datum of ["05.11.2026", "2026-11-5", "2026-02-30", "", 20261105]) {
    expect(() => parseServerStart({ datum })).toThrow("config/serverstart.json");
  }
});

test("config/serverstart.json enthält einen gültigen Serverstart", () => {
  expect(SERVER_START).toBe("2026-11-05");
});

test("startsWithin und sinceServerStart", () => {
  expect(startsWithin("2026-11-05", "2026-11-01", "2026-11-30")).toBe(true);
  expect(startsWithin("2026-11-05", "2026-11-02", "2026-11-05")).toBe(true);
  expect(startsWithin("2026-11-05", "2026-11-09", "2026-11-15")).toBe(false);
  expect(startsWithin(null, "2026-11-01", "2026-11-30")).toBe(false);
  const dates = ["2026-10-31", "2026-11-05", "2026-11-06"];
  expect(sinceServerStart(dates, "2026-11-05")).toEqual(["2026-11-05", "2026-11-06"]);
  expect(sinceServerStart(dates, null)).toEqual(dates);
});

test("serverStartSnapshot: alle Charaktere des Endstands mit Level 1 und Zählern auf 0", () => {
  const end = {
    date: "2026-11-16", takenAt: "2026-11-16T20:00:00.000Z", testdaten: true,
    characters: { "1": { level: 26, equippedItemLevel: 20, professions: { "186": 80 }, deaths: 4 }, "2": { level: 3, equippedItemLevel: null, professions: {} } },
  };
  expect(serverStartSnapshot("2026-11-05", end)).toEqual({
    date: "2026-11-05", takenAt: "2026-11-05T00:00:00.000Z",
    characters: Object.fromEntries(["1", "2"].map((id) => [id, {
      level: 1, equippedItemLevel: 0, professions: {}, deaths: 0, dungeons: 0, recipes: 0, achievements: 0, reputation: 0,
    }])),
  });
});
