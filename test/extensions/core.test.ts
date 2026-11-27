// Extension points of the server: without modules the core stays on its own, a test extension hooks into every point.
import { describe, expect, test } from "vitest";
import { buildNewspaperView, sectionName } from "../../src/api/newspaper-view";
import { handleApi } from "../../src/api/router";
import type { CharacterView } from "../../src/api/types";
import type { ServerErweiterung } from "../../src/erweiterungen/typen";
import { toServerExtension } from "../../src/extensions/legacy";
import type { ExtensionFact, ServerExtension } from "../../src/extensions/types";
import type { DaySnapshot, GuildRecord, WeeklyRecord } from "../../src/model";
import { createMemoryStore } from "../../src/store";
import { factsForModel } from "../../src/weekly/claude-text";
import { phraseGenerator } from "../../src/weekly/newspaper-text";
import { runWeeklyEvaluation } from "../../src/weekly/run";
import type { ErweiterungsFakt } from "../../src/weekly/zeitung-facts";
import { member } from "../helpers/members";

const guild: GuildRecord = {
  fetchedAt: "2026-11-16T08:00:00.000Z", id: 1, name: "Gilde", faction: "HORDE", memberCount: 2, rulesetName: "Normal",
  members: [
    member({ id: 1, name: "Anna", slug: "anna", firstSeenAt: "2026-11-01T10:00:00.000Z" }),
    member({ id: 2, name: "Bodo", slug: "bodo", firstSeenAt: "2026-11-01T10:00:00.000Z" }),
  ],
};

async function storeWithGuild() {
  const store = createMemoryStore();
  await store.set("guild", guild);
  return store;
}

const pollFact = (characterIds: number[]): ExtensionFact => ({
  kind: "extension",
  type: "umfrage",
  section: "Umfragen",
  newsValue: 90,
  characterIds,
  numbers: [42],
  write: ({ name, picker, seed }) => {
    const headline = picker.choose("umfrage-kopf", ["Große Umfrage", "Die Gilde hat gewählt"], seed);
    const who = characterIds.map(name).join(", ");
    return {
      de: { headline, text: `${who} stimmt 42 Mal ab.` },
      en: { headline: "Big poll", text: `${who} votes 42 times.` },
    };
  },
  forAi: (name) => ({ abstimmende: characterIds.map(name), stimmen: 42 }),
});

/** Test extension with every extension point. */
const testExtension: ServerExtension = {
  id: "umfragen",
  api: async (req, path, context) => {
    if (path !== "/api/umfragen") return null;
    if (req.method === "POST") {
      await context.purgeCache?.(["umfragen"]);
      return Response.json({ ok: true, ip: context.clientIp, geheim: context.env.UMFRAGE_CODE ?? null });
    }
    return Response.json({ fragen: 1 });
  },
  character: async ({ member: m }) => (m.id === 1 ? { stimmen: 42 } : null),
  characterCacheTags: ["umfragen"],
  weeklyArticles: async ({ ids }) => [pollFact([...ids].filter((id) => id === 1))],
  sections: { Umfragen: { de: "Umfragen", en: "Polls" } },
};

describe("core without extensions", () => {
  test("no foreign routes: GET 404, POST 405; character without extra data and without cache tag", async () => {
    const store = await storeWithGuild();
    const opts = { extensions: [] };
    expect((await handleApi(new Request("https://x/api/erfolge"), store, undefined, opts)).status).toBe(404);
    expect((await handleApi(new Request("https://x/api/umfragen"), store, undefined, opts)).status).toBe(404);
    expect((await handleApi(new Request("https://x/api/erfolge", { method: "POST" }), store, undefined, opts)).status).toBe(405);
    const res = await handleApi(new Request("https://x/api/characters/anna"), store, undefined, opts);
    expect(res.status).toBe(200);
    expect(res.headers.get("Netlify-Cache-Tag")).toBeNull();
    expect(await res.json()).not.toHaveProperty("extensions");
  });

  test("weekly newspaper without articles of extensions; the old section Erfolge stays translated", async () => {
    const store = await storeWithGuild();
    await storeWeek(store);
    await runWeeklyEvaluation({ store, now: () => new Date(NOW), generator: phraseGenerator, serverStart: null, extensions: [] });
    const record = await store.get<WeeklyRecord>("weekly/2026-11-14");
    expect(record).not.toBeNull();
    expect([record!.zeitung.lead, ...record!.zeitung.articles].map((a) => a.kind)).not.toContain("umfrage");
    expect(sectionName("Erfolge", [])).toMatchObject({ de: "Erfolge", en: "Achievements" });
    expect(sectionName("Umfragen", [])).toMatchObject({ de: "Umfragen", en: "Umfragen" });
  });
});

