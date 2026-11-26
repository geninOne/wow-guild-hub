import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { OBERFLAECHEN_ERWEITERUNGEN } from "../../web/src/erweiterungen";

/**
 * Auf Netlify liefert nur eine Weiterleitung in netlify.toml die App für Unterseiten aus. Lokal fängt Vite jeden Pfad ab,
 * eine fehlende Regel fällt dort also nicht auf (so kam es zum 404 auf /statistik in 1.3.0).
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
/** Seiten der angemeldeten Erweiterungen brauchen ihre Weiterleitung genauso. */
const erweiterungsRouten = OBERFLAECHEN_ERWEITERUNGEN.flatMap((e) => (e.routen ?? []).map((r) => r.pfad));

/** Deckt eine Weiterleitung den Pfad ab? Parameter wie :key stehen für ein beliebiges Segment. */
function covered(path: string): boolean {
  return redirects.some(({ from }) => {
    if (from === path) return true;
    if (!from.endsWith("/*")) return false;
    const prefix = from.slice(0, -1); // "/charakter/"
    return path.startsWith(prefix) && path.length > prefix.length;
  });
}

describe("netlify.toml gegen die Routen der App", () => {
  it("findet Routen und Weiterleitungen", () => {
    expect(routes.length).toBeGreaterThan(5);
    expect(redirects.length).toBeGreaterThan(5);
  });

  it("hat für jede Unterseite eine Weiterleitung auf die App", () => {
    const missing = [...routes, ...erweiterungsRouten].filter((p) => p !== "/" && p !== "*").filter((p) => !covered(p));
    expect(missing).toEqual([]);
  });

  it("schreibt Seiten auf index.html um (Status 200), nie über /api", () => {
    for (const r of redirects) {
      expect(r.to).toBe("/index.html");
      expect(r.status).toBe(200);
      expect(r.from === "/*" || r.from.startsWith("/api")).toBe(false);
    }
  });
});
