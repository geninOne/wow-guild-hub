import { expect, test } from "vitest";
import { artVon, auswerten, fortschreiben, markdownTabellen, median } from "../../scripts/statistik-erkunden-lib.mjs";

const antwort = (werte: Record<number, number>, extra: object = {}) => ({
  categories: [
    { id: 122, name: "Tode", statistics: werte[60] === undefined ? [] : [{ id: 60, name: "Tode insgesamt", quantity: werte[60], last_updated_timestamp: 1 }] },
    {
      id: 132, name: "Fertigkeiten", statistics: [],
      sub_categories: [{ id: 178, name: "Sekundäre Fertigkeiten", statistics: [{ id: 1524, name: "Kochfertigkeit", quantity: werte[1524] ?? 1, ...extra }] }],
    },
  ],
});

test("median", () => {
  expect(median([])).toBeNull();
  expect(median([3, 1, 2])).toBe(2);
  expect(median([4, 1, 2, 3])).toBe(2.5);
});

test("auswerten: Anzahl, Summe, Maximum, Median je Statistik und gefundene Felder", () => {
  const a = auswerten([
    { mitglied: { id: 1, name: "A", level: 10 }, daten: antwort({ 60: 4, 1524: 10 }) },
    { mitglied: { id: 2, name: "B", level: 20 }, daten: antwort({ 1524: 30 }, { description: "x" }) },
    { mitglied: { id: 3, name: "C", level: 20 }, daten: antwort({ 60: 2, 1524: 20 }) },
  ]);
  expect(a.charaktere).toBe(3);
  expect(a.kategorien.map((k: { id: number }) => k.id)).toEqual([122, 132, 178]);
  expect(a.statistiken.find((s: { id: number }) => s.id === 60)).toMatchObject({ anzahl: 2, summe: 6, maximum: 4, median: 3 });
  expect(a.statistiken.find((s: { id: number }) => s.id === 1524)).toMatchObject({ anzahl: 3, summe: 60, maximum: 30, median: 20, textBeispiel: "x" });
  expect(a.felder.statistik).toEqual(["description", "id", "last_updated_timestamp", "name", "quantity"]);
  expect(markdownTabellen(a)).toContain("| 60 | Tode insgesamt | 2 | 6 | 4 | 3 |");
  expect(markdownTabellen(a)).not.toContain("| A");
});

test("artVon ordnet Zähler, Stände, Texte und Schnitte zu", () => {
  expect(artVon({ name: "Tode insgesamt" })).toBe("zaehler");
  expect(artVon({ name: "Kochfertigkeit" })).toBe("stand");
  expect(artVon({ name: "Höchste Bergbaufertigkeit" })).toBe("stand");
  expect(artVon({ name: "Reittiere besessen" })).toBe("stand");
  expect(artVon({ name: "Am häufigsten getöteter Kreaturtyp", textBeispiel: "Humanoid" })).toBe("text");
  expect(artVon({ name: "Durchschnittlich abgeschlossene Quests pro Tag" })).toBe("schnitt");
});

test("fortschreiben behält Bekanntes, ergänzt Neues und übernimmt neue Namen", () => {
  const alt = { _hinweis: "h", kategorien: [{ id: 122, name: "Tode", ober: null }], statistiken: [{ id: 112, name: "Tode durch Ertrinken", kategorie: 122, art: "zaehler" }] };
  const a = auswerten([{ mitglied: { id: 1, name: "A", level: 1 }, daten: antwort({ 60: 1 }) }]);
  const neu = fortschreiben(alt, a);
  expect(neu._hinweis).toBe("h");
  expect(neu.statistiken.map((s: { id: number }) => s.id)).toEqual([60, 112, 1524]);
  expect(neu.statistiken.find((s: { id: number }) => s.id === 1524)).toEqual({ id: 1524, name: "Kochfertigkeit", kategorie: 178, art: "stand" });
  expect(fortschreiben(null, a)._hinweis).toMatch(/statistik:erkunden/);
});
