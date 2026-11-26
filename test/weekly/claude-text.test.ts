import { expect, onTestFinished, test, vi } from "vitest";
import type { ZeitungFact } from "../../src/weekly/zeitung-facts";
import {
  createClaudeGenerator, factsForModel, generatorFromEnv, mentionedNames, ohneGedankenstriche, SYSTEM_PROMPT, systemPrompt,
  jsonAusText, validateModelOutput, type MessagesClient,
} from "../../src/weekly/claude-text";
import { bausteinGenerator } from "../../src/weekly/zeitung-text";
import { SPRACHEN } from "../../src/sprache";

const FACTS: ZeitungFact[] = [
  { kind: "sprung", characterId: 1, levels: 7, from: 20, to: 27, title: null },
  { kind: "titel", titleId: "pechvogel", characterId: 2, value: 9 },
  { kind: "zahl", value: 42, what: "level" },
];
const names: Record<number, string> = { 1: "Anna", 2: "Bodo", 3: "Cleo" };
const ctx = { week: "2026-W46", name: (id: number) => names[id], allNames: ["Anna", "Bodo", "Cleo"] };
/** Wie eine Installation mit allen Sprachen (WEBSITE_LANGUAGES=de,schwaebisch,bayrisch,en). */
const ctxAlle = { ...ctx, sprachen: SPRACHEN };

const good = {
  artikel: [
    { nr: 0, schlagzeile: "Anna fliegt von 20 auf 27", text: "Sieben Level? Nein, 7 Level! Heilig's Blechle, gell." },
    { nr: 1, schlagzeile: "Bodo und der Boden", text: "9 Tode — der Geistheiler grüßt." },
    { nr: 2, schlagzeile: "42", text: "So viele Level hat die Gilde gesammelt." },
  ],
  spruch: "No ned hudla.",
};

function fakeClient(reply: unknown, over: { stop_reason?: string } = {}) {
  const create = vi.fn(async (params: unknown) => {
    void params;
    return {
      model: "anthropic-router",
      stop_reason: over.stop_reason ?? "end_turn",
      content: [{ type: "text", text: typeof reply === "string" ? reply : JSON.stringify(reply) }],
    };
  });
  return { client: { messages: { create } } as unknown as MessagesClient, create };
}

test("gültige Antwort wird übernommen, Gedankenstriche werden ersetzt, Rubrik und Charaktere kommen aus den Fakten", async () => {
  const { client, create } = fakeClient(good);
  const result = await createClaudeGenerator({ client, log: () => {} })(FACTS, ctxAlle);
  expect(result).toMatchObject({ generator: "claude", model: "anthropic-router", motto: "No ned hudla." });
  expect(result.fallback).toBeUndefined();
  const erster = { headline: "Anna fliegt von 20 auf 27", text: "Sieben Level? Nein, 7 Level! Heilig's Blechle, gell." };
  expect(result.articles[0]).toEqual({
    kind: "sprung", section: "Aufsteiger", ...erster, characterIds: [1], dialekte: { en: erster, schwaebisch: erster, bayrisch: erster },
  });
  expect(result.mottoDialekte).toEqual({ en: "No ned hudla.", schwaebisch: "No ned hudla.", bayrisch: "No ned hudla." });
  expect(result.articles[1].text).toBe("9 Tode, der Geistheiler grüßt.");
  expect(result.articles[2]).toMatchObject({ section: "Zahl der Woche", characterIds: [] });

  // Je Sprachfassung ein Aufruf mit dem eingestellten Modell, ohne Anthropic-Betas, Server-Fallback oder output_config
  expect(create).toHaveBeenCalledTimes(4);
  const systeme = create.mock.calls.map((c) => (c[0] as { system: string }).system);
  expect(systeme).toEqual([systemPrompt("de"), systemPrompt("en"), systemPrompt("schwaebisch"), systemPrompt("bayrisch")]);
  expect(systemPrompt("de")).toContain("Hochdeutsch ganz ohne Dialekt");
  expect(systemPrompt("en")).toContain("auf Englisch");
  expect(systemPrompt("schwaebisch")).toContain("auf Schwäbisch");
  expect(systemPrompt("bayrisch")).toContain("auf Bayrisch");
  const params = create.mock.calls[0][0] as Record<string, unknown>;
  expect(params).toMatchObject({ model: "anthropic-router", max_tokens: 8000, system: SYSTEM_PROMPT });
  expect(Object.keys(params).sort()).toEqual(["max_tokens", "messages", "model", "system"]);
  expect(SYSTEM_PROMPT).toContain('{"artikel": [{"nr": 0');
  const content = (params.messages as { content: string }[])[0].content;
  expect(content).toContain('"charakter": "Anna"');
  expect(content).not.toContain("Cleo");
});

