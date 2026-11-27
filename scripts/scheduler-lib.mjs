// Helpers for the local scheduler (scripts/scheduler.mjs), kept separate so they can be tested.

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Waits until the URL responds (any HTTP status will do). Returns false if it never does. */
export async function waitUntilReachable(url, { fetchFn = fetch, attempts = 120, delayMs = 2000, sleep = defaultSleep } = {}) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetchFn(url);
      await res.text().catch(() => "");
      return true;
    } catch {
      if (i < attempts) await sleep(delayMs);
    }
  }
  return false;
}

/** Calls fn (returns true on success) until it succeeds, at most `attempts` times with a pause in between. */
export async function retryUntilOk(fn, { attempts = 5, delayMs = 60_000, sleep = defaultSleep } = {}) {
  for (let i = 1; i <= attempts; i++) {
    if (await fn()) return true;
    if (i < attempts) await sleep(delayMs);
  }
  return false;
}
