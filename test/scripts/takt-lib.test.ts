import { expect, test } from "vitest";
import { retryUntilOk, waitUntilReachable } from "../../scripts/takt-lib.mjs";

const noSleep = async () => {};

test("wartet mit Wiederholung, bis die Adresse antwortet", async () => {
  let n = 0;
  const fetchFn = async () => {
    if (++n < 3) throw new Error("ECONNREFUSED");
    return new Response("", { status: 404 });
  };
  expect(await waitUntilReachable("http://x/", { fetchFn, sleep: noSleep })).toBe(true);
  expect(n).toBe(3);
});

test("gibt nach den Versuchen auf und meldet false", async () => {
  let n = 0;
  const fetchFn = async () => {
    n++;
    throw new Error("ECONNREFUSED");
  };
  expect(await waitUntilReachable("http://x/", { fetchFn, sleep: noSleep, attempts: 4 })).toBe(false);
  expect(n).toBe(4);
});

test("schläft zwischen den Versuchen, nicht nach dem letzten", async () => {
  const pausen: number[] = [];
  const fetchFn = async () => {
    throw new Error("x");
  };
  await waitUntilReachable("http://x/", { fetchFn, attempts: 3, delayMs: 7, sleep: async (ms: number) => void pausen.push(ms) });
  expect(pausen).toEqual([7, 7]);
});

test("erster Aufruf scheitert: wird wiederholt statt auf den nächsten Takt zu warten", async () => {
  const results = [false, false, true];
  let n = 0;
  const ok = await retryUntilOk(async () => results[n++], { sleep: noSleep });
  expect(ok).toBe(true);
  expect(n).toBe(3);
});

test("Wiederholung endet nach den Versuchen mit false", async () => {
  let n = 0;
  const ok = await retryUntilOk(async () => (n++, false), { sleep: noSleep, attempts: 3 });
  expect(ok).toBe(false);
  expect(n).toBe(3);
});

test("erfolgreicher Aufruf wird nicht wiederholt", async () => {
  let n = 0;
  expect(await retryUntilOk(async () => (n++, true), { sleep: noSleep })).toBe(true);
  expect(n).toBe(1);
});
