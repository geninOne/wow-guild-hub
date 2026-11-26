import { describe, expect, test, vi } from "vitest";
import { buildZeitungView } from "../../src/api/zeitung-view";
import type { GuildRecord, WeekMetrics, WeeklyRecord, WochenSummen } from "../../src/model";
import { createMemoryStore } from "../../src/store";
import { ausgabeExtras } from "../../src/weekly/ausgabe-extras";
import { gleichLang } from "../../src/weekly/bausteine";
import { REKORD_KOPF, REKORD_TEXT, WETTER, WETTER_AUSKLANG, WETTER_EINSTIEG } from "../../src/weekly/bausteine-woche";
import { sectionOf, type ZeitungFact } from "../../src/weekly/zeitung-facts";
import { bausteinGenerator } from "../../src/weekly/zeitung-text";
import { createClaudeGenerator, factsForModel, systemPrompt, validateWetter, type MessagesClient } from "../../src/weekly/claude-text";
import { findeRekorde, rueckblick } from "../../src/weekly/rekorde";
import { wetterLage, type WetterLage } from "../../src/weekly/wetter";
import { summen, wochenZahlen } from "../../src/weekly/zahlen";
import { SPRACHEN } from "../../src/sprache";
import { member } from "../helpers/members";

const guild: GuildRecord = {
  fetchedAt: "2026-11-20T08:00:00.000Z", id: 1, name: "Bärenklaue", faction: "HORDE", memberCount: 4, rulesetName: "Normal",
  guilds: [
    { slug: "baerenklaue", id: 1, name: "Bärenklaue", faction: "HORDE", memberCount: 3, rulesetName: "Normal", main: true },
    { slug: "goldene-baerenklaue", id: 2, name: "Goldene Bärenklaue", faction: "ALLIANCE", memberCount: 2, rulesetName: "Normal", main: false },
  ],
  members: [
    member({ id: 1, name: "Anna", guildSlug: "baerenklaue" }),
    member({ id: 2, name: "Bodo", guildSlug: "baerenklaue" }),
    member({ id: 3, name: "Cleo", guildSlug: "goldene-baerenklaue" }),
    member({ id: 4, name: "Dora", guildSlug: "goldene-baerenklaue" }),
    member({ id: 5, name: "Emil", guildSlug: "baerenklaue", former: true }),
  ],
};

function m(over: Partial<WeekMetrics> = {}): WeekMetrics {
  return {
    logins: 0, nightLogins: 0, earlyLogins: 0, activeDays: 0, levels: null, deaths: null, recipes: null, dungeons: null,
    achievements: null, itemLevel: null, reputation: null, awayDays: 0, ...over,
  };
}

const metrics = new Map<number, WeekMetrics>([
  [1, m({ logins: 10, levels: 5, deaths: 2 })],
  [2, m({ logins: 4, levels: 1, deaths: 0, recipes: 3 })],
  [3, m({ logins: 6, levels: 2, deaths: 7 })],
  [4, m({ logins: 0 })],
  [5, m({ logins: 99, levels: 99, deaths: 99 })],
]);

const leer = (): WochenSummen => ({ anmeldungen: null, level: null, tode: null, dungeons: null, rezepte: null, erfolge: null, ruf: null, gegenstandsstufe: null });

