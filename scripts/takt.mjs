// Lokaler Taktgeber: netlify dev führt geplante Functions nicht selbst nach Zeitplan aus.
import { retryUntilOk, waitUntilReachable } from "./takt-lib.mjs";

const base = process.env.TRIGGER_BASE_URL ?? "http://localhost:8888";
const guildMinutes = Number(process.env.LOCAL_SCHEDULER_GUILD_MINUTES ?? 60);
const DAY_MS = 24 * 60 * 60 * 1000;
const STATIC_MS = 4 * 60 * 60 * 1000;

function log(text) {
  console.log(`[takt ${new Date().toISOString()}] ${text}`);
}

/** Gibt true zurück, wenn der Aufruf mit einem Erfolgsstatus beantwortet wurde. */
async function trigger(name) {
  try {
    const res = await fetch(`${base}/.netlify/functions/${name}`);
    log(`${name}: ${res.status} ${(await res.text()).slice(0, 300)}`);
    return res.ok;
  } catch (error) {
    log(`${name}: nicht erreichbar (${error instanceof Error ? error.message : error})`);
    return false;
  }
}

if ((process.env.LOCAL_SCHEDULER ?? "on") === "off") {
  log("ausgeschaltet (LOCAL_SCHEDULER=off)");
} else {
  log(`an: collect-guild alle ${guildMinutes} Minuten, collect-static alle 4 Stunden, collect-weekly täglich`);
  (async () => {
    if (await waitUntilReachable(`${base}/`)) {
      log("netlify dev erreichbar");
      await retryUntilOk(() => trigger("collect-static"));
      await retryUntilOk(() => trigger("collect-guild"));
      await trigger("collect-weekly");
    } else {
      log("netlify dev nicht erreichbar, erster Lauf entfällt");
    }
    setInterval(() => trigger("collect-guild"), guildMinutes * 60 * 1000);
    setInterval(() => trigger("collect-static"), STATIC_MS);
    setInterval(() => trigger("collect-weekly"), DAY_MS);
  })();
}
