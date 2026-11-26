import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, expect, test } from "vitest";
import {
  entferneBeispieldaten, erzeugeAktivitaet, erzeugeTagesstaende, fuelleBeispieldaten, lokalerSpeicher, pruefeUmgebung, zeitraum,
} from "../../scripts/beispieldaten-lib.mjs";
import type { DaySnapshot } from "../../src/model";
import { member } from "../helpers/members";

test("pruefeUmgebung bricht in Netlify-Umgebungen und bei fremden Adressen ab", () => {
  expect(() => pruefeUmgebung({}, "http://localhost:8888")).not.toThrow();
  expect(() => pruefeUmgebung({}, "http://127.0.0.1:8888")).not.toThrow();
  expect(() => pruefeUmgebung({ NETLIFY: "true" }, "http://localhost:8888")).toThrow(/NETLIFY/);
  expect(() => pruefeUmgebung({ CONTEXT: "production" }, "http://localhost:8888")).toThrow(/CONTEXT/);
  expect(() => pruefeUmgebung({ DEPLOY_ID: "x" }, "http://localhost:8888")).toThrow(/DEPLOY_ID/);
  expect(() => pruefeUmgebung({}, "https://guild-hub.netlify.app")).toThrow(/nur lokal/);
  expect(() => pruefeUmgebung({}, "quatsch")).toThrow(/keine gültige/);
});

test("zeitraum: fünf abgeschlossene Bärenklaue-Wochen und die laufende, Tage ab dem Samstag davor", () => {
  const z = zeitraum("2026-11-16T10:00:00.000Z");
  expect(z.wochen).toEqual(["2026-10-17", "2026-10-24", "2026-10-31", "2026-11-07", "2026-11-14", "2026-11-21"]);
  expect(z.tage[0]).toBe("2026-10-10");
  // Anmeldungen ab dem Sonntag der ersten Woche, gespeichert in den ISO-Wochen, die diese Tage berühren.
  expect(z.anmeldungenAb).toBe("2026-10-11");
  expect(z.aktivitaetsWochen).toEqual(["2026-W41", "2026-W42", "2026-W43", "2026-W44", "2026-W45", "2026-W46", "2026-W47"]);
  expect(z.tage[z.tage.length - 1]).toBe("2026-11-16");
});

test("zeitraum mit Serverstart: keine Woche, die davor endet, und kein Tag davor", () => {
  const z = zeitraum("2026-11-16T10:00:00.000Z", "2026-11-05");
  expect(z.wochen).toEqual(["2026-11-07", "2026-11-14", "2026-11-21"]);
  expect(z.tage[0]).toBe("2026-11-05");
  expect(z.anmeldungenAb).toBe("2026-11-05");
  expect(z.aktivitaetsWochen).toEqual(["2026-W45", "2026-W46", "2026-W47"]);
  expect(z.tage[z.tage.length - 1]).toBe("2026-11-16");
  // Liegt der Serverstart weit zurück, bleibt es bei den üblichen sechs Wochen.
  expect(zeitraum("2026-11-16T10:00:00.000Z", "2026-01-01")).toEqual(zeitraum("2026-11-16T10:00:00.000Z"));
});

const mitglieder = Array.from({ length: 30 }, (_, i) =>
  member({ id: i + 1, level: 10 + i, hasProfile: true, professions: [{ id: 186, skill: 100 }] }),
);

test("erzeugeAktivitaet: deterministisch, gekennzeichnet, nichts in der Zukunft, nur Aktive", () => {
  const wochen = ["2026-W46", "2026-W47"];
  const jetzt = "2026-11-17T10:30:00.000Z"; // Dienstag 11:30 Berlin
  const alle = [...mitglieder, member({ id: 99, former: true })];
  const a = erzeugeAktivitaet(alle, wochen, jetzt);
  expect(erzeugeAktivitaet(alle, wochen, jetzt)).toEqual(a);
  expect(a.every((w: { testdaten: boolean }) => w.testdaten)).toBe(true);
  expect(Object.keys(a[0].characters).length).toBeGreaterThan(10);
  expect((a[0].characters as Record<string, number[]>)["99"]).toBeUndefined();
  const spaeteste = Math.max(...Object.values(a[1].characters as Record<string, number[]>).flat());
  expect(spaeteste).toBeLessThanOrEqual(24 + 11);
  // Rückkehrer nur mit Aktivität in der Woche und mindestens 14 Tagen Pause
  const viele = erzeugeAktivitaet(mitglieder, ["2026-W40", "2026-W41", "2026-W42", "2026-W43", "2026-W44", "2026-W45"], jetzt);
  const rueck = viele.flatMap((w: { characters: Record<string, number[]>; returns?: Record<string, number> }) =>
    Object.entries(w.returns ?? {}).map(([id, tage]) => ({ aktiv: id in w.characters, tage })));
  expect(rueck.length).toBeGreaterThan(0);
  expect(rueck.every((x: { aktiv: boolean; tage: number }) => x.aktiv && x.tage >= 14)).toBe(true);
});