test.each([
  ["fremder Name", { ...good, artikel: [good.artikel[0], { nr: 1, schlagzeile: "Bodo und Cleo", text: "Zusammen 9 Tode." }, good.artikel[2]] }, /fremde Namen: Cleo/],
  ["Name aus anderem Fakt", { ...good, artikel: [good.artikel[0], { nr: 1, schlagzeile: "Bodo schlägt Anna", text: "9 Tode." }, good.artikel[2]] }, /fremde Namen: Anna/],
  ["erfundene Zahl", { ...good, artikel: [{ nr: 0, schlagzeile: "Anna, 13 Level", text: "Wow, gell." }, good.artikel[1], good.artikel[2]] }, /Zahlen.*13/],
  ["zu wenige Artikel", { ...good, artikel: good.artikel.slice(0, 2) }, /2 Artikel für 3 Fakten/],
  ["falsches Format", { text: "hallo" }, /Format/],
  ["Spruch mit Namen", { ...good, spruch: "Anna, no ned hudla." }, /Spruch/],
])("Prüfung schlägt an: %s", (_label, raw, error) => {
  expect(() => validateModelOutput(raw, FACTS, ctx)).toThrow(error);
});

test.each([
  ["Netzwerkfehler", () => { throw new Error("connect ECONNREFUSED"); }],
  ["Ablehnung", () => ({ stop_reason: "refusal", content: [], model: "x" })],
  ["abgeschnitten", () => ({ stop_reason: "max_tokens", content: [{ type: "text", text: "{" }], model: "x" })],
  ["kein JSON", () => ({ stop_reason: "end_turn", content: [{ type: "text", text: "kein json" }], model: "x" })],
  ["kaputtes JSON", () => ({ stop_reason: "end_turn", content: [{ type: "text", text: '{"artikel": [}' }], model: "x" })],
  ["leere Antwort ohne Inhalt", () => ({ stop_reason: "end_turn", model: "x" })],
  ["fremder Name", () => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ ...good, spruch: "Cleo!" }) }], model: "x" })],
])("Rückfall auf die Satzbausteine bei %s", async (_label, reply) => {
  const client = { messages: { create: vi.fn(async () => reply()) } } as unknown as MessagesClient;
  const log = vi.fn();
  const result = await createClaudeGenerator({ client, log })(FACTS, ctx);
  const plain = await bausteinGenerator(FACTS, ctx);
  expect(result).toEqual({ ...plain, fallback: expect.any(String) });
  expect(log).toHaveBeenCalledTimes(1);
});

test("Scheitert nur ein Dialekt, springen für ihn die Satzbausteine ein, der Rest bleibt von Claude", async () => {
  const create = vi.fn(async (params: { system: string }) => {
    if (params.system.includes("auf Bayrisch")) throw new Error("Zeitüberschreitung");
    return { model: "claude-opus-5-5", stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(good) }] };
  });
  const client = { messages: { create } } as unknown as MessagesClient;
  const log = vi.fn();
  const result = await createClaudeGenerator({ client, log })(FACTS, ctxAlle);
  const plain = await bausteinGenerator(FACTS, ctxAlle);
  expect(result.generator).toBe("claude");
  expect(result.fallback).toBe("bayrisch: Zeitüberschreitung");
  expect(log).toHaveBeenCalledTimes(1);
  expect(result.articles[0].headline).toBe("Anna fliegt von 20 auf 27");
  expect(result.articles[0].dialekte?.schwaebisch?.headline).toBe("Anna fliegt von 20 auf 27");
  expect(result.articles[0].dialekte?.bayrisch).toEqual(plain.articles[0].dialekte?.bayrisch);
  expect(result.mottoDialekte?.bayrisch).toBe(plain.mottoDialekte?.bayrisch);
});