describe("Woche in Zahlen", () => {
  test("Summen je Gilde und gesamt, ohne Ehemalige und Abgemeldete, null ohne Werte", () => {
    const z = wochenZahlen(metrics, guild, new Set([2]));
    expect(z.gesamt).toMatchObject({ anmeldungen: 16, level: 7, tode: 9, rezepte: null, ruf: null });
    expect(z.gilden.baerenklaue).toMatchObject({ anmeldungen: 10, level: 5, tode: 2 });
    expect(z.gilden["goldene-baerenklaue"]).toMatchObject({ anmeldungen: 6, level: 2, tode: 7 });
    // Bodo ist abgemeldet und taucht auch bei den Spitzenwerten nicht auf.
    expect(z.spitze).toEqual({ anmeldungen: [1, 10], level: [1, 5], tode: [3, 7] });
  });

  test("Summe ohne jeden Wert ist null, mit Wert 0 ist sie 0", () => {
    expect(summen(new Map([[1, m()]]), [guild.members[0]]).level).toBeNull();
    expect(summen(new Map([[1, m({ levels: 0 })]]), [guild.members[0]]).level).toBe(0);
  });

  test("Vorwoche aus der gespeicherten Ausgabe, ältere Wochen ohne Zahlen werden nachgerechnet", async () => {
    const store = createMemoryStore();
    const alt = (week: string, from: string, to: string, zahlen?: WeeklyRecord["zahlen"]) =>
      ({ week, from, to, generatedAt: "", titles: [], zeitung: { lead: { kind: "ruhig", headline: `Kopf ${week}`, text: "", characterIds: [] }, articles: [], motto: "" }, ...(zahlen ? { zahlen } : {}) }) as WeeklyRecord;
    const vorwoche = wochenZahlen(new Map([[1, m({ logins: 3, levels: 1 })]]), guild);
    await store.set("weekly/index", { weeks: ["2026-W46", "2026-11-14"] });
    await store.set("weekly/2026-W46", alt("2026-W46", "2026-11-02", "2026-11-08"));
    await store.set("weekly/2026-11-14", alt("2026-11-14", "2026-11-09", "2026-11-14", vorwoche));
    const kennzahlen = vi.fn(async () => new Map([[1, m({ logins: 50 })]]));
    const extras = await ausgabeExtras({ store, guild, from: "2026-11-15", to: "2026-11-21", metrics, excluded: new Set(), previous: [], kennzahlen });
    expect(kennzahlen).toHaveBeenCalledWith("2026-11-02", "2026-11-08");
    expect(extras.zahlen.vorwoche?.gesamt).toMatchObject({ anmeldungen: 3, level: 1 });
    expect(extras.zahlen.gesamt).toMatchObject({ anmeldungen: 20, level: 8 });
    // Zwei frühere Wochen reichen noch nicht für Rekorde.
    expect(extras.zusatz).toEqual([]);
    expect(extras.rueckblick).toBeNull();
  });

  test("Ansicht: Zeilen mit Vorwoche je Gilde, alte Ausgaben ohne die neuen Felder bleiben darstellbar", () => {
    const record = {
      week: "2026-11-21", from: "2026-11-15", to: "2026-11-21", generatedAt: "", titles: [],
      zeitung: { lead: { kind: "ruhig", headline: "Ruhig", text: "Nix los.", characterIds: [] }, articles: [], motto: "Spruch" },
    } as WeeklyRecord;
    const alt = buildZeitungView(guild, record, ["2026-11-21"]);
    expect(alt).toMatchObject({ zahlen: null, wetter: null, rueckblick: null });

    const z = wochenZahlen(metrics, guild);
    const neu = buildZeitungView(
      guild,
      {
        ...record,
        zahlen: { ...z, vorwoche: { gesamt: { ...leer(), anmeldungen: 30, level: 8 }, gilden: { baerenklaue: { ...leer(), tode: 2 } } } },
        zeitung: {
          ...record.zeitung,
          wetter: "Sonne.",
          wetterDialekte: { schwaebisch: "Sonna." },
          rueckblick: { week: "2026-10-24", from: "2026-10-18", to: "2026-10-24", headline: "Damals", characterIds: [1] },
        },
      },
      ["2026-10-24", "2026-11-21"],
    );
    expect(neu.zahlen?.gesamt.slice(0, 3)).toEqual([
      { art: "anmeldungen", wert: 20, vorwoche: 30 },
      { art: "level", wert: 8, vorwoche: 8 },
      { art: "tode", wert: 9, vorwoche: null },
    ]);
    expect(neu.zahlen?.gilden.baerenklaue.find((r) => r.art === "tode")).toEqual({ art: "tode", wert: 2, vorwoche: 2 });
    expect(neu.zahlen?.guilds.map((g) => g.slug)).toEqual(["baerenklaue", "goldene-baerenklaue"]);
    expect(neu.wetter).toEqual({ de: "Sonne.", en: "Sonne.", schwaebisch: "Sonna." });
    expect(neu.rueckblick).toMatchObject({ week: "2026-10-24", issue: 1, headline: { de: "Damals" }, characters: [{ id: 1, name: "Anna" }] });
  });
});

