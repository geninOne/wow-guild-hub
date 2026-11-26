import { expect, test } from "vitest";
import { BlizzardError, createBlizzardClient } from "../../src/blizzard/client";

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
}

type Responder = (call: Call) => Response | Promise<Response>;

const TOKEN_URL = "https://oauth.battle.net/token";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Fake-fetch: Token-Endpunkt und API getrennt steuerbar, alle Aufrufe werden aufgezeichnet. */
function fakeFetch(opts: { token?: Responder; api?: Responder }) {
  const calls: Call[] = [];
  let tokenCount = 0;
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const call: Call = {
      url: String(input),
      method: init?.method ?? "GET",
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: init?.body ? String(init.body) : null,
    };
    calls.push(call);
    if (call.url === TOKEN_URL) {
      tokenCount++;
      return opts.token ? opts.token(call) : json(200, { access_token: `tok${tokenCount}`, expires_in: 86400 });
    }
    return opts.api ? opts.api(call) : json(200, { ok: true });
  }) as typeof fetch;
  return { fetchFn, calls, apiCalls: () => calls.filter((c) => c.url !== TOKEN_URL), tokenCalls: () => calls.filter((c) => c.url === TOKEN_URL) };
}

function client(fetchFn: typeof fetch, extra: { now?: () => number; secret?: string } = {}) {
  return createBlizzardClient({
    clientId: "meine-id",
    clientSecret: extra.secret ?? "geheim",
    region: "eu",
    locale: "de_DE",
    fetch: fetchFn,
    now: extra.now,
  });
}

test("baut URL mit Namespace und Locale und sendet Bearer-Token", async () => {
  const f = fakeFetch({ api: () => json(200, { name: "Bärenklaue" }) });
  const r = await client(f.fetchFn).get("/data/wow/guild/b%C3%A4renklaue", "profile");
  expect(r).toEqual({ status: 200, data: { name: "Bärenklaue" } });
  const [api] = f.apiCalls();
  expect(api.url).toBe("https://eu.api.blizzard.com/data/wow/guild/b%C3%A4renklaue?namespace=profile-forever-eu&locale=de_DE");
  expect(api.headers.authorization).toBe("Bearer tok1");
});

test("Token wird per Client Credentials mit Basic-Auth geholt", async () => {
  const f = fakeFetch({});
  await client(f.fetchFn).get("/x", "static");
  const [tok] = f.tokenCalls();
  expect(tok.method).toBe("POST");
  expect(tok.headers.authorization).toBe("Basic " + Buffer.from("meine-id:geheim").toString("base64"));
  expect(tok.body).toBe("grant_type=client_credentials");
});

test("href aus einer Antwort wird mit dem angegebenen Namespace abgefragt", async () => {
  const f = fakeFetch({});
  await client(f.fetchFn).get(
    "https://eu.api.blizzard.com/data/wow/playable-class/2?namespace=static-1.60.1_70399-forever-eu",
    "static",
  );
  expect(f.apiCalls()[0].url).toBe(
    "https://eu.api.blizzard.com/data/wow/playable-class/2?namespace=static-forever-eu&locale=de_DE",
  );
});

test("Retail-Namespace für Instanzbilder ohne forever", async () => {
  const f = fakeFetch({});
  await client(f.fetchFn).get("/data/wow/media/journal-instance/63", "static-retail");
  expect(f.apiCalls()[0].url).toBe(
    "https://eu.api.blizzard.com/data/wow/media/journal-instance/63?namespace=static-eu&locale=de_DE",
  );
});

test("Token wird wiederverwendet und erst nach Ablauf neu geholt", async () => {
  let t = 0;
  const f = fakeFetch({});
  const c = client(f.fetchFn, { now: () => t });
  await c.get("/a", "static");
  await c.get("/b", "static");
  expect(f.tokenCalls()).toHaveLength(1);
  t = 86400 * 1000;
  await c.get("/c", "static");
  expect(f.tokenCalls()).toHaveLength(2);
  expect(f.apiCalls()[2].headers.authorization).toBe("Bearer tok2");
});

test("bei 401 wird das Token einmal erneuert und die Anfrage wiederholt", async () => {
  let n = 0;
  const f = fakeFetch({ api: () => (++n === 1 ? json(401, {}) : json(200, { ok: 1 })) });
  const r = await client(f.fetchFn).get("/a", "static");
  expect(r).toEqual({ status: 200, data: { ok: 1 } });
  expect(f.tokenCalls()).toHaveLength(2);
  expect(f.apiCalls()[1].headers.authorization).toBe("Bearer tok2");
});

test("404 wird als Ergebnis zurückgegeben, nicht geworfen", async () => {
  const f = fakeFetch({ api: () => json(404, { code: 404 }) });
  const r = await client(f.fetchFn).get("/profile/wow/character/seeroth-totenglanz", "profile");
  expect(r.status).toBe(404);
});