describe("core with test extension", () => {
  const opts = { extensions: [testExtension] };

  test("own route for GET and POST, with environment, IP and cache purge; other paths stay with the core", async () => {
    const store = await storeWithGuild();
    expect(await (await handleApi(new Request("https://x/api/umfragen/"), store, undefined, opts)).json()).toEqual({ fragen: 1 });
    const purged: string[][] = [];
    const post = await handleApi(new Request("https://x/api/umfragen", { method: "POST" }), store, undefined, {
      ...opts,
      env: { UMFRAGE_CODE: "abc" },
      clientIp: "192.0.2.1",
      purgeCache: async (tags) => {
        purged.push(tags);
      },
    });
    expect(await post.json()).toEqual({ ok: true, ip: "192.0.2.1", geheim: "abc" });
    expect(purged).toEqual([["umfragen"]]);
    expect((await handleApi(new Request("https://x/api/guild"), store, undefined, opts)).status).toBe(200);
    expect((await handleApi(new Request("https://x/api/guild", { method: "POST" }), store, undefined, opts)).status).toBe(405);
  });

  test("errors of an extension become 500", async () => {
    const broken: ServerExtension = { id: "kaputt", api: async () => { throw new Error("weg"); } };
    const res = await handleApi(new Request("https://x/api/guild"), await storeWithGuild(), undefined, { extensions: [broken] });
    expect(res.status).toBe(500);
  });

  test("extra data for the character page under extensions[id], cache tag on every character response", async () => {
    const store = await storeWithGuild();
    const anna = await handleApi(new Request("https://x/api/characters/anna"), store, undefined, opts);
    expect(anna.headers.get("Netlify-Cache-Tag")).toBe("umfragen");
    expect(((await anna.json()) as CharacterView).extensions).toEqual({ umfragen: { stimmen: 42 } });
    const bodo = await handleApi(new Request("https://x/api/characters/bodo"), store, undefined, opts);
    expect(bodo.headers.get("Netlify-Cache-Tag")).toBe("umfragen");
    expect(await bodo.json()).not.toHaveProperty("extensions");
  });

  test("weekly article appears in the issue with its own type, section and texts in German and English", async () => {
    const store = await storeWithGuild();
    await storeWeek(store);
    await runWeeklyEvaluation({ store, now: () => new Date(NOW), generator: phraseGenerator, serverStart: null, extensions: [testExtension] });
    const record = (await store.get<WeeklyRecord>("weekly/2026-11-14"))!;
    // News value 90: the lead
    const lead = record.zeitung.lead;
    expect([lead.kind, lead.section, lead.characterIds, lead.text]).toEqual(["umfrage", "Umfragen", [1], "Anna stimmt 42 Mal ab."]);
    expect(lead.headline === "Große Umfrage" || lead.headline === "Die Gilde hat gewählt").toBe(true);
    expect((lead.dialekte as { en?: { text: string } }).en?.text).toBe("Anna votes 42 times.");
    expect(record.zeitung.bausteine?.some((b) => b.startsWith("umfrage-kopf:"))).toBe(true);
    const view = buildNewspaperView(guild, record, ["2026-11-14"]);
    expect(view.lead.section).toMatchObject({ de: "Umfragen", en: "Umfragen" });
    // With the extension the view knows the translation of the section.
    expect(sectionName("Umfragen", [testExtension])).toEqual({ de: "Umfragen", en: "Polls" });
  });

  test("dialects fall back to German, the AI gets section, type and the extension's fields", async () => {
    const facts = [pollFact([1])];
    const ctx = { week: "2026-11-14", name: (id: number) => (id === 1 ? "Anna" : "Bodo"), allNames: ["Anna", "Bodo"], languages: ["de", "en", "schwaebisch"] as const };
    const r = await phraseGenerator(facts, ctx);
    expect(r.articles[0].dialekte?.schwaebisch?.text).toBe("Anna stimmt 42 Mal ab.");
    expect(factsForModel(facts, ctx)).toEqual([{ nr: 0, rubrik: "Aufmacher", art: "umfrage", abstimmende: ["Anna"], stimmen: 42 }]);
  });
});

