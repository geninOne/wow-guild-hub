import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import cards from "../../config/statistik-karten.json";
import { monthLabel } from "../../web/src/lib/fun";

const root = resolve(__dirname, "../..");

/** Lines per version: each line belongs to the last `de:`, `schwaebisch:` or `bayrisch:` key before it. */
function linesPerVersion(file: string): Record<string, string[]> {
  const result: Record<string, string[]> = { de: [], schwaebisch: [], bayrisch: [] };
  let current: string | null = null;
  for (const line of readFileSync(resolve(root, file), "utf8").split("\n")) {
    const m = /^\s*(de|schwaebisch|bayrisch)\s*:/.exec(line);
    if (m) current = m[1];
    if (current) result[current].push(line);
  }
  return result;
}

test("Swabian text templates say net, not the Bavarian ned", () => {
  const schwaebisch = linesPerVersion("src/weekly/phrases.ts").schwaebisch;
  expect(schwaebisch.length).toBeGreaterThan(100);
  expect(schwaebisch.filter((z) => /\bned\b/.test(z))).toEqual([]);
});

/** All texts of one version from config/statistik-karten.json. */
function cardTexts(language: "schwaebisch" | "bayrisch"): string[] {
  const out: string[] = [];
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      for (const [k, w] of Object.entries(v)) {
        if (k === language) out.push(...(Array.isArray(w) ? w : [w]).filter((x): x is string => typeof x === "string"));
        else walk(w);
      }
    }
  };
  walk(cards);
  return out;
}

test("no Austrian or swapped forms in the cards", () => {
  const schwaebisch = cardTexts("schwaebisch").join(" | ");
  const bayrisch = cardTexts("bayrisch").join(" | ");
  expect(schwaebisch).toContain("Durscht isch");
  for (const wrong of ["no an ", "Durst isch"]) expect(schwaebisch).not.toContain(wrong);
  for (const wrong of ["Lila Taal", "Durscht is "]) expect(bayrisch).not.toContain(wrong);
});

test("Bavarian month names without the Austrian forms for January and February", () => {
  expect(monthLabel("2027-01", "bayrisch")).toBe("Januar 2027");
  expect(monthLabel("2027-02", "bayrisch")).toBe("Februar 2027");
});
