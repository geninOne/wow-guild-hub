import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { registeredUiExtensions } from "../../web/src/extensions/registry";

/**
 * On Netlify only a redirect in netlify.toml serves the app for subpages. Locally Vite catches every path, so a missing
 * rule goes unnoticed there (that is how the 404 on /statistik in 1.3.0 happened).
 */
const root = resolve(__dirname, "../..");
const toml = readFileSync(resolve(root, "netlify.toml"), "utf8");
const app = readFileSync(resolve(root, "web/src/App.tsx"), "utf8");

const redirects = [...toml.matchAll(/\[\[redirects\]\]([\s\S]*?)(?=\n\[|$)/g)].map((m) => ({
  from: /from\s*=\s*"([^"]+)"/.exec(m[1])?.[1] ?? "",
  to: /to\s*=\s*"([^"]+)"/.exec(m[1])?.[1] ?? "",
  status: Number(/status\s*=\s*(\d+)/.exec(m[1])?.[1]),
}));
const routes = [...app.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);
/** Pages of the registered extensions need their redirect just the same. */
const extensionRoutes = registeredUiExtensions().flatMap((e) => (e.routes ?? []).map((r) => r.path));

/** Does a redirect cover the path? Parameters like :key stand for any segment. */
function covered(path: string): boolean {
  return redirects.some(({ from }) => {
    if (from === path) return true;
    if (!from.endsWith("/*")) return false;
    const prefix = from.slice(0, -1); // e.g. `/charakter/`
    return path.startsWith(prefix) && path.length > prefix.length;
  });
}

describe("netlify.toml against the app's routes", () => {
  it("finds routes and redirects", () => {
    expect(routes.length).toBeGreaterThan(5);
    expect(redirects.length).toBeGreaterThan(5);
  });

  it("has a redirect to the app for every subpage", () => {
    const missing = [...routes, ...extensionRoutes].filter((p) => p !== "/" && p !== "*").filter((p) => !covered(p));
    expect(missing).toEqual([]);
  });

  it("rewrites pages to index.html (status 200), never over /api", () => {
    for (const r of redirects) {
      expect(r.to).toBe("/index.html");
      expect(r.status).toBe(200);
      expect(r.from === "/*" || r.from.startsWith("/api")).toBe(false);
    }
  });
});
