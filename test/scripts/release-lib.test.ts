import { describe, expect, test } from "vitest";
import { changelogAbschnitt, heuteIso, pruefeTag } from "../../scripts/release-lib.mjs";

// So schreibt release-please: Überschrift mit Link, Unterabschnitte mit "###".
const CHANGELOG = `# Changelog

Einleitung.

## [1.1.0](https://github.com/geninOne/wow-guild-hub/compare/v1.0.0...v1.1.0) (2026-12-01)


### Features

* **berufe:** Filter nach Rezeptrang ([#7](https://github.com/geninOne/wow-guild-hub/issues/7))

### [1.0.1](https://github.com/geninOne/wow-guild-hub/compare/v1.0.0...v1.0.1) (2026-11-20)

* Korrektur.

## 1.0.0 (2026-11-06)

- Erste Version.
- Zweiter Punkt.
`;

describe("changelogAbschnitt", () => {
  test("liefert Datum und Inhalt eines von Hand geschriebenen Abschnitts", () => {
    expect(changelogAbschnitt(CHANGELOG, "1.0.0")).toEqual({
      datum: "2026-11-06",
      inhalt: "- Erste Version.\n- Zweiter Punkt.",
    });
  });

  test("liest Überschriften von release-please mit Link und behält die Unterabschnitte", () => {
    expect(changelogAbschnitt(CHANGELOG, "1.1.0")).toEqual({
      datum: "2026-12-01",
      inhalt: "### Features\n\n* **berufe:** Filter nach Rezeptrang ([#7](https://github.com/geninOne/wow-guild-hub/issues/7))",
    });
  });

  test("erkennt auch Versionsüberschriften mit drei Rauten", () => {
    expect(changelogAbschnitt(CHANGELOG, "1.0.1")).toEqual({ datum: "2026-11-20", inhalt: "* Korrektur." });
  });

  test("liefert null für eine unbekannte Version", () => {
    expect(changelogAbschnitt(CHANGELOG, "9.9.9")).toBeNull();
    expect(changelogAbschnitt(CHANGELOG, "1.0")).toBeNull();
  });
});

describe("pruefeTag", () => {
  test("akzeptiert ein Tag, das zur Version passt und einen Abschnitt hat", () => {
    expect(() => pruefeTag("v1.0.0", "1.0.0", CHANGELOG)).not.toThrow();
    expect(() => pruefeTag("v1.1.0", "1.1.0", CHANGELOG)).not.toThrow();
  });

  test("lehnt ein Tag ab, das nicht zur Version in package.json passt", () => {
    expect(() => pruefeTag("v1.1.0", "1.0.0", CHANGELOG)).toThrow(/v1\.1\.0.*1\.0\.0/);
  });

  test("lehnt eine Version ohne Changelog-Abschnitt ab", () => {
    expect(() => pruefeTag("v2.0.0", "2.0.0", CHANGELOG)).toThrow(/CHANGELOG/);
  });
});

test("heuteIso rechnet in deutscher Zeit", () => {
  expect(heuteIso(new Date("2026-11-06T23:30:00Z"))).toBe("2026-11-07");
  expect(heuteIso(new Date("2026-11-06T12:00:00Z"))).toBe("2026-11-06");
});
