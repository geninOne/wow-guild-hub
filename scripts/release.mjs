// Neue Version vorbereiten: node scripts/release.mjs <patch|minor|major|aktuell>
// patch, minor, major: erhöht die Version in package.json und package-lock.json, macht aus
// "Unreleased" in CHANGELOG.md den Abschnitt der neuen Version, committet "Version X.Y.Z" und setzt
// das Tag vX.Y.Z. aktuell: setzt nur das Tag für die Version in package.json (Abschnitt muss existieren).
// Gepusht wird nicht. Der Release-Workflow (Knopf "Run workflow") ruft dieses Skript selbst auf.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { changelogFreigeben, heuteIso, pruefeTag, zielVersion } from "./release-lib.mjs";

const wurzel = fileURLToPath(new URL("../", import.meta.url));
const art = process.argv[2];

function befehl(programm, args, { leise = false } = {}) {
  return execFileSync(programm, args, { cwd: wurzel, encoding: "utf8", stdio: leise ? "pipe" : ["ignore", "pipe", "inherit"] }).trim();
}

try {
  if (befehl("git", ["status", "--porcelain"]) !== "") {
    throw new Error("Der Arbeitsbaum hat ungesicherte Änderungen. Erst committen, dann die Version erhöhen.");
  }
  const { version: alt } = JSON.parse(readFileSync(`${wurzel}package.json`, "utf8"));
  const { version, erhoehen } = zielVersion(alt, art);
  const tag = `v${version}`;
  if (befehl("git", ["tag", "--list", tag]) !== "") throw new Error(`Tag ${tag} gibt es schon.`);

  const changelogPfad = `${wurzel}CHANGELOG.md`;
  if (erhoehen) {
    writeFileSync(changelogPfad, changelogFreigeben(readFileSync(changelogPfad, "utf8"), version, heuteIso(new Date())));
    befehl("npm", ["version", version, "--no-git-tag-version"], { leise: true });
    befehl("git", ["add", "package.json", "package-lock.json", "CHANGELOG.md"]);
    befehl("git", ["commit", "--quiet", "-m", `Version ${version}`]);
  } else {
    pruefeTag(tag, version, readFileSync(changelogPfad, "utf8"));
  }
  befehl("git", ["tag", "-a", tag, "-m", `Version ${version}`]);
  const zweig = befehl("git", ["branch", "--show-current"]);

  console.log(`${erhoehen ? `Version ${version} committet und als` : "Aktuelle Version"} ${tag} getaggt.`);
  console.log("Veröffentlichen von Hand (ohne Knopf im Release-Workflow):");
  console.log(`  git push origin ${zweig || "HEAD:main"}`);
  console.log(`  git push origin ${tag}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
