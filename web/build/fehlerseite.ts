import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";

/**
 * Netlify liefert für Pfade ohne Datei und ohne Weiterleitung `404.html` mit Status 404 aus. Ist das eine Kopie der
 * App, zeigt sie dort ihre eigene Fehlerseite (Route "*") statt Netlifys schlichter Seite. `/api/*` bleibt unberührt,
 * weil die Function den Pfad vorher übernimmt. Suchmaschinen sollen die Fehlerseite nicht aufnehmen.
 */
export function alsFehlerseite(indexHtml: string): string {
  if (indexHtml.includes('name="robots"')) return indexHtml;
  return indexHtml.replace(/<head>/, '<head>\n    <meta name="robots" content="noindex" />');
}

/** Schreibt nach dem Bauen `404.html` neben `index.html`. */
export function fehlerseite(): Plugin {
  return {
    name: "gildenseite-fehlerseite",
    apply: "build",
    writeBundle(options) {
      const dir = options.dir;
      if (!dir) return;
      const html = readFileSync(join(dir, "index.html"), "utf8");
      writeFileSync(join(dir, "404.html"), alsFehlerseite(html));
    },
  };
}
