import { expect, test } from "vitest";
import { runPool } from "../../src/lib/pool";

test("hält die Gleichzeitigkeit ein", async () => {
  let aktiv = 0;
  let max = 0;
  await runPool(
    [1, 2, 3, 4, 5, 6],
    async () => {
      aktiv++;
      max = Math.max(max, aktiv);
      await new Promise((r) => setTimeout(r, 5));
      aktiv--;
    },
    { concurrency: 2, deadline: Date.now() + 10_000 },
  );
  expect(max).toBe(2);
});

test("startet nach der Deadline nichts Neues und meldet den Rest als übersprungen", async () => {
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

test("ein Fehler stoppt die anderen nicht", async () => {
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

test("Ergebnisreihenfolge folgt der Eingabe, nicht der Fertigstellung", async () => {
  const r = await runPool(
    [30, 1, 15],
    async (ms) => {
      await new Promise((res) => setTimeout(res, ms));
    },
    { concurrency: 3, deadline: Date.now() + 10_000 },
  );
  expect(r.completed).toEqual([30, 1, 15]);
});
