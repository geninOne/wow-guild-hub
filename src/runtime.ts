import { createBlizzardClient } from "./blizzard/client";
import type { CollectDeps } from "./collect/guild";
import { loadConfig } from "./config";
import { createNetlifyStore } from "./store";

/** Wiring for the functions: configuration from the environment, real client, Netlify Blobs. */
export function createRuntime(env: Record<string, string | undefined> = process.env): CollectDeps {
  const config = loadConfig(env);
  return {
    config,
    client: createBlizzardClient({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      region: config.region,
      locale: config.locale,
      gameVersion: config.gameVersion,
    }),
    store: createNetlifyStore(),
    now: () => new Date(),
  };
}