/** A module in the 2.x shape (German member names), as registered in src/erweiterungen/index.ts. */
const legacyFact = (characterIds: number[]): ErweiterungsFakt => ({
  kind: "erweiterung",
  art: "raetsel",
  rubrik: "Rätsel",
  nachrichtenwert: 85,
  characterIds,
  zahlen: [7],
  schreibe: ({ name }) => {
    const who = characterIds.map(name).join(", ");
    return {
      de: { headline: "Rätselkönig", text: `${who} löst 7 Rätsel.` },
      en: { headline: "Puzzle king", text: `${who} solves 7 puzzles.` },
    };
  },
  fuerKi: (name) => ({ loeser: characterIds.map(name), raetsel: 7 }),
});

const legacyExtension: ServerErweiterung = {
  id: "raetsel",
  charakter: async ({ member: m }) => (m.id === 1 ? { geloest: 7 } : null),
  charakterCacheTags: ["raetsel"],
  wochenArtikel: async ({ ids }) => [legacyFact([...ids].filter((id) => id === 1))],
  rubriken: { Rätsel: { de: "Rätsel", en: "Puzzles" } },
};

describe("registry mix of 3.0 and 2.x modules", () => {
  const opts = { extensions: [testExtension, legacyExtension] };

  test("both deliver character data and cache tags", async () => {
    const store = await storeWithGuild();
    const anna = await handleApi(new Request("https://x/api/characters/anna"), store, undefined, opts);
    expect(anna.headers.get("Netlify-Cache-Tag")?.split(",").map((t) => t.trim()).sort()).toEqual(["raetsel", "umfragen"]);
    expect(((await anna.json()) as CharacterView).extensions).toEqual({ umfragen: { stimmen: 42 }, raetsel: { geloest: 7 } });
  });

  test("both deliver weekly articles with their own type and section", async () => {
    const store = await storeWithGuild();
    await storeWeek(store);
    await runWeeklyEvaluation({ store, now: () => new Date(NOW), generator: phraseGenerator, serverStart: null, ...opts });
    const record = (await store.get<WeeklyRecord>("weekly/2026-11-14"))!;
    const all = [record.zeitung.lead, ...record.zeitung.articles];
    expect(all.find((a) => a.kind === "umfrage")).toMatchObject({ section: "Umfragen", text: "Anna stimmt 42 Mal ab." });
    expect(all.find((a) => a.kind === "raetsel")).toMatchObject({ section: "Rätsel", text: "Anna löst 7 Rätsel." });
    expect(sectionName("Rätsel", opts.extensions)).toEqual({ de: "Rätsel", en: "Puzzles" });
  });

  test("toServerExtension returns a module in the 3.0 shape unchanged", () => {
    expect(toServerExtension(testExtension)).toBe(testExtension);
  });
});

// Sunday, 15.11.2026: the last completed week is 2026-11-14 (8 to 14 November).
const NOW = "2026-11-15T09:00:00.000Z";

const snap = (date: string, levels: Record<string, number>): DaySnapshot => ({
  date,
  takenAt: `${date}T20:00:00.000Z`,
  characters: Object.fromEntries(
    Object.entries(levels).map(([id, level]) => [id, { level, equippedItemLevel: null, professions: {}, deaths: 0 }]),
  ),
});

async function storeWeek(store: ReturnType<typeof createMemoryStore>) {
  await store.set("history/2026-11-07", snap("2026-11-07", { "1": 20, "2": 30 }));
  await store.set("history/2026-11-14", snap("2026-11-14", { "1": 21, "2": 30 }));
  await store.set("activity/2026-W46", { week: "2026-W46", characters: { "1": [2, 26], "2": [20] } });
}

test("a module halfway through its upgrade: the 3.0 member wins, the 2.x member fills the gaps", async () => {
  const half = {
    id: "half",
    character: async () => ({ from: "character" }),
    charakter: async () => ({ from: "charakter" }),
    rubriken: { Halb: { de: "Halb", en: "Half" } },
  };
  const converted = toServerExtension(half as never);
  expect(await converted.character?.({} as never)).toEqual({ from: "character" });
  expect(converted.sections).toEqual({ Halb: { de: "Halb", en: "Half" } });
});
