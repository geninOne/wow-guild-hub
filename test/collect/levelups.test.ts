import { expect, test } from "vitest";
import { appendLevelUps, detectLevelUps } from "../../src/collect/levelups";

test("Sprung über mehrere Level: alle mit demselben Zeitpunkt", () => {
  expect(detectLevelUps(7, 19, 22, "T")).toEqual([
    { characterId: 7, level: 20, at: "T" },
    { characterId: 7, level: 21, at: "T" },
    { characterId: 7, level: 22, at: "T" },
  ]);
});

test("kein Ereignis ohne Vorwert oder ohne Anstieg", () => {
  expect(detectLevelUps(7, undefined, 30, "T")).toEqual([]);
  expect(detectLevelUps(7, 17, 13, "T")).toEqual([]);
  expect(detectLevelUps(7, 13, 13, "T")).toEqual([]);
});

test("appendLevelUps hält jedes Level pro Charakter nur einmal fest", () => {
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
