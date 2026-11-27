import { expect, test } from "vitest";
import { retryUntilOk, waitUntilReachable } from "../../scripts/scheduler-lib.mjs";

const noSleep = async () => {};

test("retries until the URL responds", async () => {
  let n = 0;
  const fetchFn = async () => {
    if (++n < 3) throw new Error("ECONNREFUSED");
    return new Response("", { status: 404 });
  };
  expect(await waitUntilReachable("http://x/", { fetchFn, sleep: noSleep })).toBe(true);
  expect(n).toBe(3);
});

test("gives up after the attempts and returns false", async () => {
  let n = 0;
  const fetchFn = async () => {
    n++;
    throw new Error("ECONNREFUSED");
  };
  expect(await waitUntilReachable("http://x/", { fetchFn, sleep: noSleep, attempts: 4 })).toBe(false);
  expect(n).toBe(4);
});

test("sleeps between attempts, not after the last one", async () => {
  const pauses: number[] = [];
  const fetchFn = async () => {
    throw new Error("x");
  };
  await waitUntilReachable("http://x/", { fetchFn, attempts: 3, delayMs: 7, sleep: async (ms: number) => void pauses.push(ms) });
  expect(pauses).toEqual([7, 7]);
});

test("first call fails: retried instead of waiting for the next tick", async () => {
  const results = [false, false, true];
  let n = 0;
  const ok = await retryUntilOk(async () => results[n++], { sleep: noSleep });
  expect(ok).toBe(true);
  expect(n).toBe(3);
});

test("retrying ends with false after the attempts", async () => {
  let n = 0;
  const ok = await retryUntilOk(async () => (n++, false), { sleep: noSleep, attempts: 3 });
  expect(ok).toBe(false);
  expect(n).toBe(3);
});

test("a successful call is not retried", async () => {
  let n = 0;
  expect(await retryUntilOk(async () => (n++, true), { sleep: noSleep })).toBe(true);
  expect(n).toBe(1);
});
