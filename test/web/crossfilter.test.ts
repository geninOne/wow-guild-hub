import { describe, expect, test } from "vitest";
import type { MemberRow } from "../../src/api/types";
import {
  crossFilter,
  EMPTY_SELECTION,
  isEmptySelection,
  keepSelected,
  matchesSelection,
  memberFigures,
  toggleSelection,
  type Selection,
} from "../../web/src/lib/crossfilter";

function row(over: Partial<MemberRow>): MemberRow {
  return {
    id: 1, name: "X", surname: null, slug: "x", level: 10, classId: 1, className: "Krieger", raceId: 1, raceName: "Mensch",
    rank: 3, rankName: "Rang 3", itemLevel: null, mainSpecName: null, hasProfile: true, former: false,
    guildSlug: "bärenklaue", guildName: "Bärenklaue", professions: [], ...over,
  };
}

// Tauren: Druide 12, Druide 60, Krieger 15. Orc: Krieger 60, Schamane 60. Ehemaliger Tauren-Druide.
const rows: MemberRow[] = [
  row({ id: 1, raceId: 6, raceName: "Tauren", classId: 11, className: "Druide", level: 12 }),
  row({ id: 2, raceId: 6, raceName: "Tauren", classId: 11, className: "Druide", level: 60 }),
  row({ id: 3, raceId: 6, raceName: "Tauren", classId: 1, className: "Krieger", level: 15 }),
  row({ id: 4, raceId: 2, raceName: "Orc", classId: 1, className: "Krieger", level: 60 }),
  row({ id: 5, raceId: 2, raceName: "Orc", classId: 7, className: "Schamane", level: 60 }),
  row({ id: 6, raceId: 6, raceName: "Tauren", classId: 11, className: "Druide", level: 14, former: true }),
];

const ids = (list: MemberRow[]) => list.map((m) => m.id);
const sel = (over: Partial<Selection>): Selection => ({ ...EMPTY_SELECTION, ...over });

describe("crossFilter", () => {
  test("ohne Auswahl zeigen alle Diagramme alle aktiven Mitglieder", () => {
    const f = crossFilter(rows, EMPTY_SELECTION);
    for (const list of [f.forRaces, f.forClasses, f.forLevels, f.selected]) expect(ids(list)).toEqual([1, 2, 3, 4, 5]);
  });

  test("ein Volk filtert Klassen und Level, die Torte selbst bleibt ungefiltert", () => {
    const f = crossFilter(rows, sel({ raceId: 6 }));
    expect(ids(f.forClasses)).toEqual([1, 2, 3]);
    expect(ids(f.forLevels)).toEqual([1, 2, 3]);
    expect(ids(f.forRaces)).toEqual([1, 2, 3, 4, 5]);
    expect(ids(f.selected)).toEqual([1, 2, 3]);
  });

  test("jedes Diagramm filtert nach den beiden anderen Achsen", () => {
    // Tauren, Krieger, 10 bis 19
    const f = crossFilter(rows, { raceId: 6, classId: 1, bandIndex: 1 });
    expect(ids(f.forRaces)).toEqual([3]); // Krieger auf 10 bis 19, jedes Volk
    expect(ids(f.forClasses)).toEqual([1, 3]); // Tauren auf 10 bis 19, jede Klasse
    expect(ids(f.forLevels)).toEqual([3]); // Tauren-Krieger, jedes Level
    expect(ids(f.selected)).toEqual([3]);
  });

  test("Kombination ohne Treffer ergibt leere Mengen", () => {
    const f = crossFilter(rows, sel({ raceId: 2, classId: 11 }));
    expect(f.selected).toEqual([]);
    expect(f.forLevels).toEqual([]);
    expect(ids(f.forRaces)).toEqual([1, 2]);
  });
});

describe("matchesSelection", () => {
  test("Levelstufe zählt beide Enden mit, Level 60 ist eine eigene Stufe", () => {
    expect(matchesSelection(row({ level: 10 }), sel({ bandIndex: 1 }))).toBe(true);
    expect(matchesSelection(row({ level: 19 }), sel({ bandIndex: 1 }))).toBe(true);
    expect(matchesSelection(row({ level: 20 }), sel({ bandIndex: 1 }))).toBe(false);
    expect(matchesSelection(row({ level: 59 }), sel({ bandIndex: 6 }))).toBe(false);
    expect(matchesSelection(row({ level: 60 }), sel({ bandIndex: 6 }))).toBe(true);
  });

  test("übersprungene Achse zählt nicht", () => {
    expect(matchesSelection(row({ raceId: 2 }), sel({ raceId: 6 }), "race")).toBe(true);
    expect(matchesSelection(row({ raceId: 2 }), sel({ raceId: 6 }), "class")).toBe(false);
  });
});

describe("toggleSelection", () => {
  test("wählt, wechselt und hebt die Wahl beim zweiten Klick auf", () => {
    const a = toggleSelection(EMPTY_SELECTION, "race", 6);
    expect(a).toEqual(sel({ raceId: 6 }));
    const b = toggleSelection(a, "race", 2);
    expect(b).toEqual(sel({ raceId: 2 }));
    expect(toggleSelection(b, "race", 2)).toEqual(EMPTY_SELECTION);
  });

  test("lässt die anderen Achsen stehen, null entfernt eine Achse", () => {
    const a = toggleSelection(toggleSelection(sel({ raceId: 6 }), "class", 11), "level", 1);
    expect(a).toEqual({ raceId: 6, classId: 11, bandIndex: 1 });
    expect(toggleSelection(a, "class", null)).toEqual({ raceId: 6, classId: null, bandIndex: 1 });
    expect(toggleSelection(a, "level", 1)).toEqual({ raceId: 6, classId: 11, bandIndex: null });
  });

  test("Stufe 0 ist ein gültiger Wert", () => {
    expect(toggleSelection(EMPTY_SELECTION, "level", 0)).toEqual(sel({ bandIndex: 0 }));
    expect(isEmptySelection(sel({ bandIndex: 0 }))).toBe(false);
    expect(isEmptySelection(EMPTY_SELECTION)).toBe(true);
  });
});

describe("keepSelected", () => {
  const list = [{ id: 1, count: 3 }];
  const make = (id: number) => ({ id, count: 0 });
  test("hängt den gewählten, gerade ausgefilterten Eintrag mit 0 an", () => {
    expect(keepSelected(list, 7, (e) => e.id, make)).toEqual([{ id: 1, count: 3 }, { id: 7, count: 0 }]);
  });
  test("lässt die Liste sonst unverändert", () => {
    expect(keepSelected(list, 1, (e) => e.id, make)).toEqual(list);
    expect(keepSelected(list, null, (e) => e.id, make)).toEqual(list);
    expect(keepSelected(list, 7, (e) => e.id, () => null)).toEqual(list);
  });
});

describe("memberFigures", () => {
  test("Kennzahlen der Auswahl: Anzahl, Durchschnitt, Level 60, Klassen", () => {
    expect(memberFigures(crossFilter(rows, sel({ raceId: 6 })).selected)).toEqual({ members: 3, average: 29, capped: 1, classes: 2 });
    expect(memberFigures(crossFilter(rows, EMPTY_SELECTION).selected)).toEqual({ members: 5, average: 41.4, capped: 3, classes: 3 });
  });
  test("leere Menge ergibt Nullen", () => {
    expect(memberFigures([])).toEqual({ members: 0, average: 0, capped: 0, classes: 0 });
  });
});
