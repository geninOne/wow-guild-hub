import { beforeEach, describe, expect, test } from "vitest";
import karten from "../../config/statistik-karten.json";
import { handleApi } from "../../src/api/router";
import { buildStatCardMembers, buildStatCards, resolveStatsPeriod, STAT_LEADERS, statCards } from "../../src/api/stats-view";
import type { StatCardMembersView, StatsView } from "../../src/api/types";
import type { GuildRecord, MemberSummary } from "../../src/model";
import { statDefinition } from "../../src/stats/definitions";
import type { StatsStand } from "../../src/stats/stand";
import { createMemoryStore } from "../../src/store";
import { fassungIn, SPRACHEN, ueberall } from "../../src/sprache";

/** Konfigurationstext: String für alle Sprachen oder Objekt mit mindestens `de`, nur bekannte Sprachen. */
function expectKonfigText(text: unknown, wo: string) {
  if (typeof text === "string") return;
  expect(text, wo).toBeTypeOf("object");
  const obj = text as Record<string, unknown>;
  expect(obj.de, wo).toBeTypeOf("string");
  for (const [sprache, wert] of Object.entries(obj)) {
    expect(SPRACHEN as readonly string[], wo).toContain(sprache);
    expect(wert, wo).toBeTypeOf("string");
  }
}

/** Einheit: Paar für alle Sprachen oder Objekt mit Paaren je Sprache (mindestens `de`). */
function expectKonfigEinheit(einheit: unknown, wo: string) {
  if (Array.isArray(einheit)) {
    expect(einheit, wo).toHaveLength(2);
    return;
  }
  const obj = einheit as Record<string, unknown>;
  expect(obj.de, wo).toHaveLength(2);
  for (const [sprache, paar] of Object.entries(obj)) {
    expect(SPRACHEN as readonly string[], wo).toContain(sprache);
    expect(paar, wo).toHaveLength(2);
  }
}

function member(over: Partial<MemberSummary>): MemberSummary {
  return {
    id: 1, name: "Test", surname: null, slug: "test", rank: 0, level: 10, classId: 1, raceId: 1,
    hasProfile: true, former: false, firstSeenAt: "2026-11-01T00:00:00.000Z", leftAt: null,
    lastFetchedAt: "2026-11-06T10:00:00.000Z", equippedItemLevel: null, mainSpecName: null,
    professions: [], ...over,
  };
}

const guild: GuildRecord = {
  fetchedAt: "2026-11-21T10:00:00.000Z", id: 1, name: "Bärenklaue", faction: "HORDE", memberCount: 3,
  rulesetName: "Classic",
  members: [
    member({ id: 1, name: "Anna", slug: "anna", classId: 5, guildSlug: "bärenklaue" }),
    member({ id: 2, name: "Bodo", slug: "bodo", classId: 1, guildSlug: "goldene-bärenklaue" }),
    member({ id: 3, name: "Cleo", slug: "cleo", classId: 8, guildSlug: "bärenklaue" }),
  ],
  guilds: [
    { slug: "bärenklaue", id: 1, name: "Bärenklaue", faction: "HORDE", memberCount: 2, rulesetName: "Classic", main: true },
    { slug: "goldene-bärenklaue", id: 2, name: "Goldene Bärenklaue", faction: "ALLIANCE", memberCount: 1, rulesetName: "Classic", main: false },
  ],
};

const stand = (week: string, characters: StatsStand["characters"], extra: Partial<StatsStand> = {}): StatsStand => ({
  week, takenAt: `${week}T20:00:00.000Z`, characters, ...extra,
});

// 60 Tode insgesamt, 594 Tode durch Hogger (nicht mehr gezeigt), 114 Stürze, 1065 /winken, 346 Getränke (alles Zähler), 95 Quests pro Tag (Schnitt)
const fruehere = stand("2026-11-14", { "1": { "60": 3, "1065": 1 }, "2": { "60": 1 } });
const neuere = stand("2026-11-21", {
  "1": { "60": 5, "594": 1, "95": 4, "1065": 4, "346": 250 },
  "2": { "60": 1, "1065": 2, "114": 1 },
  "3": { "60": 2 },
  "99": { "60": 7 },
});

