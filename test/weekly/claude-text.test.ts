import { expect, onTestFinished, test, vi } from "vitest";
import type { NewspaperFact } from "../../src/weekly/newspaper-facts";
import {
  createClaudeGenerator, factsForModel, generatorFromEnv, mentionedNames, withoutEmDashes, SYSTEM_PROMPT, systemPrompt,
  jsonFromText, validateModelOutput, type MessagesClient,
} from "../../src/weekly/claude-text";
import { phraseGenerator } from "../../src/weekly/newspaper-text";
import { LANGUAGES } from "../../src/language";

const FACTS: NewspaperFact[] = [
  { kind: "sprung", characterId: 1, levels: 7, from: 20, to: 27, title: null },
  { kind: "titel", titleId: "pechvogel", characterId: 2, value: 9 },
  { kind: "zahl", value: 42, what: "level" },
];
const names: Record<number, string> = { 1: "Anna", 2: "Bodo", 3: "Cleo" };
const ctx = { week: "2026-W46", name: (id: number) => names[id], allNames: ["Anna", "Bodo", "Cleo"] };
/** Like an installation with all languages (WEBSITE_LANGUAGES=de,schwaebisch,bayrisch,en). */
const ctxAll = { ...ctx, languages: LANGUAGES };

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

test("a valid response is taken over, em dashes are replaced, section and characters come from the facts", async () => {
  const { client, create } = fakeClient(good);
  const result = await createClaudeGenerator({ client, log: () => {} })(FACTS, ctxAll);
  expect(result).toMatchObject({ generator: "claude", model: "anthropic-router", motto: "No ned hudla." });
  expect(result.fallback).toBeUndefined();
  const first = { headline: "Anna fliegt von 20 auf 27", text: "Sieben Level? Nein, 7 Level! Heilig's Blechle, gell." };
  expect(result.articles[0]).toEqual({
    kind: "sprung", section: "Aufsteiger", ...first, characterIds: [1], dialekte: { en: first, schwaebisch: first, bayrisch: first },
  });
  expect(result.mottoDialekte).toEqual({ en: "No ned hudla.", schwaebisch: "No ned hudla.", bayrisch: "No ned hudla." });
  expect(result.articles[1].text).toBe("9 Tode, der Geistheiler grüßt.");
  expect(result.articles[2]).toMatchObject({ section: "Zahl der Woche", characterIds: [] });

  // One call per language version with the configured model, without Anthropic betas, server fallback or output_config
  expect(create).toHaveBeenCalledTimes(4);
  const systems = create.mock.calls.map((c) => (c[0] as { system: string }).system);
  expect(systems).toEqual([systemPrompt("de"), systemPrompt("en"), systemPrompt("schwaebisch"), systemPrompt("bayrisch")]);
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
  ["foreign name", { ...good, artikel: [good.artikel[0], { nr: 1, schlagzeile: "Bodo und Cleo", text: "Zusammen 9 Tode." }, good.artikel[2]] }, /foreign names: Cleo/],
  ["name from another fact", { ...good, artikel: [good.artikel[0], { nr: 1, schlagzeile: "Bodo schlägt Anna", text: "9 Tode." }, good.artikel[2]] }, /foreign names: Anna/],
  ["invented number", { ...good, artikel: [{ nr: 0, schlagzeile: "Anna, 13 Level", text: "Wow, gell." }, good.artikel[1], good.artikel[2]] }, /numbers.*13/],
  ["too few articles", { ...good, artikel: good.artikel.slice(0, 2) }, /2 articles for 3 facts/],
  ["wrong format", { text: "hallo" }, /format/],
  ["motto with a name", { ...good, spruch: "Anna, no ned hudla." }, /Motto/],
])("validation rejects: %s", (_label, raw, error) => {
  expect(() => validateModelOutput(raw, FACTS, ctx)).toThrow(error);
});

test.each([
  ["network error", () => { throw new Error("connect ECONNREFUSED"); }],
  ["refusal", () => ({ stop_reason: "refusal", content: [], model: "x" })],
  ["truncated", () => ({ stop_reason: "max_tokens", content: [{ type: "text", text: "{" }], model: "x" })],
  ["no JSON", () => ({ stop_reason: "end_turn", content: [{ type: "text", text: "no json" }], model: "x" })],
  ["broken JSON", () => ({ stop_reason: "end_turn", content: [{ type: "text", text: '{"artikel": [}' }], model: "x" })],
  ["empty response without content", () => ({ stop_reason: "end_turn", model: "x" })],
  ["foreign name", () => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ ...good, spruch: "Cleo!" }) }], model: "x" })],
])("fallback to the phrases on %s", async (_label, reply) => {
  const client = { messages: { create: vi.fn(async () => reply()) } } as unknown as MessagesClient;
  const log = vi.fn();
  const result = await createClaudeGenerator({ client, log })(FACTS, ctx);
  const plain = await phraseGenerator(FACTS, ctx);
  expect(result).toEqual({ ...plain, fallback: expect.any(String) });
  expect(log).toHaveBeenCalledTimes(1);
});

