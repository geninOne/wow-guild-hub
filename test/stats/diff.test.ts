import { expect, test } from "vitest";
import { pickStands, statDiff, sumDiff } from "../../src/stats/diff";
import type { StatsStand } from "../../src/stats/stand";

const stand = (week: string, characters: StatsStand["characters"]): StatsStand => ({ week, takenAt: `${week}T12:00:00.000Z`, characters });

test("Differenz zweier Stände, fehlende Werte gelten als 0, Nullen fallen weg", () => {
  const before = stand("2026-11-14", { "1": { "60": 3, "353": 4 }, "2": { "60": 1 } });
  const after = stand("2026-11-21", { "1": { "60": 5, "353": 4, "349": 2 }, "3": { "60": 7 } });
  expect(statDiff(before, after)).toEqual({ "1": { "60": 2, "349": 2 }, "3": { "60": 7 } });
});

test("Ohne früheren Stand (Serverstart) zählt der volle Wert", () => {
  const after = stand("2026-11-07", { "1": { "60": 5 } });
  expect(statDiff(null, after)).toEqual({ "1": { "60": 5 } });
});

test("Neue Charaktere lassen sich weglassen statt ab 0 zu zählen", () => {
  const before = stand("2026-11-14", { "1": { "60": 3 } });
  const after = stand("2026-11-21", { "1": { "60": 4 }, "3": { "60": 7 } });
  expect(statDiff(before, after, { newCharacters: "skip" })).toEqual({ "1": { "60": 1 } });
});

test("Summe über alle Charaktere je Statistik", () => {
  expect(sumDiff({ "1": { "60": 2, "349": 2 }, "3": { "60": 7 } })).toEqual({ "60": 9, "349": 2 });
});

const weeks = ["2026-11-07", "2026-11-14", "2026-11-21", "2026-11-28", "2026-12-05", "2026-12-12"];

test("Woche: Stand der Woche gegen den der Vorwoche, erste Woche gegen den Serverstart", () => {
  expect(pickStands(weeks, { kind: "week", week: "2026-11-21" }, "2026-11-05")).toEqual({ before: "2026-11-14", after: "2026-11-21" });
  expect(pickStands(weeks, { kind: "week", week: "2026-11-07" }, "2026-11-05")).toEqual({ before: null, after: "2026-11-07" });
  expect(pickStands(weeks, { kind: "week", week: "2026-12-19" }, "2026-11-05")).toEqual({ before: "2026-12-12", after: null });
});

test("Monat: letzter Stand mit Samstag im Monat gegen den letzten davor", () => {
  expect(pickStands(weeks, { kind: "month", month: "2026-12" }, "2026-11-05")).toEqual({ before: "2026-11-28", after: "2026-12-12" });
  expect(pickStands(weeks, { kind: "month", month: "2026-11" }, "2026-11-05")).toEqual({ before: null, after: "2026-11-28" });
});

test("Gesamt: neuester Stand gegen den Serverstart", () => {
  expect(pickStands(weeks, { kind: "total" }, "2026-11-05")).toEqual({ before: null, after: "2026-12-12" });
  expect(pickStands([], { kind: "total" }, "2026-11-05")).toEqual({ before: null, after: null });
});

test("Stände vor dem Serverstart taugen nicht als Vergleich", () => {
  expect(pickStands(["2026-10-31", "2026-11-07"], { kind: "week", week: "2026-11-07" }, "2026-11-05")).toEqual({ before: null, after: "2026-11-07" });
  expect(pickStands(["2026-10-31", "2026-11-07"], { kind: "week", week: "2026-11-07" }, null)).toEqual({ before: "2026-10-31", after: "2026-11-07" });
});
