import { describe, expect, test } from "vitest";
import {
  changelogAbschnitt,
  changelogFreigeben,
  heuteIso,
  naechsteVersion,
  pruefeTag,
  zielVersion,
} from "../../scripts/release-lib.mjs";

const CHANGELOG = `# Änderungen

Einleitung.

## Unveröffentlicht

## 1.0.0 (2026-11-06)

- Erste Version.
- Zweiter Punkt.
`;

describe("naechsteVersion", () => {
  test("erhöht Patch, Minor und Major nach Semantic Versioning", () => {
    expect(naechsteVersion("1.0.0", "patch")).toBe("1.0.1");
    expect(naechsteVersion("1.2.3", "minor")).toBe("1.3.0");
    expect(naechsteVersion("1.2.3", "major")).toBe("2.0.0");
  });

  test("lehnt unbekannte Art und ungültige Version ab", () => {
    expect(() => naechsteVersion("1.0", "patch")).toThrow(/1\.0/);
    expect(() => naechsteVersion("1.0.0", "riesig" as never)).toThrow(/patch, minor oder major/);
  });
});

describe("zielVersion", () => {
  test("aktuell veröffentlicht die Version ohne Erhöhung, sonst wie naechsteVersion", () => {
    expect(zielVersion("1.0.0", "aktuell")).toEqual({ version: "1.0.0", erhoehen: false });
    expect(zielVersion("1.0.0", "minor")).toEqual({ version: "1.1.0", erhoehen: true });
  });

  test("lehnt unbekannte Art mit allen erlaubten ab", () => {
    expect(() => zielVersion("1.0.0", "" as never)).toThrow(/aktuell/);
  });
});

describe("changelogAbschnitt", () => {
  test("liefert Datum und Inhalt des Abschnitts einer Version", () => {
    expect(changelogAbschnitt(CHANGELOG, "1.0.0")).toEqual({
      datum: "2026-11-06",
      inhalt: "- Erste Version.\n- Zweiter Punkt.",
    });
  });

  test("liefert null für eine unbekannte Version", () => {
    expect(changelogAbschnitt(CHANGELOG, "9.9.9")).toBeNull();
    expect(changelogAbschnitt(CHANGELOG, "1.0")).toBeNull();
  });
});

describe("changelogFreigeben", () => {
  const mitEintrag = CHANGELOG.replace("## Unveröffentlicht\n", "## Unveröffentlicht\n\n- Neue Berufe-Ansicht.\n");

  test("macht aus Unveröffentlicht einen datierten Abschnitt und legt ein neues leeres an", () => {
    const neu = changelogFreigeben(mitEintrag, "1.1.0", "2026-11-07");
    expect(neu).toContain("## Unveröffentlicht\n\n## 1.1.0 (2026-11-07)\n\n- Neue Berufe-Ansicht.\n\n## 1.0.0 (2026-11-06)");
    expect(changelogAbschnitt(neu, "1.1.0")).toEqual({ datum: "2026-11-07", inhalt: "- Neue Berufe-Ansicht." });
    expect(changelogAbschnitt(neu, "1.0.0")?.inhalt).toBe("- Erste Version.\n- Zweiter Punkt.");
  });

  test("bricht ab, wenn unter Unveröffentlicht nichts steht", () => {
    expect(() => changelogFreigeben(CHANGELOG, "1.1.0", "2026-11-07")).toThrow(/Unveröffentlicht/);
  });

  test("bricht ab, wenn der Abschnitt Unveröffentlicht fehlt", () => {
    expect(() => changelogFreigeben("# Änderungen\n\n## 1.0.0 (2026-11-06)\n\n- x\n", "1.1.0", "2026-11-07")).toThrow(
      /Unveröffentlicht/,
    );
  });

  test("bricht ab, wenn die Version schon im Changelog steht", () => {
    expect(() => changelogFreigeben(mitEintrag, "1.0.0", "2026-11-07")).toThrow(/1\.0\.0/);
  });
});

describe("pruefeTag", () => {
  test("akzeptiert ein Tag, das zur Version passt und einen Abschnitt hat", () => {
    expect(() => pruefeTag("v1.0.0", "1.0.0", CHANGELOG)).not.toThrow();
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
