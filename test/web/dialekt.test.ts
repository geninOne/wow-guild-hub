import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import karten from "../../config/statistik-karten.json";
import { monthLabel } from "../../web/src/lib/fun";

const root = resolve(__dirname, "../..");

/** Zeilen je Fassung: Jede Zeile gehört zur letzten davor stehenden Angabe `de:`, `schwaebisch:` oder `bayrisch:`. */
function zeilenJeFassung(datei: string): Record<string, string[]> {
  const result: Record<string, string[]> = { de: [], schwaebisch: [], bayrisch: [] };
  let aktuell: string | null = null;
  for (const zeile of readFileSync(resolve(root, datei), "utf8").split("\n")) {
    const m = /^\s*(de|schwaebisch|bayrisch)\s*:/.exec(zeile);
    if (m) aktuell = m[1];
    if (aktuell) result[aktuell].push(zeile);
  }
  return result;
}

test("Schwäbische Satzbausteine sagen net, nicht das bayrische ned", () => {
  const schwaebisch = zeilenJeFassung("src/weekly/phrases.ts").schwaebisch;
  expect(schwaebisch.length).toBeGreaterThan(100);
  expect(schwaebisch.filter((z) => /\bned\b/.test(z))).toEqual([]);
});

/** Alle Texte einer Fassung aus config/statistik-karten.json. */
function kartenTexte(language: "schwaebisch" | "bayrisch"): string[] {
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
  walk(karten);
  return out;
}

test("Keine österreichischen oder vertauschten Formen in den Karten", () => {
  const schwaebisch = kartenTexte("schwaebisch").join(" | ");
  const bayrisch = kartenTexte("bayrisch").join(" | ");
  expect(schwaebisch).toContain("Durscht isch");
  for (const falsch of ["no an ", "Durst isch"]) expect(schwaebisch).not.toContain(falsch);
  for (const falsch of ["Lila Taal", "Durscht is "]) expect(bayrisch).not.toContain(falsch);
});

test("Bayrische Monatsnamen ohne Jänner und Feber", () => {
  expect(monthLabel("2027-01", "bayrisch")).toBe("Januar 2027");
  expect(monthLabel("2027-02", "bayrisch")).toBe("Februar 2027");
});
