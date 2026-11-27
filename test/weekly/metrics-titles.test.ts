import { expect, test } from "vitest";
import type { ActivityWeek, DaySnapshot, WeekMetrics, WeeklyRecord } from "../../src/model";
import { weekMetrics } from "../../src/weekly/metrics";
import { awardTitles, isOptedOut, orderHolders, rankTitles, tieHash, titleHolders, TITLES } from "../../src/weekly/titles";
import { member } from "../helpers/members";

type Entry = DaySnapshot["characters"][string];
const snap = (date: string, characters: Record<string, Partial<Entry>>): DaySnapshot => ({
  date,
  takenAt: `${date}T20:00:00.000Z`,
  characters: Object.fromEntries(
    Object.entries(characters).map(([id, c]) => [id, { level: 1, equippedItemLevel: null, professions: {}, ...c }]),
  ),
});

const metric = (over: Partial<WeekMetrics>): WeekMetrics => ({
  logins: 0, nightLogins: 0, earlyLogins: 0, activeDays: 0, levels: null, deaths: null, recipes: null, dungeons: null,
  achievements: null, reputation: null, itemLevel: null, awayDays: 0,
  ...over,
});

test("weekMetrics zählt Logins nach Tageszeit und bildet Zuwächse aus zwei Tagesständen", () => {
  const activity: ActivityWeek = {
    week: "2026-W46",
    // Mo 1 Uhr, Mo 4 Uhr, Mo 5 Uhr, Di 7 Uhr, Di 20 Uhr, So 0 Uhr
    characters: { "1": [1, 4, 5, 24 + 7, 24 + 20, 6 * 24], "2": [20] },
  };
  const before = snap("2026-11-08", { "1": { level: 20, deaths: 3, recipes: 10, dungeons: 1 }, "2": { level: 30 } });
  const end = snap("2026-11-15", { "1": { level: 24, deaths: 9, recipes: 12, dungeons: 1 }, "2": { level: 29, deaths: 2 } });
  const m = weekMetrics({
    activity, before, end,
    members: [member({ id: 1 }), member({ id: 2 }), member({ id: 3 }), member({ id: 4, former: true })],
  });
  expect(m.get(1)).toEqual({
    logins: 6, nightLogins: 2, earlyLogins: 2, activeDays: 3, levels: 4, deaths: 6, recipes: 2, dungeons: 0,
    achievements: null, reputation: null, itemLevel: null, awayDays: 0,
  });
  // Feld fehlt in einem Stand: null. Rückgang (kann bei Datenfehlern vorkommen): 0.
  expect(m.get(2)).toMatchObject({ logins: 1, levels: 0, deaths: null, recipes: null });
  expect(m.get(3)).toEqual(metric({}));
  expect(m.has(4)).toBe(false);
});

test("Erfolgszuwachs: Wechsel zwischen Twink und Hauptcharakter ist kein Zuwachs, gleicher Status schon", () => {
  const before = snap("2026-11-08", {
    "1": { achievements: 2, achievementsTwink: true }, "2": { achievements: 5 }, "3": { achievements: 2, achievementsTwink: true }, "4": { achievements: 4 },
  });
  const end = snap("2026-11-15", {
    "1": { achievements: 9 }, "2": { achievements: 3, achievementsTwink: true }, "3": { achievements: 3, achievementsTwink: true }, "4": { achievements: 6 },
  });
  const m = weekMetrics({ activity: null, before, end, members: [1, 2, 3, 4].map((id) => member({ id })) });
  expect([1, 2, 3, 4].map((id) => m.get(id)?.achievements)).toEqual([null, null, 1, 2]);
});

test("awardTitles: höchster Wert gewinnt, mindestens 1, Gleichstand wird geteilt", () => {
  const members = [member({ id: 1, name: "Zora" }), member({ id: 2, name: "Anton" }), member({ id: 3, name: "Bert" })];
  const metrics = new Map<number, WeekMetrics>([
    [1, metric({ nightLogins: 3, activeDays: 5, logins: 9, levels: 2, deaths: 0 })],
    [2, metric({ nightLogins: 3, activeDays: 5, logins: 12, levels: 2, deaths: 0 })],
    [3, metric({ nightLogins: 1, activeDays: 2, logins: 2, levels: 7, recipes: 4 })],
  ]);
  const awards = awardTitles(metrics, members, [], { week: "2026-11-21", previous: [] });
  // Gleichstand: beide haben den Titel; auch beim Stammgast zählen die Logins nicht mehr
  expect(awards.map((a) => [a.titleId, [...titleHolders(a)].sort(), a.value])).toEqual([
    ["nachteule", [1, 2], 3],
    ["stammgast", [1, 2], 5],
    ["dauerlaeufer", [3], 7],
    ["schaffe-schaffe", [3], 4],
  ]);
  for (const a of awards) expect(a.characterId).toBe(titleHolders(a)[0]);
  // Ein Gewinner: Datensatz wie bisher, ohne Liste
  expect(awards.find((a) => a.titleId === "dauerlaeufer")).toEqual({ titleId: "dauerlaeufer", characterId: 3, value: 7 });
});

