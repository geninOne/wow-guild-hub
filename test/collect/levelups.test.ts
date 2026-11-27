import { expect, test } from "vitest";
import { appendLevelUps, detectLevelUps } from "../../src/collect/levelups";

test("jump over several levels: all with the same time", () => {
  expect(detectLevelUps(7, 19, 22, "T")).toEqual([
    { characterId: 7, level: 20, at: "T" },
    { characterId: 7, level: 21, at: "T" },
    { characterId: 7, level: 22, at: "T" },
  ]);
});

test("no event without a previous value or without an increase", () => {
  expect(detectLevelUps(7, undefined, 30, "T")).toEqual([]);
  expect(detectLevelUps(7, 17, 13, "T")).toEqual([]);
  expect(detectLevelUps(7, 13, 13, "T")).toEqual([]);
});

test("appendLevelUps records each level per character only once", () => {
  const log = { events: [{ characterId: 7, level: 14, at: "A" }] };
  const out = appendLevelUps(log, [
    { characterId: 7, level: 14, at: "B" },
    { characterId: 7, level: 15, at: "B" },
    { characterId: 8, level: 14, at: "B" },
  ]);
  expect(out.events).toEqual([
    { characterId: 7, level: 14, at: "A" },
    { characterId: 7, level: 15, at: "B" },
    { characterId: 8, level: 14, at: "B" },
  ]);
});