test("Antwort im Codeblock mit Satz davor wird trotzdem gelesen", async () => {
  const { client } = fakeClient(`Gern, hier die Zeitung:\n\`\`\`json\n${JSON.stringify(good)}\n\`\`\``);
  const result = await createClaudeGenerator({ client, log: () => {} })(FACTS, ctx);
  expect(result.generator).toBe("claude");
  expect(result.fallback).toBeUndefined();
  expect(jsonAusText('vorher {"a": 1} nachher')).toEqual({ a: 1 });
  expect(() => jsonAusText("gar nichts")).toThrow(/kein JSON-Objekt/);
  expect(() => jsonAusText("{ nicht json }")).toThrow(/kein gültiges JSON/);
});

test("output_config nur, wenn eingeschaltet", async () => {
  const { client, create } = fakeClient(good);
  await createClaudeGenerator({ client, log: () => {}, outputConfig: true, effort: "medium" })(FACTS, ctx);
  expect(create.mock.calls[0][0]).toMatchObject({ output_config: { effort: "medium", format: { type: "json_schema" } } });
  expect(create.mock.calls[0][0]).not.toHaveProperty("betas");
});

/** Gefälschtes fetch für den echten SDK-Client: merkt sich die Anfragen und antwortet wie die Messages API. */
function fakeFetch(text = JSON.stringify(good)) {
  const anfragen: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
  const fetchFn = vi.fn(async (eingabe: string | URL | Request, init: RequestInit = {}) => {
    const url = eingabe instanceof Request ? eingabe.url : String(eingabe);
    anfragen.push({ url, headers: new Headers(init.headers), body: JSON.parse(String(init.body)) });
    return Response.json({
      id: "msg_1", type: "message", role: "assistant", model: "router-antwort", stop_reason: "end_turn", stop_sequence: null,
      content: [{ type: "text", text }], usage: { input_tokens: 1, output_tokens: 1 },
    });
  });
  return { anfragen, fetchFn: fetchFn as unknown as typeof fetch };
}

test("generatorFromEnv: ANTHROPIC_API_KEY und ANTHROPIC_BASE_URL allein führen zu den Satzbausteinen", () => {
  const netlify = { ANTHROPIC_API_KEY: "netlify-schluessel", ANTHROPIC_BASE_URL: "https://netlify.example/anthropic" };
  expect(generatorFromEnv({})).toBe(bausteinGenerator);
  expect(generatorFromEnv(netlify)).toBe(bausteinGenerator);
  expect(generatorFromEnv({ ...netlify, NEWSPAPER_AI_URL: "https://gateway.example" })).toBe(bausteinGenerator);
  expect(generatorFromEnv({ ...netlify, NEWSPAPER_AI_KEY: "eigener-schluessel" })).toBe(bausteinGenerator);
  expect(generatorFromEnv({ NEWSPAPER_AI_URL: " ", NEWSPAPER_AI_KEY: "eigener-schluessel" })).toBe(bausteinGenerator);
});

test("generatorFromEnv: mit eigenen Variablen gehen Basis-URL, x-api-key und Modell an das Gateway, nie an Netlify", async () => {
  vi.stubEnv("WEBSITE_LANGUAGES", "");
  onTestFinished(() => {
    vi.unstubAllEnvs();
  });
  const { anfragen, fetchFn } = fakeFetch();
  const env = {
    ANTHROPIC_API_KEY: "netlify-schluessel",
    ANTHROPIC_BASE_URL: "https://netlify.example/anthropic",
    ANTHROPIC_AUTH_TOKEN: "netlify-token",
    NEWSPAPER_AI_URL: "https://gateway.example/claude",
    NEWSPAPER_AI_KEY: "eigener-schluessel",
    NEWSPAPER_AI_MODEL: "mein-router",
  };
  const result = await generatorFromEnv(env, { fetch: fetchFn })(FACTS, ctx);
  expect(result).toMatchObject({ generator: "claude", model: "router-antwort" });
  expect(result.fallback).toBeUndefined();
  // Ohne WEBSITE_LANGUAGES nur Deutsch und Englisch: keine bezahlten Dialekt-Aufrufe
  expect(anfragen).toHaveLength(2);
  for (const a of anfragen) {
    expect(a.url).toBe("https://gateway.example/claude/v1/messages");
    expect(a.headers.get("x-api-key")).toBe("eigener-schluessel");
    expect(a.headers.get("authorization")).toBeNull();
    expect(a.headers.get("anthropic-beta")).toBeNull();
    expect(a.body).toMatchObject({ model: "mein-router" });
    expect(a.body).not.toHaveProperty("output_config");
    expect(a.body).not.toHaveProperty("fallbacks");
    expect(JSON.stringify([...a.headers])).not.toContain("netlify");
  }
});

