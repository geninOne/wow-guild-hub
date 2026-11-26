import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { readFileSync } from "node:fs";
import { changelogAbschnitt, heuteIso } from "../scripts/release-lib.mjs";
import { fehlerseite } from "./build/fehlerseite";
import { seitenKopf, withSeite } from "./build/seite";
import { withSiteUrl } from "./build/site-url";

/**
 * Angaben aus den SITE_-Variablen und die öffentliche Adresse (Netlify: Umgebungsvariable URL) in index.html
 * einsetzen. Die Seitenangaben zuerst, denn das Teilen-Bild bekommt dabei den Platzhalter der Adresse.
 */
function seitenAngaben(env: Record<string, string | undefined>): Plugin {
  return {
    name: "gildenseite-kopf",
    transformIndexHtml: (html) => withSiteUrl(withSeite(html, seitenKopf(env)), env.URL),
  };
}

/** Version aus package.json, Datum aus ihrem CHANGELOG-Abschnitt (sonst heute), für den Fußbereich. */
function versionsAngaben(): { version: string; datum: string } {
  const lies = (datei: string) => readFileSync(fileURLToPath(new URL(`../${datei}`, import.meta.url)), "utf8");
  const { version } = JSON.parse(lies("package.json")) as { version: string };
  const datum = changelogAbschnitt(lies("CHANGELOG.md"), version)?.datum ?? heuteIso(new Date());
  return { version, datum };
}

const { version, datum } = versionsAngaben();
const wurzel = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig(({ mode }) => {
  // SITE_-Variablen aus der .env im Projektordner (lokal) und aus der Umgebung (Netlify); die Umgebung gewinnt.
  // Nur Variablen mit Präfix VITE_ oder SITE_ landen im Bundle, Geheimnisse aus der .env also nie.
  const env = { ...loadEnv(mode, wurzel, ["SITE_"]), ...process.env };
  return {
    root: fileURLToPath(new URL(".", import.meta.url)),
    envDir: wurzel,
    envPrefix: ["VITE_", "SITE_"],
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