test("Titelträger bei Gleichstand: wer den Titel noch nie hatte, vor dem, der ihn vor drei Wochen hatte", () => {
  const members = [member({ id: 1, name: "Anna" }), member({ id: 2, name: "Bodo" }), member({ id: 3, name: "Cleo" })];
  const metrics = new Map<number, WeekMetrics>(members.map((m) => [m.id, metric({ nightLogins: 4 })]));
  const leer = { titles: [] };
  const nacht = (characterId: number, characterIds?: number[]): Pick<WeeklyRecord, "titles"> => ({
    titles: [{ titleId: "nachteule", characterId, ...(characterIds ? { characterIds } : {}), value: 4 }],
  });
  // Jüngste Woche zuerst: Cleo letzte Woche (geteilt, aber nicht auf der Karte), Anna vor drei Wochen, Bodo nie
  const previous = [nacht(9, [9, 3]), leer, nacht(1)];
  const history = { week: "2026-11-21", previous };
  const award = (h: typeof history) => awardTitles(metrics, members, [], h).find((a) => a.titleId === "nachteule")!;
  expect(award(history).characterIds).toEqual([2, 1, 3]);
  expect(award(history).characterId).toBe(2);
  // Hatten alle ihn schon: wer am längsten nicht dran war
  const alle = { week: "2026-11-21", previous: [nacht(3), nacht(2), leer, nacht(1)] };
  expect(award(alle).characterIds).toEqual([1, 2, 3]);
});

test("alte Wochen mit nur characterId zählen als ein Inhaber, nur der damalige Kartenname", () => {
  const members = [member({ id: 1, name: "Anna" }), member({ id: 2, name: "Bodo" })];
  const metrics = new Map<number, WeekMetrics>(members.map((m) => [m.id, metric({ deaths: 5 })]));
  // Damals gewann Anna allein (altes Format), Bodo stand nicht auf der Karte: Bodo hat den Titel nie gehabt
  const alt: Pick<WeeklyRecord, "titles"> = { titles: [{ titleId: "pechvogel", characterId: 1, value: 9 }] };
  const a = awardTitles(metrics, members, [], { week: "2026-11-28", previous: [alt] }).find((x) => x.titleId === "pechvogel")!;
  expect(a.characterId).toBe(2);
  expect(titleHolders(alt.titles[0])).toEqual([1]);
});

test("fester Zufall: gleiche Eingabe gibt gleiches Ergebnis, Reihenfolge der Eingabe egal, nie das Alphabet", () => {
  const members = Array.from({ length: 13 }, (_, i) => member({ id: 100 + i, name: String.fromCharCode(65 + i) }));
  const metrics = new Map<number, WeekMetrics>(members.map((m) => [m.id, metric({ activeDays: 7, logins: m.id })]));
  const history = { week: "2026-11-21", previous: [] };
  const holders = (ms: typeof members, mx: typeof metrics) =>
    awardTitles(mx, ms, [], history).find((a) => a.titleId === "stammgast")!.characterIds;
  const first = holders(members, metrics);
  expect(first).toHaveLength(13);
  expect(holders(members, metrics)).toEqual(first);
  const reversed = new Map([...metrics].reverse());
  expect(holders([...members].reverse(), reversed)).toEqual(first);
  const shuffled = [...members].sort((a, b) => tieHash(String(a.id)) - tieHash(String(b.id)));
  expect(holders(shuffled, metrics)).toEqual(first);
  // Weder alphabetisch noch nach Spielzeit (Logins), und eine andere Woche gibt eine andere Reihenfolge
  expect(first).not.toEqual(members.map((m) => m.id));
  expect(first).not.toEqual([...members].reverse().map((m) => m.id));
  const other = awardTitles(metrics, members, [], { week: "2026-11-28", previous: [] }).find((a) => a.titleId === "stammgast")!;
  expect(other.characterIds).not.toEqual(first);
  // orderHolders hängt nur an den IDs, nicht an der Reihenfolge
  expect(orderHolders([3, 1, 2], "nachteule", history)).toEqual(orderHolders([2, 3, 1], "nachteule", history));
});

