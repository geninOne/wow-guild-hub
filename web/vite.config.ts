import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { readFileSync } from "node:fs";
import { changelogSection, todayIso } from "../scripts/release-lib.mjs";
import { fehlerseite } from "./build/fehlerseite";
import { seitenKopf, withSeite } from "./build/seite";
import { withSiteUrl } from "./build/site-url";

/**
 * Inserts the details from the WEBSITE_ variables and the public address (Netlify: environment variable URL) into
 * index.html. Site details first, because the share image gets the address placeholder in the process.
 */
function seitenAngaben(env: Record<string, string | undefined>): Plugin {
  return {
    name: "gildenseite-kopf",
    transformIndexHtml: (html) => withSiteUrl(withSeite(html, seitenKopf(env)), env.URL),
  };
}

/** Version from package.json, date from its CHANGELOG section (otherwise today), for the footer. */
function versionsAngaben(): { version: string; datum: string } {
  const lies = (datei: string) => readFileSync(fileURLToPath(new URL(`../${datei}`, import.meta.url)), "utf8");
  const { version } = JSON.parse(lies("package.json")) as { version: string };
  const datum = changelogSection(lies("CHANGELOG.md"), version)?.date ?? todayIso(new Date());
  return { version, datum };
}

const { version, datum } = versionsAngaben();
const wurzel = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig(({ mode }) => {
  // WEBSITE_ variables from the .env in the project folder (local) and from the environment (Netlify); the environment
  // wins. Only variables prefixed VITE_ or WEBSITE_ end up in the bundle, so secrets from the .env never do. Deliberately
  // not SITE_: Netlify sets SITE_NAME and SITE_ID itself during the build, and those could not be overridden.
  const env = { ...loadEnv(mode, wurzel, ["WEBSITE_"]), ...process.env };
  return {
    root: fileURLToPath(new URL(".", import.meta.url)),
    envDir: wurzel,
    envPrefix: ["VITE_", "WEBSITE_"],
    plugins: [react(), seitenAngaben(env), fehlerseite()],
    define: {
      "import.meta.env.VITE_VERSION": JSON.stringify(version),
      "import.meta.env.VITE_VERSION_DATUM": JSON.stringify(datum),
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