test("if only one dialect fails, the phrases step in for it, the rest stays from Claude", async () => {
  const create = vi.fn(async (params: { system: string }) => {
    if (params.system.includes("auf Bayrisch")) throw new Error("Timeout");
    return { model: "claude-opus-5-5", stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(good) }] };
  });
  const client = { messages: { create } } as unknown as MessagesClient;
  const log = vi.fn();
  const result = await createClaudeGenerator({ client, log })(FACTS, ctxAll);
  const plain = await phraseGenerator(FACTS, ctxAll);
  expect(result.generator).toBe("claude");
  expect(result.fallback).toBe("bayrisch: Timeout");
  expect(log).toHaveBeenCalledTimes(1);
  expect(result.articles[0].headline).toBe("Anna fliegt von 20 auf 27");
  expect(result.articles[0].dialekte?.schwaebisch?.headline).toBe("Anna fliegt von 20 auf 27");
  expect(result.articles[0].dialekte?.bayrisch).toEqual(plain.articles[0].dialekte?.bayrisch);
  expect(result.mottoDialekte?.bayrisch).toBe(plain.mottoDialekte?.bayrisch);
});

test("a response in a code block with a sentence before it is still read", async () => {
  const { client } = fakeClient(`Sure, here is the newspaper:\n\`\`\`json\n${JSON.stringify(good)}\n\`\`\``);
  const result = await createClaudeGenerator({ client, log: () => {} })(FACTS, ctx);
  expect(result.generator).toBe("claude");
  expect(result.fallback).toBeUndefined();
  expect(jsonFromText('before {"a": 1} after')).toEqual({ a: 1 });
  expect(() => jsonFromText("nothing at all")).toThrow(/no JSON object/);
  expect(() => jsonFromText("{ not json }")).toThrow(/not valid JSON/);
});

test("output_config only when switched on", async () => {
  const { client, create } = fakeClient(good);
  await createClaudeGenerator({ client, log: () => {}, outputConfig: true, effort: "medium" })(FACTS, ctx);
  expect(create.mock.calls[0][0]).toMatchObject({ output_config: { effort: "medium", format: { type: "json_schema" } } });
  expect(create.mock.calls[0][0]).not.toHaveProperty("betas");
});

/** Fake fetch for the real SDK client: records the requests and replies like the Messages API. */
function fakeFetch(text = JSON.stringify(good)) {
  const requests: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
  const fetchFn = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = input instanceof Request ? input.url : String(input);
    requests.push({ url, headers: new Headers(init.headers), body: JSON.parse(String(init.body)) });
    return Response.json({
      id: "msg_1", type: "message", role: "assistant", model: "router-reply", stop_reason: "end_turn", stop_sequence: null,
      content: [{ type: "text", text }], usage: { input_tokens: 1, output_tokens: 1 },
    });
  });
  return { requests, fetchFn: fetchFn as unknown as typeof fetch };
}

test("generatorFromEnv: ANTHROPIC_API_KEY and ANTHROPIC_BASE_URL alone lead to the phrases", () => {
  const netlify = { ANTHROPIC_API_KEY: "netlify-key", ANTHROPIC_BASE_URL: "https://netlify.example/anthropic" };
  expect(generatorFromEnv({})).toBe(phraseGenerator);
  expect(generatorFromEnv(netlify)).toBe(phraseGenerator);
  expect(generatorFromEnv({ ...netlify, NEWSPAPER_AI_URL: "https://gateway.example" })).toBe(phraseGenerator);
  expect(generatorFromEnv({ ...netlify, NEWSPAPER_AI_KEY: "own-key" })).toBe(phraseGenerator);
  expect(generatorFromEnv({ NEWSPAPER_AI_URL: " ", NEWSPAPER_AI_KEY: "own-key" })).toBe(phraseGenerator);
});