test("generatorFromEnv: Vorgabemodell anthropic-router, output_config nur mit NEWSPAPER_AI_OUTPUT_CONFIG=on", async () => {
  const basis = { NEWSPAPER_AI_URL: "https://gateway.example", NEWSPAPER_AI_KEY: "eigener-schluessel" };
  const ohne = fakeFetch();
  await generatorFromEnv(basis, { fetch: ohne.fetchFn })(FACTS, ctx);
  expect(ohne.anfragen[0].body).toMatchObject({ model: "anthropic-router" });
  expect(ohne.anfragen[0].body).not.toHaveProperty("output_config");

  const mit = fakeFetch();
  await generatorFromEnv({ ...basis, NEWSPAPER_AI_OUTPUT_CONFIG: "on", NEWSPAPER_AI_EFFORT: "high" }, { fetch: mit.fetchFn })(FACTS, ctx);
  expect(mit.anfragen[0].body).toMatchObject({ output_config: { effort: "high", format: { type: "json_schema" } } });
});

test("generatorFromEnv: ungültige Antwort des Gateways führt zum Rückfall", async () => {
  const { fetchFn } = fakeFetch("Tut mir leid, heute kein JSON.");
  const log = vi.spyOn(console, "warn").mockImplementation(() => {});
  const result = await generatorFromEnv({ NEWSPAPER_AI_URL: "https://gateway.example", NEWSPAPER_AI_KEY: "s" }, { fetch: fetchFn })(FACTS, ctx);
  expect(result).toEqual({ ...(await bausteinGenerator(FACTS, ctx)), fallback: expect.stringContaining("JSON") });
  expect(log).toHaveBeenCalledTimes(1);
  log.mockRestore();
});

test("Hilfen: Namenssuche nach ganzen Wörtern, Gedankenstriche, Fakten fürs Modell", () => {
  expect(mentionedNames("Annabell und Bodo", ["Anna", "Bodo"])).toEqual(["Bodo"]);
  expect(mentionedNames("Ännchen trifft Än", ["Än"])).toEqual(["Än"]);
  expect(ohneGedankenstriche("A — B – C")).toBe("A, B, C");
  const model = factsForModel(FACTS, ctx) as Record<string, unknown>[];
  expect(model[0]).toMatchObject({ nr: 0, rubrik: "Aufmacher", charakter: "Anna", level_gewonnen: 7 });
  expect(model[1]).toMatchObject({ rubrik: "Friedhof", titel: "Pechvogel", wert: "9 Tode" });
  expect(JSON.stringify(model)).not.toMatch(/characterId/);
  const bayrisch = factsForModel([{ kind: "titel", titleId: "kaepsele", characterId: 2, value: 4 }], ctx, "bayrisch") as Record<string, unknown>[];
  expect(bayrisch[0]).toMatchObject({ titel: "Gscheithaferl", wert: "4 neie Erfolge" });
});

test("Die letzten Ausgaben stehen im Aufruf, eine wörtliche Wiederholung führt zum Rückfall", async () => {
  const recent = [{
    week: "2026-W45", bausteine: [], headlines: ["Bodo und der Boden"], texts: ["Der Geistheiler kennt Bodo beim Vornamen."],
    motto: "No ned hudla.",
  }];
  const neu = {
    artikel: [
      { nr: 0, schlagzeile: "Anna fliegt von 20 auf 27", text: "Heilig's Blechle, gell." },
      { nr: 1, schlagzeile: "Bodo trifft den Boden", text: "9 Tode. Der Friedhof hat jetzt Stammkundschaft." },
      { nr: 2, schlagzeile: "42", text: "So viele Level hat die Gilde gesammelt." },
    ],
    spruch: "Wer ko, der ko.",
  };
  const { client, create } = fakeClient(neu);
  const ok = await createClaudeGenerator({ client, log: () => {} })(FACTS, { ...ctx, recent });
  expect(ok.generator).toBe("claude");
  const content = ((create.mock.calls[0][0] as { messages: { content: string }[] }).messages)[0].content;
  expect(content).toContain("Bereits erschienen");
  expect(content).toContain("Der Geistheiler kennt Bodo beim Vornamen.");
  expect(SYSTEM_PROMPT).toContain("Wiederhole daraus keine Formulierungen");

  // Gleicher Satz mit anderem Namen gilt als Wiederholung
  const wiederholt = { ...neu, artikel: [neu.artikel[0], { nr: 1, schlagzeile: "Bodo", text: "Der Geistheiler kennt Bodo beim Vornamen." }, neu.artikel[2]] };
  const { client: c2 } = fakeClient(wiederholt);
  const rueck = await createClaudeGenerator({ client: c2, log: () => {} })(FACTS, { ...ctx, recent });
  expect(rueck).toMatchObject({ generator: "bausteine", fallback: expect.stringContaining("früheren Ausgabe") });
  const { client: c3 } = fakeClient({ ...neu, spruch: "No ned hudla." });
  expect((await createClaudeGenerator({ client: c3, log: () => {} })(FACTS, { ...ctx, recent })).fallback).toMatch(/Spruch/);
});