test("erzeugeTagesstaende: echte Stände bleiben, Werte steigen nie über den nächsten echten Stand", () => {
  const tage = ["2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"];
  const echt: DaySnapshot = {
    date: "2026-11-06", takenAt: "x",
    characters: { "1": { level: 3, equippedItemLevel: null, professions: {} } },
  };
  const staende = erzeugeTagesstaende(mitglieder, tage, new Map([["2026-11-06", echt]]));
  expect([...staende.keys()]).toEqual(["2026-11-04", "2026-11-05", "2026-11-07"]);
  expect(staende.get("2026-11-05").characters["1"].level).toBeLessThanOrEqual(3);
  expect(staende.get("2026-11-07").characters["1"].level).toBe(10);
  for (const s of staende.values()) {
    expect(s.testdaten).toBe(true);
    expect(typeof s.characters["5"].deaths).toBe("number");
    expect(typeof s.characters["5"].achievements).toBe("number");
    expect(typeof s.characters["5"].reputation).toBe("number");
  }
  // Monoton: Level und Zähler fallen rückwärts nie unter 0 und steigen vorwärts nie
  const a = staende.get("2026-11-04").characters["20"];
  const b = staende.get("2026-11-07").characters["20"];
  expect(a.level).toBeLessThanOrEqual(b.level);
  expect(a.deaths).toBeLessThanOrEqual(b.deaths);
});

test("erzeugeAktivitaet mit Serverstart: keine Anmeldung und keine lange Pause vor dem Serverstart", () => {
  const wochen = ["2026-W45", "2026-W46"];
  const jetzt = "2026-11-17T10:30:00.000Z";
  const ohne = erzeugeAktivitaet(mitglieder, wochen, jetzt);
  const mit = erzeugeAktivitaet(mitglieder, wochen, jetzt, "2026-11-05");
  // 5.11. ist der Donnerstag der W45: Wochenstunden ab 3 * 24.
  const stunden = Object.values(mit[0].characters as Record<string, number[]>).flat();
  expect(stunden.length).toBeGreaterThan(20);
  expect(Math.min(...stunden)).toBeGreaterThanOrEqual(3 * 24);
  expect(Math.min(...Object.values(ohne[0].characters as Record<string, number[]>).flat())).toBeLessThan(3 * 24);
  // Die Woche danach bleibt bis auf die unmöglichen Rückkehrer gleich.
  expect(mit[1].characters).toEqual(ohne[1].characters);
  expect(mit.every((w: { returns?: unknown }) => w.returns === undefined)).toBe(true);
});

test("erzeugeTagesstaende mit Serverstart: Level 1 und Zähler 0 am ersten Tag, dann steigend bis zum heutigen Stand", () => {
  const tage = Array.from({ length: 12 }, (_, i) => `2026-11-${String(5 + i).padStart(2, "0")}`);
  const echt: DaySnapshot = {
    date: "2026-11-09", takenAt: "x",
    characters: { "1": { level: 9, equippedItemLevel: null, professions: {}, deaths: 2 }, "30": { level: 2, equippedItemLevel: null, professions: {} } },
  };
  const staende = erzeugeTagesstaende(mitglieder, tage, new Map([["2026-11-09", echt]]), {}, "2026-11-05");
  expect(staende.has("2026-11-09")).toBe(false);
  for (const m of mitglieder) {
    const id = String(m.id);
    expect(staende.get("2026-11-05").characters[id]).toMatchObject({
      level: 1, professions: {}, deaths: 0, dungeons: 0, recipes: 0, achievements: 0, reputation: 0,
    });
    expect(staende.get("2026-11-16").characters[id]).toMatchObject({ level: m.level, professions: { "186": 100 } });
    let vorher = staende.get("2026-11-05").characters[id];
    for (const tag of tage.slice(1)) {
      const jetzt = (staende.get(tag) ?? echt).characters[id];
      if (!jetzt) continue;
      expect(jetzt.level).toBeGreaterThanOrEqual(vorher.level);
      if (typeof jetzt.deaths === "number") expect(jetzt.deaths).toBeGreaterThanOrEqual(vorher.deaths ?? 0);
      vorher = { ...vorher, ...jetzt };
    }
  }
  // Nicht alle steigen im Gleichschritt.
  const mitte = mitglieder.map((m) => staende.get("2026-11-10").characters[String(m.id)].level / m.level);
  expect(Math.max(...mitte) - Math.min(...mitte)).toBeGreaterThan(0.15);
  // Echte Stände begrenzen nach oben (davor) und nach unten (danach).
  expect(staende.get("2026-11-08").characters["30"].level).toBeLessThanOrEqual(2);
  expect(staende.get("2026-11-10").characters["1"].level).toBeGreaterThanOrEqual(9);
  expect(staende.get("2026-11-10").characters["1"].deaths).toBeGreaterThanOrEqual(2);
});