describe("statCards", () => {
  test("Konfiguration: nur bekannte Zähler und Stände, Texte nur für benutzte Statistiken, keine Gedankenstriche", () => {
    const ids = karten.karten.flatMap((k) => k.statistiken);
    for (const id of ids) expect(["zaehler", "stand"], `Statistik ${id}`).toContain(statDefinition(id)?.art);
    const used = new Set(ids.map(String));
    for (const karte of karten.karten as { slug: string; titel: unknown; spruch?: unknown }[]) {
      expectKonfigText(karte.titel, `Titel von ${karte.slug}`);
      if (karte.spruch !== undefined) expectKonfigText(karte.spruch, `Spruch von ${karte.slug}`);
    }
    for (const [id, text] of Object.entries(karten.texte as Record<string, Record<string, unknown>>)) {
      expect(used.has(id), `Text für ${id}`).toBe(true);
      for (const feld of ["kurz", "ehrung"]) if (feld in text) expectKonfigText(text[feld], `${feld} von ${id}`);
      if ("einheit" in text) expectKonfigEinheit(text.einheit, `Einheit von ${id}`);
      const umrechnung = text.umrechnung as { einheit: unknown; satz: unknown } | undefined;
      if (umrechnung) {
        expectKonfigEinheit(umrechnung.einheit, `Umrechnung von ${id}`);
        expectKonfigText(umrechnung.satz, `Umrechnungssatz von ${id}`);
      }
    }
    expect(JSON.stringify(karten)).not.toMatch(/[\u2013\u2014]/);
  });

  test("Gut ein Dutzend lustige Karten in verschiedenen Formen, Tode vorne, nix Trockenes", () => {
    const cards = statCards();
    expect(cards.length).toBeGreaterThanOrEqual(8);
    expect(cards.length).toBeLessThanOrEqual(16);
    expect(cards[0]).toMatchObject({ slug: "tode", form: "grabsteinfeld", span: 3 });
    expect(cards[0].ids[0]).toBe(60);
    expect(new Set(cards.map((c) => c.form)).size).toBeGreaterThanOrEqual(12);
    const all = cards.flatMap((c) => c.ids);
    for (const id of [1519, 1524, 932, 931, 107, 56, 594]) expect(all).not.toContain(id);
    for (const id of [1518, 112, 114, 1067, 1042, 319, 320, 108, 94, 64222, 1043, 1044, 346, 353, 349]) {
      expect(all).toContain(id);
    }
    expect(cards.every((c) => c.blurb !== null)).toBe(true);
  });

  test("Titel und Sprüche kommen in allen Sprachen, Englisch eigens übersetzt", () => {
    for (const card of statCards()) {
      for (const sprache of SPRACHEN) {
        expect(fassungIn(card.title, sprache), `${card.slug} ${sprache}`).toBeTypeOf("string");
        expect(fassungIn(card.blurb!, sprache), `${card.slug} ${sprache}`).toBeTypeOf("string");
      }
      expect(card.title.en, card.slug).not.toBe(card.title.de);
      expect(card.blurb!.en, card.slug).not.toBe(card.blurb!.de);
    }
  });

  test("Deutsch und Englisch ohne Gildennamen und schwäbische Anspielungen", () => {
    const texte: string[] = [];
    const sammeln = (wert: unknown, schluessel = "") => {
      if (typeof wert === "string") {
        if (schluessel !== "schwaebisch" && schluessel !== "bayrisch") texte.push(wert);
      } else if (Array.isArray(wert)) {
        for (const w of wert) sammeln(w, schluessel);
      } else if (wert && typeof wert === "object") {
        for (const [k, w] of Object.entries(wert)) sammeln(w, k === "schwaebisch" || k === "bayrisch" ? k : schluessel);
      }
    };
    sammeln(karten.karten);
    sammeln(karten.texte);
    for (const text of texte) expect(text).not.toMatch(/Bärenklaue|Ulm|Schwab|Schwäb|Vesper|Fläschle/);
  });
});

