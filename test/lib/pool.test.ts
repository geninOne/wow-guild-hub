import { expect, test } from "vitest";
import { runPool } from "../../src/lib/pool";

test("respects the concurrency limit", async () => {
  let active = 0;
  let max = 0;
  await runPool(
    [1, 2, 3, 4, 5, 6],
    async () => {
      active++;
      max = Math.max(max, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
    },
    { concurrency: 2, deadline: Date.now() + 10_000 },
  );
  expect(max).toBe(2);
});

test("starts nothing new after the deadline and reports the rest as skipped", async () => {
  let t = 0;
  const r = await runPool(
    [1, 2, 3],
    async () => {
      t += 100;
    },
    { concurrency: 1, deadline: 150, now: () => t },
  );
  expect(r.completed).toEqual([1, 2]);
  expect(r.skipped).toEqual([3]);
});

test("one failure does not stop the others", async () => {
  const r = await runPool(
    [1, 2, 3],
    async (n) => {
      if (n === 2) throw new Error("x");
    },
    { concurrency: 2, deadline: Date.now() + 10_000 },
  );
  expect(r.completed).toEqual([1, 3]);
  expect(r.failed.map((f) => f.item)).toEqual([2]);
});

test("result order follows the input, not completion", async () => {
  const r = await runPool(
    [30, 1, 15],
    async (ms) => {
      await new Promise((res) => setTimeout(res, ms));
    },
    { concurrency: 3, deadline: Date.now() + 10_000 },
  );
  expect(r.completed).toEqual([30, 1, 15]);
});