let ordner: string;
beforeEach(async () => {
  ordner = await mkdtemp(join(tmpdir(), "blobs-"));
  const store = join(ordner, "entries", "unlinked", "site:gilde");
  await mkdir(join(store, "history"), { recursive: true });
  await writeFile(join(store, "guild"), JSON.stringify({ members: mitglieder }));
  await writeFile(join(store, "history", "2026-11-06"), JSON.stringify({ date: "2026-11-06", takenAt: "x", characters: {} }));
});

test("lokalerSpeicher liest und schreibt das Dateiformat des lokalen Blob-Servers", async () => {
  const s = await lokalerSpeicher(ordner);
  await s.set("activity/2026-W47", { a: 1 });
  expect(await s.get("activity/2026-W47")).toEqual({ a: 1 });
  expect(await readFile(join(ordner, "metadata", "unlinked", "site:gilde", "activity", "2026-W47"), "utf8")).toBe("{}");
  expect(await s.list("history/")).toEqual(["history/2026-11-06"]);
  await s.delete("activity/2026-W47");
  expect(await s.get("activity/2026-W47")).toBeNull();
  await expect(lokalerSpeicher(join(ordner, "fehlt"))).rejects.toThrow(/Kein lokaler Blob-Speicher/);
});

test("fuelleBeispieldaten und entferneBeispieldaten lassen echte Daten stehen", async () => {
  const s = await lokalerSpeicher(ordner);
  await s.set("activity/2026-W47", { week: "2026-W47", characters: { "1": [3] } });
  await s.set("weekly/2026-11-14", { week: "2026-11-14" });
  await s.set("weekly/2026-W40", { week: "2026-W40" });
  // Alte ISO-Ausgaben im Zeitraum: erzeugte fallen weg, echte bleiben.
  await s.set("weekly/2026-W44", { week: "2026-W44" });
  await s.set("weekly/2026-W45", { week: "2026-W45", testdaten: true });
  await s.set("weekly/index", { weeks: ["2026-W40", "2026-W44", "2026-W45", "2026-11-14"] });

  const res = await fuelleBeispieldaten(s, "2026-11-16T10:00:00.000Z");
  expect(res.aktivitaet).toBe(6);
  // W41 enthält nur den Sonntag 11.10., den ersten Tag der ersten Bärenklaue-Woche.
  const w41 = await s.get("activity/2026-W41");
  expect(Object.values(w41.characters).flat().every((h) => (h as number) >= 6 * 24)).toBe(true);
  expect(await s.get("activity/2026-W47")).toEqual({ week: "2026-W47", characters: { "1": [3] } });
  expect((await s.get("activity/2026-W46")).testdaten).toBe(true);
  expect(await s.get("history/2026-11-06")).toEqual({ date: "2026-11-06", takenAt: "x", characters: {} });
  expect((await s.get("history/2026-11-05")).testdaten).toBe(true);
  expect(await s.get("weekly/2026-11-14")).toBeNull();
  expect(await s.get("weekly/2026-W45")).toBeNull();
  expect(await s.get("weekly/2026-W44")).toEqual({ week: "2026-W44" });
  expect(await s.get("weekly/index")).toEqual({ weeks: ["2026-W40", "2026-W44"] });
  await s.delete("weekly/2026-W44");

  await s.set("weekly/2026-11-14", { week: "2026-11-14", testdaten: true });
  await s.set("weekly/index", { weeks: ["2026-W40", "2026-11-14"] });
  await entferneBeispieldaten(s);
  expect(await s.list("activity/")).toEqual(["activity/2026-W47"]);
  expect(await s.list("history/")).toEqual(["history/2026-11-06"]);
  expect(await s.get("weekly/index")).toEqual({ weeks: ["2026-W40"] });
  expect(await s.get("weekly/2026-W40")).toEqual({ week: "2026-W40" });
});

test("loescheWochenergebnisse entfernt Ergebnis und Archiv-Eintrag, andere Wochen bleiben", async () => {
  const { loescheWochenergebnisse } = await import("../../scripts/beispieldaten-lib.mjs");
  const s = await lokalerSpeicher(ordner);
  await s.set("weekly/2026-W45", { week: "2026-W45" });
  await s.set("weekly/2026-W46", { week: "2026-W46" });
  await s.set("weekly/index", { weeks: ["2026-W45", "2026-W46"], entries: { "2026-W45": { headline: "A" }, "2026-W46": { headline: "B" } } });
  expect(await loescheWochenergebnisse(s, ["2026-W46"])).toBe(1);
  expect(await s.get("weekly/2026-W46")).toBeNull();
  expect(await s.get("weekly/2026-W45")).toEqual({ week: "2026-W45" });
  expect(await s.get("weekly/index")).toEqual({ weeks: ["2026-W45"], entries: { "2026-W45": { headline: "A" } } });
});