describe("Rekorde und Rückblick", () => {
  const z = (tode: number, top?: [number, number]) => ({ gesamt: { ...leer(), tode }, spitze: top ? { tode: top } : {} });

  test("erst ab drei früheren Wochen, nur echt größer und ab Mindestwert", () => {
    expect(findeRekorde(z(30, [1, 9]), [z(10), z(12)])).toEqual([]);
    expect(findeRekorde(z(30, [1, 9]), [z(10, [2, 4]), z(12, [3, 9]), z(29)])).toEqual([{ art: "tode", characterId: null, value: 30, previous: 29 }]);
    expect(findeRekorde(z(29), [z(10), z(12), z(29)])).toEqual([]);
    expect(findeRekorde(z(5), [z(1), z(2), z(3)])).toEqual([]);
  });

  test("Einzelrekord mit Charakter, der deutlichste zuerst", () => {
    const r = findeRekorde(z(31, [2, 12]), [z(30, [1, 4]), z(20, [3, 5]), z(10)]);
    expect(r).toEqual([
      { art: "tode", characterId: 2, value: 12, previous: 5 },
      { art: "tode", characterId: null, value: 31, previous: 30 },
    ]);
  });

  test("Rückblick nimmt die Ausgabe mit letztem Tag genau 28 Tage früher, sonst keinen", () => {
    const rec = (week: string, to: string) =>
      ({ week, from: "", to, zeitung: { lead: { kind: "sprung", headline: `Kopf ${week}`, text: "", characterIds: [3], dialekte: { bayrisch: { headline: "Kopf bairisch", text: "" } } } } }) as unknown as WeeklyRecord;
    const r = rueckblick("2026-12-19", [rec("2026-12-12", "2026-12-12"), rec("2026-W47", "2026-11-21")]);
    expect(r).toEqual({ week: "2026-W47", from: "", to: "2026-11-21", headline: "Kopf 2026-W47", dialekte: { bayrisch: "Kopf bairisch" }, characterIds: [3] });
    expect(rueckblick("2026-12-26", [rec("2026-W47", "2026-11-21")])).toBeNull();
  });
});

