// Hilfen für den lokalen Taktgeber (scripts/takt.mjs), getrennt, damit sie testbar sind.

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Wartet, bis die Adresse antwortet (irgendein HTTP-Status genügt). Gibt false zurück, wenn sie es nie tut. */
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

/** Ruft fn (liefert true bei Erfolg) bis zum Erfolg auf, höchstens attempts-mal mit Pause dazwischen. */
export async function retryUntilOk(fn, { attempts = 5, delayMs = 60_000, sleep = defaultSleep } = {}) {
  for (let i = 1; i <= attempts; i++) {
    if (await fn()) return true;
    if (i < attempts) await sleep(delayMs);
  }
  return false;
}