describe("resolveStatsPeriod", () => {
  const start = "2026-11-05"; // Bärenklaue-Woche bis Samstag 2026-11-07

  test("Woche braucht den Stand der Vorwoche", () => {
    expect(resolveStatsPeriod(["2026-11-14", "2026-11-21"], { kind: "week", week: "2026-11-21" }, start)).toEqual({
      before: "2026-11-14", after: "2026-11-21", status: "ok",
    });
    expect(resolveStatsPeriod(["2026-11-21"], { kind: "week", week: "2026-11-21" }, start)).toEqual({
      before: null, after: "2026-11-21", status: "zu-wenig",
    });
    // Lücke: Vorvorwoche taugt nicht
    expect(resolveStatsPeriod(["2026-11-07", "2026-11-21"], { kind: "week", week: "2026-11-21" }, start).status).toBe("zu-wenig");
  });

  test("Woche des Serverstarts zählt ab lauter Nullen", () => {
    expect(resolveStatsPeriod(["2026-11-07"], { kind: "week", week: "2026-11-07" }, start)).toEqual({
      before: null, after: "2026-11-07", status: "ok",
    });
  });

  test("Monat: im Startmonat ab Serverstart, danach ab der letzten Woche des Vormonats", () => {
    expect(resolveStatsPeriod(["2026-11-21"], { kind: "month", month: "2026-11" }, start)).toEqual({
      before: null, after: "2026-11-21", status: "ok",
    });
    expect(resolveStatsPeriod(["2026-11-21", "2026-12-05"], { kind: "month", month: "2026-12" }, start).status).toBe("zu-wenig");
    expect(resolveStatsPeriod(["2026-11-28", "2026-12-05", "2026-12-12"], { kind: "month", month: "2026-12" }, start)).toEqual({
      before: "2026-11-28", after: "2026-12-12", status: "ok",
    });
  });

  test("Gesamt geht sofort, ohne Stand gibt es nichts", () => {
    expect(resolveStatsPeriod(["2026-11-21"], { kind: "total" }, start)).toEqual({ before: null, after: "2026-11-21", status: "ok" });
    expect(resolveStatsPeriod([], { kind: "total" }, start).status).toBe("keine");
    expect(resolveStatsPeriod(["2026-11-21"], { kind: "week", week: "2026-11-28" }, start).status).toBe("zu-wenig");
  });
});