describe("Wetterbericht", () => {
  const summenMit = (s: Partial<WochenSummen>) => ({ ...leer(), anmeldungen: 40, ...s });
  const aktiv = new Map(guild.members.map((x) => [x.id, m({ logins: 10, nightLogins: 0 })]));

  test("viele Tode bringen ein Sturmtief über der Gilde mit den meisten Toden", () => {
    const lage = wetterLage({ summen: summenMit({ tode: 20, level: 2 }), metrics: aktiv, members: guild.members, guild, todeJeGilde: { baerenklaue: 4, "goldene-baerenklaue": 16 } });
    expect(lage.elemente[0]).toMatchObject({ art: "sturm", ueber: "Goldene Bärenklaue" });
  });

  test("Nachteulen bringen sternklare Nächte, ohne Auffälliges wechselhaft, ohne Leute Flaute", () => {
    const nacht = new Map(guild.members.map((x) => [x.id, m({ logins: 10, nightLogins: 2 })]));
    expect(wetterLage({ summen: summenMit({}), metrics: nacht, members: guild.members, guild }).elemente.map((e) => e.art)).toEqual(["sternklar"]);
    expect(wetterLage({ summen: summenMit({}), metrics: aktiv, members: guild.members, guild }).elemente.map((e) => e.art)).toEqual(["wechselhaft"]);
    expect(wetterLage({ summen: summenMit({ anmeldungen: 3 }), metrics: aktiv, members: guild.members, guild }).elemente.map((e) => e.art)).toEqual(["flaute"]);
  });

  test("mit Geschichte zählt, was über dem eigenen Schnitt liegt, auch bei großen Zahlen", () => {
    const viele = new Map(guild.members.map((x) => [x.id, m({ logins: 70, nightLogins: 1 })]));
    const frueher = [summenMit({ anmeldungen: 250, tode: 3000, level: 1500, dungeons: 900, rezepte: 6000 }), summenMit({ anmeldungen: 260, tode: 3200, level: 1700, dungeons: 950, rezepte: 6200 })];
    const jetzt = summenMit({ anmeldungen: 280, tode: 3100, level: 2400, dungeons: 930, rezepte: 6100 });
    // Ohne Geschichte wäre fast alles Wetter; mit Geschichte bleibt nur das Leveln deutlich über dem Schnitt.
    expect(wetterLage({ summen: jetzt, metrics: viele, members: guild.members, guild }).elemente.map((e) => e.art)).toEqual(["schmiedehitze", "sturm", "sonne"]);
    expect(wetterLage({ summen: jetzt, metrics: viele, members: guild.members, guild, frueher }).elemente.map((e) => e.art)).toEqual(["sonne"]);
    // Die Anmeldungen brechen ein: Flaute.
    expect(wetterLage({ summen: { ...jetzt, anmeldungen: 100 }, metrics: viele, members: guild.members, guild, frueher }).elemente.map((e) => e.art)).toEqual(["flaute"]);
  });

  test("alle Wetter-Töpfe sind in allen Fassungen gleich lang", () => {
    for (const topf of [WETTER_EINSTIEG, WETTER_AUSKLANG, REKORD_KOPF, REKORD_TEXT, ...Object.values(WETTER)]) {
      expect(gleichLang(topf)).toBe(true);
    }
  });

  const lage: WetterLage = { elemente: [{ art: "sturm", staerke: 3, ueber: "Goldene Bärenklaue" }, { art: "sternklar", staerke: 2 }] };
  const ctx = { week: "2026-11-21", name: (id: number) => ["", "Anna", "Bodo"][id], allNames: ["Anna", "Bodo"], wetter: lage, sprachen: SPRACHEN };

  test("Satzbausteine schreiben den Wetterbericht in allen Sprachen, ohne Zahlen und ohne Gedankenstriche", async () => {
    const r = await bausteinGenerator([{ kind: "ruhig" }], ctx);
    expect(r.wetter).toContain("Goldene Bärenklaue");
    expect(r.wetterDialekte?.en).toContain("over the guild Goldene Bärenklaue");
    expect(r.wetterDialekte?.schwaebisch).toContain("Goldene Bärenklaue");
    expect(r.wetterDialekte?.bayrisch).toBeTruthy();
    for (const t of [r.wetter!, r.wetterDialekte!.en!, r.wetterDialekte!.schwaebisch!, r.wetterDialekte!.bayrisch!]) {
      expect(t).not.toMatch(/\d|—/);
      expect(() => validateWetter(t, ctx)).not.toThrow();
    }
    expect(r.bausteine?.some((b) => b.startsWith("wetter-sturm:"))).toBe(true);
    // Ohne Wetterlage bleibt alles wie bisher.
    expect((await bausteinGenerator([{ kind: "ruhig" }], { ...ctx, wetter: undefined })).wetter).toBeUndefined();
  });

  test("Prüfung: keine Zahlen, keine Namen, keine Wiederholung aus früheren Ausgaben", () => {
    expect(() => validateWetter("Sturm mit 5 Böen über Azeroth, Schirm mitnehmen.", ctx)).toThrow(/Zahlen/);
    expect(() => validateWetter("Sturm über Anna, Schirm mitnehmen und gut festhalten.", ctx)).toThrow(/Charaktere/);
    const alt = "Sturm über der Gilde, Schirm mitnehmen.";
    expect(() => validateWetter(`Neu hier. ${alt}`, { ...ctx, recent: [{ week: "x", bausteine: [], headlines: [], texts: [], motto: "", wetter: alt }] })).toThrow(/wiederholt/);
    expect(validateWetter("Sturm — und danach sternklar über Azeroth.", ctx)).toBe("Sturm, und danach sternklar über Azeroth.");
  });

  function client(wetter: (system: string) => unknown) {
    const create = vi.fn(async (params: { system: string; messages: { content: string }[] }) => ({
      model: "anthropic-router",
      stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify({ artikel: [{ nr: 0, schlagzeile: "Stille Woche", text: "In Azeroth war es ruhig." }], spruch: "Gut Ding will Weile haben.", wetter: wetter(params.system) }) }],
    }));
    return { client: { messages: { create } } as unknown as MessagesClient, create };
  }

  test("KI: Wetterbericht aus der Antwort, Prompt kennt die Wetterlage", async () => {
    const { client: c, create } = client(() => "Ein Sturmtief zieht über die Goldene Bärenklaue, nachts dann sternklar.");
    const r = await createClaudeGenerator({ client: c, log: () => {} })([{ kind: "ruhig" }], ctx);
    expect(r.generator).toBe("claude");
    expect(r.wetter).toBe("Ein Sturmtief zieht über die Goldene Bärenklaue, nachts dann sternklar.");
    const call = create.mock.calls[0][0];
    expect(call.system).toContain("Wetterbericht für Azeroth");
    expect(call.messages[0].content).toContain("Wetterlage für den Wetterbericht");
    expect(call.messages[0].content).toContain('"ueber": "Goldene Bärenklaue"');
    expect(systemPrompt("de")).not.toContain("Wetterbericht");
  });

  test("KI: misslungener Wetterbericht kostet nur das Wetter, die Satzbausteine springen ein", async () => {
    const log = vi.fn();
    const { client: c } = client((system) => (system.includes("Schwäbisch") ? "Sturm mit 7 Böen über Azeroth heute." : "Sternklar und stürmisch über Azeroth, Schirm mitnehmen."));
    const r = await createClaudeGenerator({ client: c, log })([{ kind: "ruhig" }], ctx);
    expect(r.generator).toBe("claude");
    expect(r.articles[0].headline).toBe("Stille Woche");
    expect(r.wetter).toBe("Sternklar und stürmisch über Azeroth, Schirm mitnehmen.");
    expect(r.wetterDialekte?.schwaebisch).not.toMatch(/\d/);
    expect(r.wetterDialekte?.schwaebisch).toContain("Goldene Bärenklaue");
    expect(r.fallback).toMatch(/wetter schwaebisch: Wetterbericht nennt Zahlen/);
    expect(log).toHaveBeenCalled();
  });
});

