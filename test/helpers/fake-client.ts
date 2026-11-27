import type { ApiResult, BlizzardClient } from "../../src/blizzard/client";

/** Fake client: the key is the path without query. Unknown paths return 404. Routes may be changed between runs. */
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
