// Extension tests of 2.1.5, kept to prove that modules written for 2.x still work in 3.x through the deprecated names
// (src/erweiterungen/typen.ts, src/weekly/zeitung-facts.ts). Changed against 2.1.5: only imports and calls of core
// internals that changed in 3.x (marked `3.x`), and the API field `erweiterungen`, which is now `extensions`. Removed in 4.0.
// Erweiterungspunkte des Servers: ohne Module bleibt der Kern für sich, eine Test-Erweiterung hängt sich an alle Stellen.
import { describe, expect, test } from "vitest";
import { buildNewspaperView as buildZeitungView, sectionName as rubrik } from "../../src/api/newspaper-view";
import { handleApi } from "../../src/api/router";
import { fromLegacyFact } from "../../src/extensions/legacy";
import type { CharacterView } from "../../src/api/types";
import type { ServerErweiterung } from "../../src/erweiterungen/typen";
import type { DaySnapshot, GuildRecord, WeeklyRecord } from "../../src/model";
import { createMemoryStore } from "../../src/store";
import type { ErweiterungsFakt } from "../../src/weekly/zeitung-facts";
import { phraseGenerator as bausteinGenerator } from "../../src/weekly/newspaper-text";
import { factsForModel } from "../../src/weekly/claude-text";
import { runWeeklyEvaluation } from "../../src/weekly/run";
import { member } from "../helpers/members";

const guild: GuildRecord = {
  fetchedAt: "2026-11-16T08:00:00.000Z", id: 1, name: "Gilde", faction: "HORDE", memberCount: 2, rulesetName: "Normal",
  members: [
    member({ id: 1, name: "Anna", slug: "anna", firstSeenAt: "2026-11-01T10:00:00.000Z" }),
    member({ id: 2, name: "Bodo", slug: "bodo", firstSeenAt: "2026-11-01T10:00:00.000Z" }),
  ],
};

async function storeMitGilde() {
  const store = createMemoryStore();
  await store.set("guild", guild);
  return store;
}

const umfrageFakt = (characterIds: number[]): ErweiterungsFakt => ({
  kind: "erweiterung",
  art: "umfrage",
  rubrik: "Umfragen",
  nachrichtenwert: 90,
  characterIds,
  zahlen: [42],
  schreibe: ({ name, picker, seed }) => {
    const kopf = picker.choose("umfrage-kopf", ["Große Umfrage", "Die Gilde hat gewählt"], seed);
    const wer = characterIds.map(name).join(", ");
    return {
      de: { headline: kopf, text: `${wer} stimmt 42 Mal ab.` },
      en: { headline: "Big poll", text: `${wer} votes 42 times.` },
    };
  },
  fuerKi: (name) => ({ abstimmende: characterIds.map(name), stimmen: 42 }),
});

/** Test-Erweiterung mit allen Erweiterungspunkten. */
const testErweiterung: ServerErweiterung = {
  id: "umfragen",
  api: async (req, pfad, kontext) => {
    if (pfad !== "/api/umfragen") return null;
    if (req.method === "POST") {
      await kontext.purgeCache?.(["umfragen"]);
      return Response.json({ ok: true, ip: kontext.clientIp, geheim: kontext.env.UMFRAGE_CODE ?? null });
    }
    return Response.json({ fragen: 1 });
  },
  charakter: async ({ member: m }) => (m.id === 1 ? { stimmen: 42 } : null),
  charakterCacheTags: ["umfragen"],
  wochenArtikel: async ({ ids }) => [umfrageFakt([...ids].filter((id) => id === 1))],
  rubriken: { Umfragen: { de: "Umfragen", en: "Polls" } },
};

describe("Kern ohne Erweiterungen", () => {
  test("keine fremden Routen: GET 404, POST 405; Charakter ohne Zusatzdaten und ohne Cache-Tag", async () => {
    const store = await storeMitGilde();
    const opts = { erweiterungen: [] };
    expect((await handleApi(new Request("https://x/api/erfolge"), store, undefined, opts)).status).toBe(404);
    expect((await handleApi(new Request("https://x/api/umfragen"), store, undefined, opts)).status).toBe(404);
    expect((await handleApi(new Request("https://x/api/erfolge", { method: "POST" }), store, undefined, opts)).status).toBe(405);
    const res = await handleApi(new Request("https://x/api/characters/anna"), store, undefined, opts);
    expect(res.status).toBe(200);
    expect(res.headers.get("Netlify-Cache-Tag")).toBeNull();
    expect(await res.json()).not.toHaveProperty("extensions");
  });

  test("Wochenzeitung ohne Meldungen von Erweiterungen; alte Rubrik Erfolge bleibt übersetzt", async () => {
    const store = await storeMitGilde();
    await storeWoche(store);
    await runWeeklyEvaluation({ store, now: () => new Date(NOW), generator: bausteinGenerator, serverStart: null, erweiterungen: [] });
    const record = await store.get<WeeklyRecord>("weekly/2026-11-14");
    expect(record).not.toBeNull();
    expect([record!.zeitung.lead, ...record!.zeitung.articles].map((a) => a.kind)).not.toContain("umfrage");
    expect(rubrik("Erfolge", [])).toMatchObject({ de: "Erfolge", en: "Achievements" });
    expect(rubrik("Umfragen", [])).toMatchObject({ de: "Umfragen", en: "Umfragen" });
  });
});

