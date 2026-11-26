// Lokaler Taktgeber: netlify dev führt geplante Functions nicht selbst nach Zeitplan aus.
import { retryUntilOk, waitUntilReachable } from "./takt-lib.mjs";

const base = process.env.TRIGGER_BASE_URL ?? "http://localhost:8888";
const guildMinutes = Number(process.env.TAKT_GILDE_MINUTEN ?? 60);
const DAY_MS = 24 * 60 * 60 * 1000;

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

if ((process.env.TAKT ?? "an") === "aus") {
  log("ausgeschaltet (TAKT=aus)");
} else {
  log(`an: collect-guild alle ${guildMinutes} Minuten, collect-static und collect-weekly täglich`);
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
    setInterval(() => trigger("collect-static"), DAY_MS);
    setInterval(() => trigger("collect-weekly"), DAY_MS);
  })();
}