test("awardTitles überspringt Abgemeldete und Ehemalige", () => {
  const members = [
    member({ id: 1, name: "Erster", slug: "erster-da" }),
    member({ id: 2, name: "Zweiter" }),
    member({ id: 3, name: "Weg", former: true }),
  ];
  const metrics = new Map<number, WeekMetrics>([
    [1, metric({ deaths: 9 })],
    [2, metric({ deaths: 4 })],
    [3, metric({ deaths: 50 })],
  ]);
  expect(awardTitles(metrics, members, [])).toEqual([{ titleId: "pechvogel", characterId: 1, value: 9 }]);
  for (const entry of ["Erster-Da", "erster", 1, "1"]) {
    expect(awardTitles(metrics, members, [entry])).toEqual([{ titleId: "pechvogel", characterId: 2, value: 4 }]);
  }
  expect(isOptedOut(members[0], ["", "anderer"])).toBe(false);
});

test("Titel: eindeutige Kennungen, Texte ohne Gedankenstrich, Einzahl und Mehrzahl", () => {
  expect(new Set(TITLES.map((t) => t.id)).size).toBe(TITLES.length);
  for (const t of TITLES) {
    for (const f of [t.name, t.description, t.valueText(1), t.valueText(5)]) {
      for (const text of Object.values(f)) expect(text).not.toMatch(/[—–]/);
    }
  }
  const text = (id: string, n: number) => TITLES.find((t) => t.id === id)!.valueText(n).de;
  expect(text("pechvogel", 1)).toBe("1 Tod");
  expect(text("pechvogel", 7)).toBe("7 Tode");
  expect(text("stammgast", 6)).toBe("an 6 Tagen angemeldet");
  expect(text("schaffe-schaffe", 1)).toBe("1 neues Rezept");
  // Ranglisten zeigen auch Werte unter dem Mindestwert, deshalb stimmt die Einzahl überall
  expect(text("kellerkind", 1)).toBe("1 Dungeon betreten");
  expect(text("kellerkind", 5)).toBe("5 Dungeons betreten");
  expect(text("verlorener-sohn", 1)).toBe("nach 1 Tag Pause zurück");
  expect(text("verlorener-sohn", 30)).toBe("nach 30 Tagen Pause zurück");
  expect(text("tausendsassa", 1)).toBe("in 1 Titel unter den ersten fünf");
  expect(text("tausendsassa", 3)).toBe("in 3 Titeln unter den ersten fünf");
  // Hochdeutsch ohne Dialekt, Englisch für alle, Schwäbisch behält die alten Namen, Bayrisch hat eigene
  const name = (id: string) => TITLES.find((t) => t.id === id)!.name;
  expect(name("schaffe-schaffe")).toEqual({ de: "Arbeitstier", en: "Workhorse", schwaebisch: "Schaffe, schaffe", bayrisch: "Hackler" });
  expect(name("kaepsele")).toEqual({ de: "Schlaukopf", en: "Overachiever", schwaebisch: "Käpsele", bayrisch: "Gscheithaferl" });
  // Jeder Titel hat Deutsch und Englisch, Name, Regel und Wert
  for (const t of TITLES) {
    for (const f of [t.name, t.description, t.valueText(1), t.valueText(5)]) {
      expect(f.de).toBeTruthy();
      expect(f.en).toBeTruthy();
      expect(f.en).not.toMatch(/Bärenklaue/);
    }
  }
  const en = (id: string, n: number) => TITLES.find((t) => t.id === id)!.valueText(n).en;
  expect(en("pechvogel", 1)).toBe("1 death");
  expect(en("pechvogel", 7)).toBe("7 deaths");
  expect(en("dauerlaeufer", 1)).toBe("1 level");
  expect(en("tausendsassa", 3)).toBe("top five in 3 titles");
  expect(TITLES.find((t) => t.id === "stammgast")!.valueText(6).bayrisch).toBe("an 6 Dog eigloggt");
});