test("generatorFromEnv: with our own variables, base URL, x-api-key and model go to the gateway, never to Netlify", async () => {
  vi.stubEnv("WEBSITE_LANGUAGES", "");
  onTestFinished(() => {
    vi.unstubAllEnvs();
  });
  const { requests, fetchFn } = fakeFetch();
  const env = {
    ANTHROPIC_API_KEY: "netlify-key",
    ANTHROPIC_BASE_URL: "https://netlify.example/anthropic",
    ANTHROPIC_AUTH_TOKEN: "netlify-token",
    NEWSPAPER_AI_URL: "https://gateway.example/claude",
    NEWSPAPER_AI_KEY: "own-key",
    NEWSPAPER_AI_MODEL: "my-router",
  };
  const result = await generatorFromEnv(env, { fetch: fetchFn })(FACTS, ctx);
  expect(result).toMatchObject({ generator: "claude", model: "router-reply" });
  expect(result.fallback).toBeUndefined();
  // Without WEBSITE_LANGUAGES only German and English: no paid dialect calls
  expect(requests).toHaveLength(2);
  for (const a of requests) {
    expect(a.url).toBe("https://gateway.example/claude/v1/messages");
    expect(a.headers.get("x-api-key")).toBe("own-key");
    expect(a.headers.get("authorization")).toBeNull();
    expect(a.headers.get("anthropic-beta")).toBeNull();
    expect(a.body).toMatchObject({ model: "my-router" });
    expect(a.body).not.toHaveProperty("output_config");
    expect(a.body).not.toHaveProperty("fallbacks");
    expect(JSON.stringify([...a.headers])).not.toContain("netlify");
  }
});

test("generatorFromEnv: default model anthropic-router, output_config only with NEWSPAPER_AI_OUTPUT_CONFIG=on", async () => {
  const base = { NEWSPAPER_AI_URL: "https://gateway.example", NEWSPAPER_AI_KEY: "own-key" };
  const without = fakeFetch();
  await generatorFromEnv(base, { fetch: without.fetchFn })(FACTS, ctx);
  expect(without.requests[0].body).toMatchObject({ model: "anthropic-router" });
  expect(without.requests[0].body).not.toHaveProperty("output_config");

  const withConfig = fakeFetch();
  await generatorFromEnv({ ...base, NEWSPAPER_AI_OUTPUT_CONFIG: "on", NEWSPAPER_AI_EFFORT: "high" }, { fetch: withConfig.fetchFn })(FACTS, ctx);
  expect(withConfig.requests[0].body).toMatchObject({ output_config: { effort: "high", format: { type: "json_schema" } } });
});

test("generatorFromEnv: an invalid gateway response leads to the fallback", async () => {
  const { fetchFn } = fakeFetch("Sorry, no JSON today.");
  const log = vi.spyOn(console, "warn").mockImplementation(() => {});
  const result = await generatorFromEnv({ NEWSPAPER_AI_URL: "https://gateway.example", NEWSPAPER_AI_KEY: "s" }, { fetch: fetchFn })(FACTS, ctx);
  expect(result).toEqual({ ...(await phraseGenerator(FACTS, ctx)), fallback: expect.stringContaining("JSON") });
  expect(log).toHaveBeenCalledTimes(1);
  log.mockRestore();
});

test("helpers: name search by whole words, em dashes, facts for the model", () => {
  expect(mentionedNames("Annabell und Bodo", ["Anna", "Bodo"])).toEqual(["Bodo"]);
  expect(mentionedNames("Ännchen trifft Än", ["Än"])).toEqual(["Än"]);
  expect(withoutEmDashes("A — B – C")).toBe("A, B, C");
  const model = factsForModel(FACTS, ctx) as Record<string, unknown>[];
  expect(model[0]).toMatchObject({ nr: 0, rubrik: "Aufmacher", charakter: "Anna", level_gewonnen: 7 });
  expect(model[1]).toMatchObject({ rubrik: "Friedhof", titel: "Pechvogel", wert: "9 Tode" });
  expect(JSON.stringify(model)).not.toMatch(/characterId/);
  const bavarian = factsForModel([{ kind: "titel", titleId: "kaepsele", characterId: 2, value: 4 }], ctx, "bayrisch") as Record<string, unknown>[];
  expect(bavarian[0]).toMatchObject({ titel: "Gscheithaferl", wert: "4 neie Erfolge" });
});