describe("Neue Meldungen in der Zeitung", () => {
  const facts: ZeitungFact[] = [
    { kind: "rekord", entries: [{ art: "tode", characterId: null, value: 31, previous: 30 }, { art: "level", characterId: 1, value: 12, previous: 9 }] },
  ];
  const names: Record<number, string> = { 1: "Anna", 2: "Bodo", 3: "Cleo" };
  const ctx = { week: "2026-11-21", name: (id: number) => names[id], allNames: Object.values(names), sprachen: SPRACHEN };

  test("Rubriken, Zahlen und Satzbausteine", async () => {
    expect(facts.map(sectionOf)).toEqual(["Rekorde"]);
    const r = await bausteinGenerator(facts, ctx);
    expect(r.articles.map((a) => a.characterIds)).toEqual([[1]]);
    expect(r.articles[0].text).toContain("31");
    expect(r.articles[0].text).toContain("Anna mit 12 Level (bisher 9)");
    for (const a of r.articles) {
      expect(a.dialekte?.schwaebisch?.text).toBeTruthy();
      expect(a.dialekte?.bayrisch?.text).toBeTruthy();
    }
    const en = (a: (typeof r.articles)[number]) => (a.dialekte as { en?: { text: string } }).en?.text;
    expect(en(r.articles[0])).toContain("Anna with 12 levels (previously 9)");
    const model = factsForModel(facts, ctx) as Record<string, unknown>[];
    expect(model[0]).toMatchObject({ art: "rekord", neue_rekorde: [{ wer: "die ganze Gilde", neuer_rekord: 31, alter_rekord: 30 }, { wer: "Anna" }] });
  });
});
