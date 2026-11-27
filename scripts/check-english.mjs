// Reports German in code (file names, identifiers, comments, test names, log and error messages). UI texts,
// translations (*.de.md) and fixtures are left out; details in scripts/check-english-lib.mjs.
//
//   npm run check:english                    lines changed against origin/main (committed and uncommitted)
//   npm run check:english -- --base main     against another base
//   npm run check:english -- --all           every tracked file
//   npm run check:english -- --strict        exit code 1 if anything is found (for CI)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { formatReport, onlyChanged, parseDiff, parseWordList, scanFile } from "./check-english-lib.mjs";

const { values } = parseArgs({
  options: {
    all: { type: "boolean", default: false },
    base: { type: "string", default: "origin/main" },
    strict: { type: "boolean", default: false },
  },
});

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const words = parseWordList(readFileSync(new URL("./check-english-words.txt", import.meta.url), "utf8"));

let changes = null;
let paths;
if (values.all) {
  paths = git("ls-files").split("\n").filter(Boolean);
} else {
  const mergeBase = git("merge-base", values.base, "HEAD").trim();
  changes = parseDiff(git("diff", "--unified=0", "--no-color", "--find-renames", mergeBase));
  paths = [...changes.keys()];
}

let findings = [];
for (const path of paths) {
  let source;
  try {
    source = readFileSync(path, "utf8");
  } catch {
    continue; // deleted or unreadable
  }
  findings.push(...scanFile(path, source, words));
}
if (changes) findings = onlyChanged(findings, changes);

console.log(formatReport(findings));
if (values.strict && findings.length > 0) process.exitCode = 1;
