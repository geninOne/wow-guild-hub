// Gibt den CHANGELOG-Abschnitt einer Version aus (für den GitHub-Release):
//   node scripts/changelog-abschnitt.mjs 1.0.0
// Oder prüft vor dem Deploy, dass ein Tag zu package.json und CHANGELOG.md passt:
//   node scripts/changelog-abschnitt.mjs --pruefe-tag v1.0.0
import { readFileSync } from "node:fs";
import { changelogAbschnitt, pruefeTag } from "./release-lib.mjs";

const wurzel = new URL("../", import.meta.url);
const changelog = readFileSync(new URL("CHANGELOG.md", wurzel), "utf8");
const [erstes, zweites] = process.argv.slice(2);

try {
  if (erstes === "--pruefe-tag") {
    const { version } = JSON.parse(readFileSync(new URL("package.json", wurzel), "utf8"));
    pruefeTag(zweites ?? "", version, changelog);
    console.log(`Tag ${zweites} passt zu Version ${version}.`);
  } else if (erstes) {
    const abschnitt = changelogAbschnitt(changelog, erstes);
    if (!abschnitt) throw new Error(`CHANGELOG.md hat keinen Abschnitt für Version ${erstes}`);
    console.log(abschnitt.inhalt);
  } else {
    throw new Error("Aufruf: node scripts/changelog-abschnitt.mjs <version> | --pruefe-tag <tag>");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