test("the latest issues are in the call, a verbatim repetition leads to the fallback", async () => {
  const recent = [{
    week: "2026-W45", bausteine: [], headlines: ["Bodo und der Boden"], texts: ["Der Geistheiler kennt Bodo beim Vornamen."],
    motto: "No ned hudla.",
  }];
  const fresh = {
    artikel: [
      { nr: 0, schlagzeile: "Anna fliegt von 20 auf 27", text: "Heilig's Blechle, gell." },
      { nr: 1, schlagzeile: "Bodo trifft den Boden", text: "9 Tode. Der Friedhof hat jetzt Stammkundschaft." },
      { nr: 2, schlagzeile: "42", text: "So viele Level hat die Gilde gesammelt." },
    ],
    spruch: "Wer ko, der ko.",
  };
  const { client, create } = fakeClient(fresh);
  const ok = await createClaudeGenerator({ client, log: () => {} })(FACTS, { ...ctx, recent });
  expect(ok.generator).toBe("claude");
  const content = ((create.mock.calls[0][0] as { messages: { content: string }[] }).messages)[0].content;
  expect(content).toContain("Bereits erschienen");
  expect(content).toContain("Der Geistheiler kennt Bodo beim Vornamen.");
  expect(SYSTEM_PROMPT).toContain("Wiederhole daraus keine Formulierungen");

  // The same sentence with another name counts as a repetition
  const repeated = { ...fresh, artikel: [fresh.artikel[0], { nr: 1, schlagzeile: "Bodo", text: "Der Geistheiler kennt Bodo beim Vornamen." }, fresh.artikel[2]] };
  const { client: c2 } = fakeClient(repeated);
  const fellBack = await createClaudeGenerator({ client: c2, log: () => {} })(FACTS, { ...ctx, recent });
  expect(fellBack).toMatchObject({ generator: "bausteine", fallback: expect.stringContaining("earlier issue") });
  const { client: c3 } = fakeClient({ ...fresh, spruch: "No ned hudla." });
  expect((await createClaudeGenerator({ client: c3, log: () => {} })(FACTS, { ...ctx, recent })).fallback).toMatch(/Motto/);
});

test("system prompt: newspaper name and guilds from the frame, no fixed guild by default", () => {
  expect(SYSTEM_PROMPT).not.toMatch(/Bärenklaue|Gildeblatt/);
  expect(SYSTEM_PROMPT).toContain('"Gildenblatt", die Wochenzeitung einer World-of-Warcraft-Gilde');
  expect(systemPrompt("en")).toContain('"Guild Gazette"');
  expect(systemPrompt("schwaebisch")).toContain('"Gildeblatt"');
  const framed = systemPrompt("en", false, { zeitung: "Die Gildenpost", gilden: ["Eisenfaust", "Silberhand"] });
  expect(framed).toContain('"Die Gildenpost", die Wochenzeitung der World-of-Warcraft-Gilden Eisenfaust und Silberhand');
  expect(systemPrompt("de", false, { gilden: ["Eisenfaust"] })).toContain("der World-of-Warcraft-Gilde Eisenfaust.");
});

test("AI: English is always added, dialects only with WEBSITE_LANGUAGES; WEBSITE_NEWSPAPER and guilds end up in the prompt", async () => {
  const before = { languages: process.env.WEBSITE_LANGUAGES, newspaper: process.env.WEBSITE_NEWSPAPER };
  try {
    process.env.WEBSITE_LANGUAGES = "de,schwaebisch";
    process.env.WEBSITE_NEWSPAPER = "Bärenklaue-Blatt";
    const { client, create } = fakeClient(good);
    const result = await createClaudeGenerator({ client, log: () => {} })(FACTS, { ...ctx, gilden: ["Eisenfaust"] });
    const systems = create.mock.calls.map((c) => (c[0] as { system: string }).system);
    expect(systems).toHaveLength(3);
    expect(systems[1]).toContain("auf Englisch");
    expect(systems[2]).toContain("auf Schwäbisch");
    for (const sys of systems) expect(sys).toContain('"Bärenklaue-Blatt", die Wochenzeitung der World-of-Warcraft-Gilde Eisenfaust');
    expect(Object.keys(result.articles[0].dialekte ?? {})).toEqual(["en", "schwaebisch"]);
    expect(Object.keys(result.mottoDialekte ?? {})).toEqual(["en", "schwaebisch"]);
  } finally {
    for (const [k, v] of [["WEBSITE_LANGUAGES", before.languages], ["WEBSITE_NEWSPAPER", before.newspaper]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

test("AI in English: English weekdays, full hours as 20:00 are allowed", () => {
  const rush: NewspaperFact[] = [{ kind: "stosszeit", weekday: 4, hour: 20, count: 9 }];
  expect(factsForModel(rush, ctx, "en")[0]).toMatchObject({ wochentag: "Friday", stunde: "20:00 to 21:00", anmeldungen: 9 });
  expect(factsForModel(rush, ctx, "de")[0]).toMatchObject({ wochentag: "Freitag", stunde: "20 bis 21 Uhr" });
  const raw = { artikel: [{ nr: 0, schlagzeile: "Friday, 20:00: rush hour", text: "9 logins between 20:00 and 21:00." }], spruch: "First come, first served." };
  expect(validateModelOutput(raw, rush, ctx).articles[0].headline).toBe("Friday, 20:00: rush hour");
});