describe("buildStatCards", () => {
  const stat = (cards: ReturnType<typeof buildStatCards>, id: number) => cards.flatMap((c) => c.stats).find((s) => s.id === id)!;

  test("Zähler als Zuwachs mit Summe, Spitzenreitern und Werten je Gilde", () => {
    const cards = buildStatCards(guild, fruehere, neuere);
    const tode = stat(cards, 60);
    // Anna +2, Bodo +0; Cleo und der Unbekannte fehlen im früheren Stand und zählen nicht
    expect(tode).toMatchObject({ art: "zaehler", total: 2 });
    // Texte stehen als Fassungen mit Deutsch und Englisch; fehlende Dialekte fallen auf Deutsch zurück
    expect(tode.short).toEqual({ de: "Tode", en: "Deaths" });
    expect(tode.unit!.de).toEqual(["Tod", "Tode"]);
    expect(tode.unit!.en).toEqual(["death", "deaths"]);
    expect(tode.honor!.de).toBe("Goldener Grabstein");
    expect(tode.honor!.en).toBe("Golden Gravestone");
    for (const sprache of SPRACHEN) expect(fassungIn(tode.unit!, sprache)).toHaveLength(2);
    expect(tode.leaders.map((l) => [l.character.name, l.value])).toEqual([["Anna", 2]]);
    expect(tode.perGuild).toEqual({ "bärenklaue": 2, "goldene-bärenklaue": 0 });
    expect(stat(cards, 1065).perGuild).toEqual({ "bärenklaue": 3, "goldene-bärenklaue": 2 });
    expect(stat(cards, 113)).toMatchObject({ total: 0, leaders: [] });
    const umrechnung = stat(cards, 346).conversion!;
    expect(umrechnung.per).toBe(100);
    expect(umrechnung.unit.de).toEqual(["Fass", "Fässer"]);
    expect(umrechnung.unit.en).toEqual(["barrel", "barrels"]);
    for (const sprache of SPRACHEN) expect(fassungIn(umrechnung.text, sprache)).toBeTypeOf("string");
    // Wie viele Charaktere überhaupt einen Wert haben (für den Stall), Klassenfarbe für das EKG
    expect(stat(cards, 1065).holders).toBe(2);
    expect(stat(cards, 60).holders).toBe(1);
    expect(stat(cards, 60).sum).toBe(2);
    expect(stat(cards, 800)).toMatchObject({ classId: 2, short: ueberall("Paladin"), holders: 0 });
  });

  test("Neuzugänge: bei Woche und Monat außen vor, bei Gesamt ab Serverstart dabei", () => {
    const vorher = stand("2026-11-14", { "1": { "60": 10 } });
    // Cleo tritt mit 400 Toden aus ihrem bisherigen Leben bei und stirbt diese Woche noch einmal
    const nachher = stand("2026-11-21", { "1": { "60": 12 }, "3": { "60": 401 } });
    expect(stat(buildStatCards(guild, vorher, nachher), 60)).toMatchObject({ total: 2, holders: 1 });
    const gesamt = stat(buildStatCards(guild, null, nachher), 60);
    expect(gesamt.total).toBe(413);
    expect(gesamt.leaders.map((l) => l.character.name)).toEqual(["Cleo", "Anna"]);
  });

  test("Gildenfilter: Summe und Spitzenreiter nur der Gilde, Vergleich bleibt", () => {
    const horde = buildStatCards(guild, fruehere, neuere, "bärenklaue");
    expect(stat(horde, 60)).toMatchObject({ total: 2, perGuild: { "bärenklaue": 2, "goldene-bärenklaue": 0 } });
    expect(stat(horde, 60).leaders.map((l) => l.character.name)).toEqual(["Anna"]);
    const allianz = buildStatCards(guild, fruehere, neuere, "goldene-bärenklaue");
    expect(stat(allianz, 114)).toMatchObject({ total: 1 });
    expect(stat(allianz, 1065).leaders.map((l) => l.character.name)).toEqual(["Bodo"]);
    expect(stat(allianz, 60).leaders).toEqual([]);
  });

  test("Stand wie Haustiere: Höchstwert als total, Summe aller Charaktere als sum, Besitzer als holders", () => {
    const tiere = stand("2026-11-21", { "1": { "338": 3 }, "2": { "338": 2 }, "3": {} });
    expect(stat(buildStatCards(guild, null, tiere), 338)).toMatchObject({ art: "stand", total: 3, sum: 5, holders: 2 });
    expect(stat(buildStatCards(guild, null, tiere, "bärenklaue"), 338)).toMatchObject({ total: 3, sum: 3, holders: 1 });
  });

  test("Serverstart als Nullstand, höchstens fünf Spitzenreiter", () => {
    const many = stand("2026-11-21", Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((i) => [String(i), { "1518": i }])));
    const fische = stat(buildStatCards(guild, null, many), 1518);
    expect(fische.total).toBe(28);
    expect(fische.leaders).toHaveLength(STAT_LEADERS);
    expect(fische.leaders[0].value).toBe(7);
  });
});

describe("buildStatCardMembers", () => {
  const ids = (card: string) => statCards().find((c) => c.slug === card)!.ids;

  test("Je Statistik der Karte alle mit Wert über 0, höchster zuerst, Unbekannte bleiben drin", () => {
    const tode = buildStatCardMembers(null, neuere, "tode")!;
    expect(tode.slug).toBe("tode");
    expect(tode.stats.map((s) => s.id)).toEqual(ids("tode"));
    expect(tode.stats[0].entries).toEqual([[99, 7], [1, 5], [3, 2], [2, 1]]);
  });

  test("Woche zählt den Zuwachs wie die Karte, Neuzugänge fehlen", () => {
    const tode = buildStatCardMembers(fruehere, neuere, "tode")!;
    expect(tode.stats[0].entries).toEqual([[1, 2]]);
  });

  test("Stall: die erste Statistik nimmt auch die Fußgänger mit 0 auf", () => {
    const [reittiere] = ids("stall");
    const st = stand("2026-11-21", { "1": { [reittiere]: 2 }, "2": {}, "3": { [reittiere]: 1 } });
    expect(buildStatCardMembers(null, st, "stall")!.stats[0].entries).toEqual([[1, 2], [3, 1], [2, 0]]);
  });

  test("unbekannte Karte: null", () => {
    expect(buildStatCardMembers(null, neuere, "quatsch")).toBeNull();
  });
});

