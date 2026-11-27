import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  germanPathParts,
  isGermanName,
  isGermanText,
  onlyChanged,
  parseDiff,
  parseWordList,
  scanFile,
  splitName,
  tokenizeJs,
} from "../../scripts/check-english-lib.mjs";

const words = parseWordList(readFileSync("scripts/check-english-words.txt", "utf8"));

describe("names", () => {
  test("splits camelCase, SCREAMING_CASE and kebab-case", () => {
    expect(splitName("fassungIn")).toEqual(["fassung", "in"]);
    expect(splitName("SPRACH_NAMEN")).toEqual(["sprach", "namen"]);
    expect(splitName("HTMLParser")).toEqual(["html", "parser"]);
    expect(splitName("frueher-vogel")).toEqual(["frueher", "vogel"]);
  });

  test("detects German word parts and umlauts", () => {
    expect(isGermanName("useSprache", words)).toBe(true);
    expect(isGermanName("ZeitungView", words)).toBe(true);
    expect(isGermanName("größe", words)).toBe(true);
    expect(isGermanName("useLanguage", words)).toBe(false);
    expect(isGermanName("NewspaperView", words)).toBe(false);
  });

  test("leaves frozen names alone", () => {
    expect(isGermanName("bayrisch", words)).toBe(false);
    expect(isGermanName("rueckblick", words)).toBe(false);
    expect(isGermanName("nachteule", words)).toBe(false);
  });

  test("finds German folders and file names", () => {
    expect(germanPathParts("src/erweiterungen/typen.ts", words)).toEqual(["erweiterungen", "typen.ts"]);
    expect(germanPathParts("src/extensions/types.ts", words)).toEqual([]);
  });
});

describe("prose", () => {
  test("recognizes German sentences", () => {
    expect(isGermanText("Lädt die Daten neu", words)).toBe(true);
    expect(isGermanText("Wird nur einmal pro Woche aufgerufen", words)).toBe(true);
    expect(isGermanText("Noch keine Daten gesammelt", words)).toBe(true);
    expect(isGermanText("Titel pruefen", words)).toBe(true);
  });

  test("accepts English sentences, also with German names in backticks", () => {
    expect(isGermanText("Loads the data again", words)).toBe(false);
    expect(isGermanText("Runs once per week, see `bausteine.ts` and `Fassungen`", words)).toBe(false);
    expect(isGermanText("Lint, test, typecheck, build", words)).toBe(false);
  });
});

describe("tokenizer", () => {
  test("separates code, comments and strings, also in template literals", () => {
    const pieces = tokenizeJs('const a = `x ${b + "c"} y`; // note\n/* block */ d("e");');
    expect(pieces.filter((p) => p.kind === "string").map((p) => p.text)).toEqual(["x ", "c", " y", "e"]);
    expect(pieces.filter((p) => p.kind === "comment").map((p) => [p.text.trim(), p.line])).toEqual([
      ["note", 1],
      ["block", 2],
    ]);
  });
});

test("treats regular expression literals like strings", () => {
  const pieces = tokenizeJs('const re = /^(Höchste|Meiste) [a-z/]+$/u; const x = a / b / c;');
  expect(pieces.filter((p) => p.kind === "string").map((p) => p.text)).toEqual(["/^(Höchste|Meiste) [a-z/]+$/u"]);
  expect(scanFile("src/x.ts", 'const re = /^(Höchste|Meiste)/;', words)).toEqual([]);
  const jsx = tokenizeJs('const a = <p className="x">{zeitung}</p>;\nconst b = <br />;');
  expect(jsx.filter((p) => p.kind === "string").map((p) => p.text)).toEqual(["x"]);
});

describe("scanFile", () => {
  test("reports identifiers, comments, test names and messages", () => {
    const source = [
      "// Lädt die Gilde",
      "const zeitung = 1;",
      'test("lädt die Gilde", () => {});',
      'throw new Error("Nicht gefunden");',
      'console.log("Fertig, alles hochgeladen");',
    ].join("\n");
    const kinds = scanFile("test/x.test.ts", source, words).map((f) => [f.kind, f.line]);
    expect(kinds).toEqual([
      ["comment", 1],
      ["identifier", 2],
      ["test-name", 3],
      ["message", 4],
      ["message", 5],
    ]);
  });

  test("leaves UI texts in translation objects alone", () => {
    const source = 'const T = { title: { de: "Nicht gefunden", en: "Not found", bayrisch: "Ned gfundn" } };';
    expect(scanFile("web/src/x.tsx", source, words)).toEqual([]);
  });

  test("skips translations, fixtures, assets and modules of forks", () => {
    const german = "// Lädt die Gilde\nconst zeitung = 1;";
    expect(scanFile("README.de.md", german, words)).toEqual([]);
    expect(scanFile("test/fixtures/x.ts", german, words)).toEqual([]);
    expect(scanFile("src/erweiterungen/erfolge/api.ts", german, words)).toEqual([]);
    expect(scanFile("web/src/extensions/erfolge/index.tsx", german, words)).toEqual([]);
    expect(scanFile("src/extensions/index.ts", german, words)).not.toEqual([]);
  });

  test("checks comments, step names and echoed messages in workflows", () => {
    const yaml = ["# Prüft den Titel", "jobs:", "  - name: Titel prüfen", '    run: echo "Titel passt nicht"'].join("\n");
    expect(scanFile(".github/workflows/x.yml", yaml, words).map((f) => [f.kind, f.line])).toEqual([
      ["comment", 1],
      ["message", 3],
      ["message", 4],
    ]);
  });
});

describe("diff", () => {
  const diff = [
    "diff --git a/src/a.ts b/src/a.ts",
    "--- a/src/a.ts",
    "+++ b/src/a.ts",
    "@@ -3 +3,2 @@",
    "diff --git a/src/neu.ts b/src/neu.ts",
    "new file mode 100644",
    "--- /dev/null",
    "+++ b/src/neu.ts",
    "@@ -0,0 +1 @@",
  ].join("\n");

  test("collects changed lines and new files", () => {
    const changes = parseDiff(diff);
    expect([...changes.get("src/a.ts")!.lines]).toEqual([3, 4]);
    expect(changes.get("src/a.ts")!.newName).toBe(false);
    expect(changes.get("src/neu.ts")!.newName).toBe(true);
  });

  test("keeps only findings on changed lines and names of new files", () => {
    const findings: Parameters<typeof onlyChanged>[0] = [
      { path: "src/a.ts", line: 1, kind: "comment", text: "alt" },
      { path: "src/a.ts", line: 4, kind: "comment", text: "neu" },
      { path: "src/neu.ts", line: 0, kind: "file-name", text: "neu.ts" },
      { path: "src/b.ts", line: 1, kind: "comment", text: "fremd" },
    ];
    expect(onlyChanged(findings, parseDiff(diff)).map((f) => f.text)).toEqual(["neu", "neu.ts"]);
  });
});
