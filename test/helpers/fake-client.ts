import type { ApiResult, BlizzardClient } from "../../src/blizzard/client";

/** Fake-Client: Schlüssel ist der Pfad ohne Query. Unbekannte Pfade liefern 404. Routen dürfen zwischen Läufen geändert werden. */
export function createFakeClient(routes: Record<string, ApiResult>): BlizzardClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async get(pathOrHref) {
      const path = (pathOrHref.startsWith("http") ? new URL(pathOrHref).pathname : pathOrHref).split("?")[0];
      calls.push(path);
      const hit = routes[path];
      return hit ? structuredClone(hit) : { status: 404, data: null };
    },
  };
}
