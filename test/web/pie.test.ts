import { expect, test } from "vitest";
import { pieArcs } from "../../web/src/lib/pie";

test("slices follow the shares clockwise from twelve o'clock", () => {
  const [a, b] = pieArcs([1, 3], 50, 50, 40);
  expect(a.start).toBe(0);
  expect(a.end).toBeCloseTo(Math.PI / 2);
  expect(b.end).toBeCloseTo(2 * Math.PI);
  expect(a.path).toBe("M 50 50 L 50 10 A 40 40 0 0 1 90 50 Z");
  expect(b.path).toContain("A 40 40 0 1 1 50 10");
});

test("a single slice is a full circle, zero values stay empty", () => {
  const [full, empty] = pieArcs([5, 0], 50, 50, 40);
  expect(full.path).toBe("M 50 10 A 40 40 0 1 1 50 90 A 40 40 0 1 1 50 10 Z");
  expect(empty.path).toBe("");
});