test("Body ohne JSON ergibt data null", async () => {
  const f = fakeFetch({ api: () => new Response("<html>kaputt</html>", { status: 502 }) });
  expect(await client(f.fetchFn).get("/a", "static")).toEqual({ status: 502, data: null });
});

test("gescheiterter Token-Abruf: BlizzardError ohne Secret im Text", async () => {
  const f = fakeFetch({ token: () => json(401, { error: "unauthorized" }) });
  const c = client(f.fetchFn, { secret: "SUPERGEHEIM" });
  const err = await c.get("/x", "static").catch((e: unknown) => e);
  expect(err).toBeInstanceOf(BlizzardError);
  expect((err as Error).message).toContain("Token-Abruf fehlgeschlagen: HTTP 401");
  expect((err as Error).message).not.toContain("SUPERGEHEIM");
});

test("Netzwerkfehler: BlizzardError ohne Token und Secret im Text", async () => {
  const f = fakeFetch({
    api: (call) => {
      throw new Error(`connect failed ${call.headers.authorization}`);
    },
  });
  const c = client(f.fetchFn, { secret: "SUPERGEHEIM" });
  const err = await c.get("/data/wow/guild/x", "profile").catch((e: unknown) => e);
  expect(err).toBeInstanceOf(BlizzardError);
  const text = String((err as Error).message) + String((err as Error).stack) + JSON.stringify(err);
  expect(text).toContain("/data/wow/guild/x");
  expect(text).not.toContain("tok1");
  expect(text).not.toContain("SUPERGEHEIM");
});

test("hängende Anfrage bricht nach dem Timeout mit BlizzardError ab, ohne Token im Text", async () => {
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    if (String(input) === TOKEN_URL) return json(200, { access_token: "tok1", expires_in: 86400 });
    return new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error(`aborted ${new Headers(init.headers).get("authorization")}`)));
    });
  }) as typeof fetch;
  const c = createBlizzardClient({ clientId: "i", clientSecret: "SUPERGEHEIM", region: "eu", locale: "de_DE", fetch: fetchFn, requestTimeoutMs: 50 });
  const startedAt = Date.now();
  const err = await c.get("/profile/wow/character/x", "profile").catch((e: unknown) => e);
  expect(Date.now() - startedAt).toBeLessThan(2000);
  expect(err).toBeInstanceOf(BlizzardError);
  expect((err as Error).message).toContain("/profile/wow/character/x");
  expect((err as Error).message).not.toContain("tok1");
});

test("Ratenbegrenzung: höchstens n Anfragen pro Sekunde", async () => {
  const f = fakeFetch({});
  const c = createBlizzardClient({ clientId: "i", clientSecret: "s", region: "eu", locale: "de_DE", fetch: f.fetchFn, maxRequestsPerSecond: 20 });
  const startedAt = Date.now();
  await Promise.all([1, 2, 3, 4, 5].map((n) => c.get(`/a${n}`, "static")));
  expect(Date.now() - startedAt).toBeGreaterThanOrEqual(190);
  expect(f.apiCalls()).toHaveLength(5);
});

test("gleichzeitige Anfragen ohne Token teilen sich einen Token-Abruf", async () => {
  const f = fakeFetch({
    token: async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return json(200, { access_token: "tok1", expires_in: 86400 });
    },
  });
  const c = client(f.fetchFn);
  await Promise.all([1, 2, 3, 4, 5].map((n) => c.get(`/a${n}`, "static")));
  expect(f.tokenCalls()).toHaveLength(1);
  expect(f.apiCalls().every((a) => a.headers.authorization === "Bearer tok1")).toBe(true);
});

test("gleichzeitige 401 erneuern das Token nur einmal", async () => {
  const f = fakeFetch({
    token: async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return json(200, { access_token: `tok${f.tokenCalls().length}`, expires_in: 86400 });
    },
    api: (call) => (call.headers.authorization === "Bearer tok1" ? json(401, {}) : json(200, { ok: 1 })),
  });
  const c = client(f.fetchFn);
  const results = await Promise.all([1, 2, 3].map((n) => c.get(`/a${n}`, "static")));
  expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
  expect(f.tokenCalls()).toHaveLength(2);
});

test("nach gescheitertem Token-Abruf wird beim nächsten Mal neu versucht", async () => {
  let n = 0;
  const f = fakeFetch({ token: () => (++n === 1 ? json(500, {}) : json(200, { access_token: "tok2", expires_in: 86400 })) });
  const c = client(f.fetchFn);
  await expect(c.get("/a", "static")).rejects.toBeInstanceOf(BlizzardError);
  expect((await c.get("/b", "static")).status).toBe(200);
  expect(f.tokenCalls()).toHaveLength(2);
});
