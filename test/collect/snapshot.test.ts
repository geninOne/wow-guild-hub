import { expect, test } from "vitest";
import { buildSnapshot } from "../../src/collect/snapshot";
import { member } from "../helpers/members";

test("daily snapshot: Berlin date, only active members", () => {
  const at = "2026-11-06T23:30:00.000Z";
  const s = buildSnapshot(
    [
      member({ id: 382219, level: 21, equippedItemLevel: 11, professions: [{ id: 186, skill: 91 }] }),
      member({ id: 5, level: 30, former: true }),
    ],
    at,
  );
  expect(s).toEqual({
    date: "2026-11-07",
    takenAt: at,
    characters: { "382219": { level: 21, equippedItemLevel: 11, professions: { "186": 91 } } },
  });
});
