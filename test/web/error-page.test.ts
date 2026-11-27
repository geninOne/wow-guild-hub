import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";
import { asErrorPage, errorPage } from "../../web/build/error-page";

const root = resolve(__dirname, "../..");

test("404.html is the app with noindex, otherwise unchanged", () => {
  const index = '<!doctype html>\n<html lang="de">\n  <head>\n    <title>Bärenklaue</title>\n  </head>\n  <body><div id="root"></div><script type="module" src="/assets/index-abc.js"></script></body>\n</html>';
  const html = asErrorPage(index);
  expect(html).toContain('<meta name="robots" content="noindex" />');
  expect(html.replace('\n    <meta name="robots" content="noindex" />', "")).toBe(index);
  expect(asErrorPage(html)).toBe(html);
});

test("the build plugin writes 404.html next to index.html, assets absolute", () => {
  const dir = mkdtempSync(join(tmpdir(), "error-page-"));
  writeFileSync(join(dir, "index.html"), '<html><head></head><body><script src="/assets/a.js"></script></body></html>');
  const plugin = errorPage();
  (plugin.writeBundle as (o: { dir: string }) => void)({ dir });
  const html = readFileSync(join(dir, "404.html"), "utf8");
  expect(html).toContain('src="/assets/a.js"');
  expect(html).toContain("noindex");
});

test("vite.config uses the plugin, netlify.toml has no catch-all path (404 stays 404, /api free)", () => {
  expect(readFileSync(resolve(root, "web/vite.config.ts"), "utf8")).toMatch(/plugins:\s*\[[^\]]*errorPage\(\)/);
  const toml = readFileSync(resolve(root, "netlify.toml"), "utf8");
  expect(toml).not.toMatch(/from\s*=\s*"\/\*"/);
  expect(toml).not.toMatch(/to\s*=\s*"\/404\.html"/);
});
