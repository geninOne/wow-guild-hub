// Local scheduler: netlify dev does not run scheduled functions on their schedule by itself.
import { retryUntilOk, waitUntilReachable } from "./scheduler-lib.mjs";

const base = process.env.TRIGGER_BASE_URL ?? "http://localhost:8888";
const guildMinutes = Number(process.env.LOCAL_SCHEDULER_GUILD_MINUTES ?? 60);
const DAY_MS = 24 * 60 * 60 * 1000;
const STATIC_MS = 4 * 60 * 60 * 1000;

function log(text) {
  console.log(`[scheduler ${new Date().toISOString()}] ${text}`);
}

/** Returns true if the call was answered with a success status. */
async function trigger(name) {
  try {
    const res = await fetch(`${base}/.netlify/functions/${name}`);
    log(`${name}: ${res.status} ${(await res.text()).slice(0, 300)}`);
    return res.ok;
  } catch (error) {
    log(`${name}: unreachable (${error instanceof Error ? error.message : error})`);
    return false;
  }
}

if ((process.env.LOCAL_SCHEDULER ?? "on") === "off") {
  log("disabled (LOCAL_SCHEDULER=off)");
} else {
  log(`on: collect-guild every ${guildMinutes} minutes, collect-static every 4 hours, collect-weekly daily`);
  (async () => {
    if (await waitUntilReachable(`${base}/`)) {
      log("netlify dev reachable");
      await retryUntilOk(() => trigger("collect-static"));
      await retryUntilOk(() => trigger("collect-guild"));
      await trigger("collect-weekly");
    } else {
      log("netlify dev unreachable, skipping the first run");
    }
    setInterval(() => trigger("collect-guild"), guildMinutes * 60 * 1000);
    setInterval(() => trigger("collect-static"), STATIC_MS);
    setInterval(() => trigger("collect-weekly"), DAY_MS);
  })();
}