describe("Kern mit Test-Erweiterung", () => {
  const opts = { erweiterungen: [testErweiterung] };

  test("eigene Route für GET und POST, mit Umgebung, IP und Cache-Leeren; fremde Pfade bleiben beim Kern", async () => {
    const store = await storeMitGilde();
    expect(await (await handleApi(new Request("https://x/api/umfragen/"), store, undefined, opts)).json()).toEqual({ fragen: 1 });
    const geleert: string[][] = [];
    const post = await handleApi(new Request("https://x/api/umfragen", { method: "POST" }), store, undefined, {
      ...opts,
      env: { UMFRAGE_CODE: "abc" },
      clientIp: "192.0.2.1",
      purgeCache: async (tags) => {
        geleert.push(tags);
      },
    });
    expect(await post.json()).toEqual({ ok: true, ip: "192.0.2.1", geheim: "abc" });
    expect(geleert).toEqual([["umfragen"]]);
    expect((await handleApi(new Request("https://x/api/guild"), store, undefined, opts)).status).toBe(200);
    expect((await handleApi(new Request("https://x/api/guild", { method: "POST" }), store, undefined, opts)).status).toBe(405);
  });

  test("Fehler einer Erweiterung werden zu 500", async () => {
    const kaputt: ServerErweiterung = { id: "kaputt", api: async () => { throw new Error("weg"); } };
    const res = await handleApi(new Request("https://x/api/guild"), await storeMitGilde(), undefined, { erweiterungen: [kaputt] });
    expect(res.status).toBe(500);
  });

  test("Zusatzdaten für die Charakterseite unter erweiterungen[id], Cache-Tag auf jeder Charakterantwort", async () => {
    const store = await storeMitGilde();
    const anna = await handleApi(new Request("https://x/api/characters/anna"), store, undefined, opts);
    expect(anna.headers.get("Netlify-Cache-Tag")).toBe("umfragen");
    expect(((await anna.json()) as CharacterView).extensions).toEqual({ umfragen: { stimmen: 42 } });
    const bodo = await handleApi(new Request("https://x/api/characters/bodo"), store, undefined, opts);
    expect(bodo.headers.get("Netlify-Cache-Tag")).toBe("umfragen");
    expect(await bodo.json()).not.toHaveProperty("extensions");
  });

  test("Wochenartikel erscheint in der Ausgabe mit eigener Art, Rubrik und Texten in Deutsch und Englisch", async () => {
    const store = await storeMitGilde();
    await storeWoche(store);
    await runWeeklyEvaluation({ store, now: () => new Date(NOW), generator: bausteinGenerator, serverStart: null, erweiterungen: [testErweiterung] });
    const record = (await store.get<WeeklyRecord>("weekly/2026-11-14"))!;
    // Nachrichtenwert 90: der Aufmacher
    const lead = record.zeitung.lead;
    expect([lead.kind, lead.section, lead.characterIds, lead.text]).toEqual(["umfrage", "Umfragen", [1], "Anna stimmt 42 Mal ab."]);
    expect(lead.headline === "Große Umfrage" || lead.headline === "Die Gilde hat gewählt").toBe(true);
    expect((lead.dialekte as { en?: { text: string } }).en?.text).toBe("Anna votes 42 times.");
    expect(record.zeitung.bausteine?.some((b) => b.startsWith("umfrage-kopf:"))).toBe(true);
    const view = buildZeitungView(guild, record, ["2026-11-14"]);
    expect(view.lead.section).toMatchObject({ de: "Umfragen", en: "Umfragen" });
    // Mit der Erweiterung kennt die Ansicht die Übersetzung der Rubrik.
    expect(rubrik("Umfragen", [testErweiterung])).toEqual({ de: "Umfragen", en: "Polls" });
  });

  test("Dialekte fallen auf Deutsch zurück, die KI bekommt Rubrik, Art und die Felder der Erweiterung", async () => {
    // 3.x: the core converts 2.x articles before its text generators see them.
    const facts = [umfrageFakt([1])].map(fromLegacyFact);
    const ctx = { week: "2026-11-14", name: (id: number) => (id === 1 ? "Anna" : "Bodo"), allNames: ["Anna", "Bodo"], languages: ["de", "en", "schwaebisch"] as const };
    const r = await bausteinGenerator(facts, ctx);
    expect(r.articles[0].dialekte?.schwaebisch?.text).toBe("Anna stimmt 42 Mal ab.");
    expect(factsForModel(facts, ctx)).toEqual([{ nr: 0, rubrik: "Aufmacher", art: "umfrage", abstimmende: ["Anna"], stimmen: 42 }]);
  });
});

// Sonntag, 15.11.2026: die letzte abgeschlossene Woche ist 2026-11-14 (8. bis 14.11.).
const NOW = "2026-11-15T09:00:00.000Z";

const snap = (date: string, levels: Record<string, number>): DaySnapshot => ({
  date,
  takenAt: `${date}T20:00:00.000Z`,
  characters: Object.fromEntries(
    Object.entries(levels).map(([id, level]) => [id, { level, equippedItemLevel: null, professions: {}, deaths: 0 }]),
  ),
});

async function storeWoche(store: ReturnType<typeof createMemoryStore>) {
  await store.set("history/2026-11-07", snap("2026-11-07", { "1": 20, "2": 30 }));
  await store.set("history/2026-11-14", snap("2026-11-14", { "1": 21, "2": 30 }));
  await store.set("activity/2026-W46", { week: "2026-W46", characters: { "1": [2, 26], "2": [20] } });
}