test("neue Titel: Kellerkind, Käpsele, Schleimer, Verlorener Sohn mit Mindestwerten", () => {
  const members = [member({ id: 1, name: "Anna" }), member({ id: 2, name: "Bodo" }), member({ id: 3, name: "Cleo" })];
  const metrics = new Map<number, WeekMetrics>([
    [1, metric({ dungeons: 5, achievements: 2, reputation: 3, awayDays: 13 })],
    [2, metric({ dungeons: 4, achievements: 6, reputation: 1, awayDays: 30 })],
    [3, metric({ dungeons: null, achievements: null, reputation: null, awayDays: 0 })],
  ]);
  const ids = (awards: { titleId: string; characterId: number; value: number }[]) => awards.map((a) => [a.titleId, a.characterId, a.value]);
  expect(ids(awardTitles(metrics, members, []))).toEqual([
    ["kellerkind", 1, 5],
    ["kaepsele", 2, 6],
    ["schleimer", 1, 3],
    ["verlorener-sohn", 2, 30],
    ["tausendsassa", 2, 3], // Bodo liegt in Kellerkind, Käpsele und Verlorener Sohn vorn
  ]);
  // Ohne Vorwoche (null) und unter 14 Tagen Pause keine Vergabe
  const ohne = new Map<number, WeekMetrics>([[1, metric({ awayDays: 13 })]]);
  expect(awardTitles(ohne, members, [])).toEqual([]);
});

test("Schleimer und Verlorener Sohn beachten die Abmeldeliste", () => {
  const members = [member({ id: 1, name: "Anna" }), member({ id: 2, name: "Bodo" })];
  const metrics = new Map<number, WeekMetrics>([
    [1, metric({ reputation: 9, awayDays: 40 })],
    [2, metric({ reputation: 2, awayDays: 15 })],
  ]);
  expect(awardTitles(metrics, members, ["anna"]).map((a) => [a.titleId, a.characterId])).toEqual([
    ["schleimer", 2],
    ["verlorener-sohn", 2],
  ]);
});

test("Tausendsassa: meiste Platzierungen unter den ersten fünf anderer Titel, mindestens drei", () => {
  const members = Array.from({ length: 8 }, (_, i) => member({ id: i + 1, name: `M${i + 1}` }));
  // M1 in Kellerkind, Käpsele und Schleimer unter den ersten fünf, aber nirgends vorn; M8 überall vorn, aber nur zweimal
  const metrics = new Map<number, WeekMetrics>(
    members.map((m) => [
      m.id,
      metric({
        dungeons: m.id === 1 ? 3 : m.id === 8 ? 50 : m.id <= 4 ? 10 + m.id : null,
        achievements: m.id === 1 ? 3 : m.id <= 4 ? 10 + m.id : null,
        reputation: m.id === 1 ? 2 : m.id === 8 ? 50 : null,
      }),
    ]),
  );
  const awards = awardTitles(metrics, members, []);
  expect(awards.find((a) => a.titleId === "tausendsassa")).toEqual({ titleId: "tausendsassa", characterId: 1, value: 3 });
  expect(awards.filter((a) => a.titleId === "tausendsassa")).toHaveLength(1);

  const wenig = new Map<number, WeekMetrics>([[1, metric({ dungeons: 3, achievements: 3 })]]);
  expect(awardTitles(wenig, members, []).some((a) => a.titleId === "tausendsassa")).toBe(false);
});

test("Frisch eingekleidet: größter Zuwachs der Gegenstandsstufe, ohne Vergleichswert keine Teilnahme", () => {
  const members = [member({ id: 1, name: "Anna" }), member({ id: 2, name: "Bodo" }), member({ id: 3, name: "Cleo" })];
  const before = snap("2026-11-08", { "1": { equippedItemLevel: 20 }, "2": { equippedItemLevel: 30 }, "3": { equippedItemLevel: null } });
  const end = snap("2026-11-15", { "1": { equippedItemLevel: 27 }, "2": { equippedItemLevel: 31 }, "3": { equippedItemLevel: 60 } });
  const m = weekMetrics({ activity: null, before, end, members });
  expect([m.get(1)?.itemLevel, m.get(2)?.itemLevel, m.get(3)?.itemLevel]).toEqual([7, 1, null]);
  const award = (opt: (string | number)[]) => awardTitles(m, members, opt).find((a) => a.titleId === "frisch-eingekleidet");
  expect(award([])).toEqual({ titleId: "frisch-eingekleidet", characterId: 1, value: 7 });
  expect(award(["anna"])).toEqual({ titleId: "frisch-eingekleidet", characterId: 2, value: 1 });
  expect(award(["anna", "bodo"])).toBeUndefined();
  const def = TITLES.find((t) => t.id === "frisch-eingekleidet")!;
  expect([def.name.de, def.description.de, def.valueText(1).de, def.valueText(7).de]).toEqual([
    "Frisch eingekleidet", "Der größte Sprung bei der Gegenstandsstufe.", "+1 Gegenstandsstufe", "+7 Gegenstandsstufen",
  ]);
  expect(TITLES).toHaveLength(12);
});

