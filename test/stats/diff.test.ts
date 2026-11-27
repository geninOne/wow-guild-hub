import { expect, test } from "vitest";
import { pickSnapshots, statDiff, sumDiff } from "../../src/stats/diff";
import type { StatsSnapshot } from "../../src/stats/snapshot";

const snapshot = (week: string, characters: StatsSnapshot["characters"]): StatsSnapshot => ({ week, takenAt: `${week}T12:00:00.000Z`, characters });

test("difference of two snapshots, missing values count as 0, zeros are dropped", () => {
  const before = snapshot("2026-11-14", { "1": { "60": 3, "353": 4 }, "2": { "60": 1 } });
  const after = snapshot("2026-11-21", { "1": { "60": 5, "353": 4, "349": 2 }, "3": { "60": 7 } });
  expect(statDiff(before, after)).toEqual({ "1": { "60": 2, "349": 2 }, "3": { "60": 7 } });
});

test("without an earlier snapshot (server start) the full value counts", () => {
  const after = snapshot("2026-11-07", { "1": { "60": 5 } });
  expect(statDiff(null, after)).toEqual({ "1": { "60": 5 } });
});

test("new characters can be left out instead of counting from 0", () => {
  const before = snapshot("2026-11-14", { "1": { "60": 3 } });
  const after = snapshot("2026-11-21", { "1": { "60": 4 }, "3": { "60": 7 } });
  expect(statDiff(before, after, { newCharacters: "skip" })).toEqual({ "1": { "60": 1 } });
});

test("sum over all characters per statistic", () => {
  expect(sumDiff({ "1": { "60": 2, "349": 2 }, "3": { "60": 7 } })).toEqual({ "60": 9, "349": 2 });
});

const weeks = ["2026-11-07", "2026-11-14", "2026-11-21", "2026-11-28", "2026-12-05", "2026-12-12"];

test("week: snapshot of the week against the previous week, first week against the server start", () => {
  expect(pickSnapshots(weeks, { kind: "week", week: "2026-11-21" }, "2026-11-05")).toEqual({ before: "2026-11-14", after: "2026-11-21" });
  expect(pickSnapshots(weeks, { kind: "week", week: "2026-11-07" }, "2026-11-05")).toEqual({ before: null, after: "2026-11-07" });
  expect(pickSnapshots(weeks, { kind: "week", week: "2026-12-19" }, "2026-11-05")).toEqual({ before: "2026-12-12", after: null });
});

test("month: last snapshot with a Saturday in the month against the last one before", () => {
  expect(pickSnapshots(weeks, { kind: "month", month: "2026-12" }, "2026-11-05")).toEqual({ before: "2026-11-28", after: "2026-12-12" });
  expect(pickSnapshots(weeks, { kind: "month", month: "2026-11" }, "2026-11-05")).toEqual({ before: null, after: "2026-11-28" });
});

test("total: newest snapshot against the server start", () => {
  expect(pickSnapshots(weeks, { kind: "total" }, "2026-11-05")).toEqual({ before: null, after: "2026-12-12" });
  expect(pickSnapshots([], { kind: "total" }, "2026-11-05")).toEqual({ before: null, after: null });
});

test("snapshots before the server start do not serve as a comparison", () => {
  expect(pickSnapshots(["2026-10-31", "2026-11-07"], { kind: "week", week: "2026-11-07" }, "2026-11-05")).toEqual({ before: null, after: "2026-11-07" });
  expect(pickSnapshots(["2026-10-31", "2026-11-07"], { kind: "week", week: "2026-11-07" }, null)).toEqual({ before: "2026-10-31", after: "2026-11-07" });
});