test("Systemprompt: Name der Zeitung und Gilden aus dem Rahmen, ohne festen Gildenbezug als Vorgabe", () => {
  expect(SYSTEM_PROMPT).not.toMatch(/Bärenklaue|Gildeblatt/);
  expect(SYSTEM_PROMPT).toContain('"Gildenblatt", die Wochenzeitung einer World-of-Warcraft-Gilde');
  expect(systemPrompt("en")).toContain('"Guild Gazette"');
  expect(systemPrompt("schwaebisch")).toContain('"Gildeblatt"');
  const mit = systemPrompt("en", false, { zeitung: "Die Gildenpost", gilden: ["Eisenfaust", "Silberhand"] });
  expect(mit).toContain('"Die Gildenpost", die Wochenzeitung der World-of-Warcraft-Gilden Eisenfaust und Silberhand');
  expect(systemPrompt("de", false, { gilden: ["Eisenfaust"] })).toContain("der World-of-Warcraft-Gilde Eisenfaust.");
});

test("KI: Englisch kommt immer dazu, Dialekte nur mit WEBSITE_LANGUAGES; WEBSITE_NEWSPAPER und Gilden landen im Prompt", async () => {
  const vorher = { sprachen: process.env.WEBSITE_LANGUAGES, zeitung: process.env.WEBSITE_NEWSPAPER };
  try {
    process.env.WEBSITE_LANGUAGES = "de,schwaebisch";
    process.env.WEBSITE_NEWSPAPER = "Bärenklaue-Blatt";
    const { client, create } = fakeClient(good);
    const result = await createClaudeGenerator({ client, log: () => {} })(FACTS, { ...ctx, gilden: ["Eisenfaust"] });
    const systeme = create.mock.calls.map((c) => (c[0] as { system: string }).system);
    expect(systeme).toHaveLength(3);
    expect(systeme[1]).toContain("auf Englisch");
    expect(systeme[2]).toContain("auf Schwäbisch");
    for (const sys of systeme) expect(sys).toContain('"Bärenklaue-Blatt", die Wochenzeitung der World-of-Warcraft-Gilde Eisenfaust');
    expect(Object.keys(result.articles[0].dialekte ?? {})).toEqual(["en", "schwaebisch"]);
    expect(Object.keys(result.mottoDialekte ?? {})).toEqual(["en", "schwaebisch"]);
  } finally {
    for (const [k, v] of [["WEBSITE_LANGUAGES", vorher.sprachen], ["WEBSITE_NEWSPAPER", vorher.zeitung]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

test("KI auf Englisch: englische Wochentage, volle Stunden als 20:00 sind erlaubt", () => {
  const stoss: ZeitungFact[] = [{ kind: "stosszeit", weekday: 4, hour: 20, count: 9 }];
  expect(factsForModel(stoss, ctx, "en")[0]).toMatchObject({ wochentag: "Friday", stunde: "20:00 to 21:00", anmeldungen: 9 });
  expect(factsForModel(stoss, ctx, "de")[0]).toMatchObject({ wochentag: "Freitag", stunde: "20 bis 21 Uhr" });
  const raw = { artikel: [{ nr: 0, schlagzeile: "Friday, 20:00: rush hour", text: "9 logins between 20:00 and 21:00." }], spruch: "First come, first served." };
  expect(validateModelOutput(raw, stoss, ctx).articles[0].headline).toBe("Friday, 20:00: rush hour");
});