test("rankTitles: ganze Rangliste je Titel, auch unter dem Mindestwert, ohne Abgemeldete und Ehemalige", () => {
  const members = [
    member({ id: 1, name: "Zora" }),
    member({ id: 2, name: "Anton" }),
    member({ id: 3, name: "Bert" }),
    member({ id: 4, name: "Weg", former: true }),
    member({ id: 5, name: "Still" }),
  ];
  const metrics = new Map<number, WeekMetrics>([
    [1, metric({ activeDays: 5, logins: 9, deaths: 2 })],
    [2, metric({ activeDays: 5, logins: 12, deaths: 6 })],
    [3, metric({ activeDays: 2, logins: 2, deaths: 0 })],
    [4, metric({ activeDays: 7, deaths: 50 })],
    [5, metric({ activeDays: 6, deaths: 9 })],
  ]);
  const { awards, rankings } = rankTitles(metrics, members, ["Still"]);
  expect(awards).toEqual(awardTitles(metrics, members, ["Still"]));
  // Gleichstand bei Tagen: Logins zählen nicht, Titelträger zuerst; wer 0 hat, fehlt
  const stamm = awards.find((a) => a.titleId === "stammgast")!;
  expect(stamm.characterIds).toHaveLength(2);
  expect(rankings.stammgast).toEqual([[stamm.characterIds![0], 5], [stamm.characterIds![1], 5], [3, 2]]);
  // Pechvogel: Zora mit 2 Toden liegt unter dem Mindestwert 3, steht aber in der Liste
  expect(rankings.pechvogel).toEqual([[2, 6], [1, 2]]);
  expect(awards.find((a) => a.titleId === "pechvogel")).toEqual({ titleId: "pechvogel", characterId: 2, value: 6 });
  // Titel ohne Werte haben eine leere Liste, der Tausendsassa zählt Plätze unter den ersten fünf
  expect(rankings.nachteule).toEqual([]);
  expect(rankings.tausendsassa).toEqual([[2, 2], [1, 1]]);
  expect(Object.keys(rankings).sort()).toEqual(TITLES.map((t) => t.id).sort());
});

test("Tausendsassa: geteilte Plätze zählen für alle, auch beim Gleichstand auf Platz fünf", () => {
  // 13 Mitglieder mit je 3 Toden und 3 Dungeons, einer mit 3 Erfolgen: alle teilen Platz 1 in zwei Titeln
  const members = Array.from({ length: 13 }, (_, i) => member({ id: i + 1, name: `M${i + 1}` }));
  const metrics = new Map<number, WeekMetrics>(
    members.map((m) => [m.id, metric({ deaths: 3, dungeons: 3, achievements: m.id === 13 ? 3 : null })]),
  );
  const { awards, rankings } = rankTitles(metrics, members, [], { week: "2026-11-21", previous: [] });
  expect(titleHolders(awards.find((a) => a.titleId === "pechvogel")!)).toHaveLength(13);
  expect(rankings.tausendsassa.map(([, v]) => v).sort()).toEqual([...Array(12).fill(2), 3]);
  expect(awards.find((a) => a.titleId === "tausendsassa")).toEqual({ titleId: "tausendsassa", characterId: 13, value: 3 });

  // Platz fünf geteilt: 4 vorn, dahinter drei gleichauf, alle sieben zählen
  const seven = members.slice(0, 7);
  const m2 = new Map<number, WeekMetrics>(
    seven.map((m) => [m.id, metric({ deaths: m.id <= 4 ? 10 + m.id : 5, dungeons: m.id <= 4 ? 10 + m.id : 5, achievements: m.id <= 4 ? 10 + m.id : 5 })]),
  );
  const sassa = rankTitles(m2, seven, [], { week: "2026-11-21", previous: [] }).awards.find((a) => a.titleId === "tausendsassa")!;
  expect([...titleHolders(sassa)].sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
  expect(sassa.value).toBe(3);
});