test("fuelleBeispieldaten mit Serverstart: nichts davor, alte Beispieldaten von davor verschwinden, echte bleiben", async () => {
  const s = await lokalerSpeicher(ordner);
  await s.set("history/2026-10-31", { date: "2026-10-31", takenAt: "x", characters: {}, testdaten: true });
  await s.set("history/2026-10-30", { date: "2026-10-30", takenAt: "x", characters: {} });
  await s.set("activity/2026-W43", { week: "2026-W43", characters: {}, testdaten: true });
  await s.set("activity/2026-W42", { week: "2026-W42", characters: { "1": [3] } });
  await s.set("weekly/2026-W43", { week: "2026-W43", testdaten: true });
  await s.set("weekly/2026-10-31", { week: "2026-10-31", testdaten: true });
  await s.set("weekly/2026-W42", { week: "2026-W42" });
  await s.set("weekly/index", { weeks: ["2026-W42", "2026-W43", "2026-10-31"] });

  const zeilen: string[] = [];
  const res = await fuelleBeispieldaten(s, "2026-11-16T10:00:00.000Z", (z: string) => zeilen.push(z), "2026-11-05");
  expect(res.wochen).toEqual(["2026-11-07", "2026-11-14", "2026-11-21"]);
  expect(zeilen[0]).toMatch(/^4 Beispieldaten aus der Zeit vor dem Serverstart/);
  expect(await s.get("weekly/2026-10-31")).toBeNull();
  expect(await s.list("activity/")).toEqual(["activity/2026-W42", "activity/2026-W45", "activity/2026-W46", "activity/2026-W47"]);
  const tage = (await s.list("history/")).map((k: string) => k.slice("history/".length));
  expect(tage[0]).toBe("2026-10-30");
  expect(tage[1]).toBe("2026-11-05");
  expect(tage).toHaveLength(13);
  expect((await s.get("history/2026-11-05")).characters["7"]).toMatchObject({ level: 1, deaths: 0 });
  expect(await s.get("history/2026-11-06")).toEqual({ date: "2026-11-06", takenAt: "x", characters: {} });
  expect(await s.get("weekly/index")).toEqual({ weeks: ["2026-W42"] });
  expect(await s.get("weekly/2026-W42")).toEqual({ week: "2026-W42" });
});

test("erzeugeWerte: Ressource nach Klasse, gleich bei gleicher ID, als Beispieldaten markiert", async () => {
  const { erzeugeWerte } = await import("../../scripts/beispieldaten-lib.mjs");
  const krieger = erzeugeWerte({ id: 7, level: 30, classId: 1 }, "t");
  expect(krieger).toEqual(erzeugeWerte({ id: 7, level: 30, classId: 1 }, "t"));
  expect(krieger).toMatchObject({ fetchedAt: "t", powerType: { id: 1, name: "Wut" }, testdaten: true });
  expect(krieger.fields).not.toHaveProperty("mana_regen");
  expect(krieger.fields.strength.effective).toBeGreaterThan(krieger.fields.intellect.effective);
  const magier = erzeugeWerte({ id: 8, level: 30, classId: 8 }, "t");
  expect(magier.powerType).toEqual({ id: 0, name: "Mana" });
  expect(magier.fields.mana_regen).toBeGreaterThan(0);
  expect(erzeugeWerte({ id: 9, level: 30, classId: 4 }, "t").powerType.id).toBe(3);
  expect(erzeugeWerte({ id: 9, level: 30, classId: 6 }, "t").powerType.id).toBe(6);
});

test("fuelleBeispieldaten legt fehlende Werte an, echte bleiben, entfernen löscht nur erfundene", async () => {
  const s = await lokalerSpeicher(ordner);
  const gilde = await s.get("guild");
  const [erster, zweiter] = gilde.members.filter((m: { former: boolean; hasProfile: boolean }) => !m.former && m.hasProfile);
  await s.set(`attributes/${erster.id}`, { fetchedAt: "echt", fields: { health: 1 }, powerType: null });
  const res = await fuelleBeispieldaten(s, "2026-11-16T10:00:00.000Z");
  expect(res.werte).toBeGreaterThan(0);
  expect((await s.get(`attributes/${zweiter.id}`)).testdaten).toBe(true);
  await entferneBeispieldaten(s);
  expect(await s.list("attributes/")).toEqual([`attributes/${erster.id}`]);
});