describe("/api/stats", () => {
  let store: ReturnType<typeof createMemoryStore>;
  const opts = { serverStart: "2026-11-05" };
  const get = async (path: string) => {
    const res = await handleApi(new Request(`http://x${path}`), store, () => new Date("2026-11-21T12:00:00Z"), opts);
    return { status: res.status, body: res.status === 200 ? ((await res.json()) as StatsView) : null };
  };

  beforeEach(async () => {
    store = createMemoryStore();
    await store.set("guild", guild);
    await store.set("stats/2026-11-21", neuere);
  });

  test("Gesamt ab Serverstart mit Karten und Gilden", async () => {
    const { status, body } = await get("/api/stats");
    expect(status).toBe(200);
    expect(body).toMatchObject({ kind: "gesamt", id: null, status: "ok", before: null, after: "2026-11-21", characters: 4, guild: null });
    expect(body!.weeks).toEqual(["2026-11-21"]);
    expect(body!.months).toEqual(["2026-11"]);
    expect(body!.guilds.map((g) => g.slug)).toEqual(["bärenklaue", "goldene-bärenklaue"]);
    expect(body!.cards[0]).toMatchObject({ slug: "tode", form: "grabsteinfeld" });
    expect(body!.cards[0].stats[0]).toMatchObject({ id: 60, total: 15 });
  });

  test("Gildenfilter über ?gilde=, unbekannte Gilde: 404", async () => {
    const { body } = await get(`/api/stats?gilde=${encodeURIComponent("bärenklaue")}`);
    expect(body).toMatchObject({ guild: "bärenklaue", characters: 2 });
    expect(body!.cards[0].stats[0]).toMatchObject({ id: 60, total: 7 });
    expect((await get("/api/stats?gilde=quatsch")).status).toBe(404);
  });

  test("Woche ohne Vorwoche: Hinweis statt Zahlen, mit Vorwoche Zuwachs", async () => {
    const ohne = await get("/api/stats/woche");
    expect(ohne.body).toMatchObject({ kind: "woche", id: "2026-11-21", status: "zu-wenig", cards: [] });
    await store.set("stats/2026-11-14", fruehere);
    const mit = await get("/api/stats/woche/2026-11-21");
    expect(mit.body).toMatchObject({ status: "ok", before: "2026-11-14" });
    expect(mit.body!.cards[0].stats[0].total).toBe(2);
    expect(mit.body!.weeks).toEqual(["2026-11-21", "2026-11-14"]);
  });

  test("Monat des Serverstarts geht sofort", async () => {
    expect((await get("/api/stats/monat")).body).toMatchObject({ kind: "monat", id: "2026-11", status: "ok" });
  });

  test("ohne Stände: Status keine; falsche oder unbekannte Zeiträume: 404", async () => {
    const leer = createMemoryStore();
    await leer.set("guild", guild);
    const res = await handleApi(new Request("http://x/api/stats/woche"), leer, () => new Date(), opts);
    expect(await res.json()).toMatchObject({ status: "keine", id: null });
    expect((await get("/api/stats/woche/2026-11-20")).status).toBe(404);
    expect((await get("/api/stats/woche/2026-11-28")).status).toBe(404);
    expect((await get("/api/stats/monat/2026-13")).status).toBe(404);
    expect((await get("/api/stats/jahr")).status).toBe(404);
    expect((await get("/api/stats/woche/2026-11-21/x")).status).toBe(404);
  });

  test("?karte= liefert die Mitglieder hinter der Karte, immer über alle Gilden", async () => {
    const res = await handleApi(new Request(`http://x/api/stats?karte=tode&gilde=${encodeURIComponent("bärenklaue")}`), store, () => new Date(), opts);
    expect(res.status).toBe(200);
    const body = (await res.json()) as StatCardMembersView;
    expect(body.slug).toBe("tode");
    expect(body.stats[0]).toEqual({ id: 60, entries: [[99, 7], [1, 5], [3, 2], [2, 1]] });
    // Woche ohne Vorwoche taugt nicht, unbekannte Karte gibt es nicht
    expect((await get("/api/stats/woche?karte=tode")).status).toBe(404);
    expect((await get("/api/stats?karte=quatsch")).status).toBe(404);
    await store.set("stats/2026-11-14", fruehere);
    const woche = await handleApi(new Request("http://x/api/stats/woche/2026-11-21?karte=tode"), store, () => new Date(), opts);
    expect(((await woche.json()) as StatCardMembersView).stats[0].entries).toEqual([[1, 2]]);
  });
});
