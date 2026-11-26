import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";
import { alsFehlerseite, fehlerseite } from "../../web/build/fehlerseite";

const root = resolve(__dirname, "../..");

test("404.html ist die App mit noindex, sonst unverändert", () => {
  const index = '<!doctype html>\n<html lang="de">\n  <head>\n    <title>Bärenklaue</title>\n  </head>\n  <body><div id="root"></div><script type="module" src="/assets/index-abc.js"></script></body>\n</html>';
  const html = alsFehlerseite(index);
  expect(html).toContain('<meta name="robots" content="noindex" />');
  expect(html.replace('\n    <meta name="robots" content="noindex" />', "")).toBe(index);
  expect(alsFehlerseite(html)).toBe(html);
});

test("Das Build-Plugin schreibt 404.html neben index.html, Assets absolut", () => {
  const dir = mkdtempSync(join(tmpdir(), "fehlerseite-"));
  writeFileSync(join(dir, "index.html"), '<html><head></head><body><script src="/assets/a.js"></script></body></html>');
  const plugin = fehlerseite();
  (plugin.writeBundle as (o: { dir: string }) => void)({ dir });
  const html = readFileSync(join(dir, "404.html"), "utf8");
  expect(html).toContain('src="/assets/a.js"');
  expect(html).toContain("noindex");
});

test("vite.config nutzt das Plugin, netlify.toml hat kein Auffangen aller Pfade (404 bleibt 404, /api frei)", () => {
  expect(readFileSync(resolve(root, "web/vite.config.ts"), "utf8")).toMatch(/plugins:\s*\[[^\]]*fehlerseite\(\)/);
  const toml = readFileSync(resolve(root, "netlify.toml"), "utf8");
  expect(toml).not.toMatch(/from\s*=\s*"\/\*"/);
  expect(toml).not.toMatch(/to\s*=\s*"\/404\.html"/);
});
