import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";

/**
 * For paths without a file and without a redirect, Netlify serves `404.html` with status 404. If that is a copy of
 * the app, it shows its own error page there (route "*") instead of Netlify's plain one. `/api/*` stays untouched,
 * because the function takes over the path first. Search engines should not index the error page.
 */
export function asErrorPage(indexHtml: string): string {
  if (indexHtml.includes('name="robots"')) return indexHtml;
  return indexHtml.replace(/<head>/, '<head>\n    <meta name="robots" content="noindex" />');
}

/** After the build, writes `404.html` next to `index.html`. */
export function errorPage(): Plugin {
  return {
    name: "guild-site-error-page",
    apply: "build",
    writeBundle(options) {
      const dir = options.dir;
      if (!dir) return;
      const html = readFileSync(join(dir, "index.html"), "utf8");
      writeFileSync(join(dir, "404.html"), asErrorPage(html));
    },
  };
}
