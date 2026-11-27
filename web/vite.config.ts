import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { readFileSync } from "node:fs";
import { changelogSection, todayIso } from "../scripts/release-lib.mjs";
import { errorPage } from "./build/error-page";
import { siteHead, withSite } from "./build/site";
import { withSiteUrl } from "./build/site-url";

/**
 * Inserts the details from the WEBSITE_ variables and the public address (Netlify: environment variable URL) into
 * index.html. Site details first, because the share image gets the address placeholder in the process.
 */
function siteDetails(env: Record<string, string | undefined>): Plugin {
  return {
    name: "guild-site-head",
    transformIndexHtml: (html) => withSiteUrl(withSite(html, siteHead(env)), env.URL),
  };
}

/** Version from package.json, date from its CHANGELOG section (otherwise today), for the footer. */
function versionDetails(): { version: string; date: string } {
  const read = (file: string) => readFileSync(fileURLToPath(new URL(`../${file}`, import.meta.url)), "utf8");
  const { version } = JSON.parse(read("package.json")) as { version: string };
  const date = changelogSection(read("CHANGELOG.md"), version)?.date ?? todayIso(new Date());
  return { version, date };
}

const { version, date } = versionDetails();
const projectRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig(({ mode }) => {
  // WEBSITE_ variables from the .env in the project folder (local) and from the environment (Netlify); the environment
  // wins. Only variables prefixed VITE_ or WEBSITE_ end up in the bundle, so secrets from the .env never do. Deliberately
  // not SITE_: Netlify sets SITE_NAME and SITE_ID itself during the build, and those could not be overridden.
  const env = { ...loadEnv(mode, projectRoot, ["WEBSITE_"]), ...process.env };
  return {
    root: fileURLToPath(new URL(".", import.meta.url)),
    envDir: projectRoot,
    envPrefix: ["VITE_", "WEBSITE_"],
    plugins: [react(), siteDetails(env), errorPage()],
    define: {
      "import.meta.env.VITE_VERSION": JSON.stringify(version),
      "import.meta.env.VITE_VERSION_DATE": JSON.stringify(date),
    },
    build: {
      outDir: "../dist",
      emptyOutDir: true,
    },
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
    },
  };
});
