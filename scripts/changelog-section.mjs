// Prints the CHANGELOG section of a version (for the GitHub release):
//   node scripts/changelog-section.mjs 1.0.0
// Or checks before the deploy that a tag matches package.json and CHANGELOG.md:
//   node scripts/changelog-section.mjs --check-tag v1.0.0
// The old flag --pruefe-tag is still accepted as a deprecated alias.
import { readFileSync } from "node:fs";
import { changelogSection, checkTag } from "./release-lib.mjs";

const root = new URL("../", import.meta.url);
const changelog = readFileSync(new URL("CHANGELOG.md", root), "utf8");
const [first, second] = process.argv.slice(2);

try {
  if (first === "--check-tag" || first === "--pruefe-tag") {
    const { version } = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
    checkTag(second ?? "", version, changelog);
    console.log(`Tag ${second} matches version ${version}.`);
  } else if (first) {
    const section = changelogSection(changelog, first);
    if (!section) throw new Error(`CHANGELOG.md has no section for version ${first}`);
    console.log(section.content);
  } else {
    throw new Error("Usage: node scripts/changelog-section.mjs <version> | --check-tag <tag>");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
