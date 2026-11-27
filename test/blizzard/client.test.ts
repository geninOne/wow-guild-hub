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

/** Fake fetch: token endpoint and API controllable separately, all calls are recorded. */
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
    clientId: "my-id",
    clientSecret: extra.secret ?? "secret",
    region: "eu",
    locale: "de_DE",
    fetch: fetchFn,
    now: extra.now,
  });
}

test("builds URL with namespace and locale and sends bearer token", async () => {
  const f = fakeFetch({ api: () => json(200, { name: "Bärenklaue" }) });
  const r = await client(f.fetchFn).get("/data/wow/guild/b%C3%A4renklaue", "profile");
  expect(r).toEqual({ status: 200, data: { name: "Bärenklaue" } });
  const [api] = f.apiCalls();
  expect(api.url).toBe("https://eu.api.blizzard.com/data/wow/guild/b%C3%A4renklaue?namespace=profile-forever-eu&locale=de_DE");
  expect(api.headers.authorization).toBe("Bearer tok1");
});

test("token is fetched via client credentials with basic auth", async () => {
  const f = fakeFetch({});
  await client(f.fetchFn).get("/x", "static");
  const [tok] = f.tokenCalls();
  expect(tok.method).toBe("POST");
  expect(tok.headers.authorization).toBe("Basic " + Buffer.from("my-id:secret").toString("base64"));
  expect(tok.body).toBe("grant_type=client_credentials");
});

test("href from a response is requested with the given namespace", async () => {
  const f = fakeFetch({});
  await client(f.fetchFn).get(
    "https://eu.api.blizzard.com/data/wow/playable-class/2?namespace=static-1.60.1_70399-forever-eu",
    "static",
  );
  expect(f.apiCalls()[0].url).toBe(
    "https://eu.api.blizzard.com/data/wow/playable-class/2?namespace=static-forever-eu&locale=de_DE",
  );
});

test("retail namespace for instance images without forever", async () => {
  const f = fakeFetch({});
  await client(f.fetchFn).get("/data/wow/media/journal-instance/63", "static-retail");
  expect(f.apiCalls()[0].url).toBe(
    "https://eu.api.blizzard.com/data/wow/media/journal-instance/63?namespace=static-eu&locale=de_DE",
  );
});

test("token is reused and only fetched again after expiry", async () => {
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

test("on 401 the token is renewed once and the request is repeated", async () => {
  let n = 0;
  const f = fakeFetch({ api: () => (++n === 1 ? json(401, {}) : json(200, { ok: 1 })) });
  const r = await client(f.fetchFn).get("/a", "static");
  expect(r).toEqual({ status: 200, data: { ok: 1 } });
  expect(f.tokenCalls()).toHaveLength(2);
  expect(f.apiCalls()[1].headers.authorization).toBe("Bearer tok2");
});

test("404 is returned as a result, not thrown", async () => {
  const f = fakeFetch({ api: () => json(404, { code: 404 }) });
  const r = await client(f.fetchFn).get("/profile/wow/character/seeroth-totenglanz", "profile");
  expect(r.status).toBe(404);
});

test("body without JSON yields data null", async () => {
  const f = fakeFetch({ api: () => new Response("<html>broken</html>", { status: 502 }) });
  expect(await client(f.fetchFn).get("/a", "static")).toEqual({ status: 502, data: null });
});

test("failed token request: BlizzardError without secret in the text", async () => {
  const f = fakeFetch({ token: () => json(401, { error: "unauthorized" }) });
  const c = client(f.fetchFn, { secret: "SUPERSECRET" });
  const err = await c.get("/x", "static").catch((e: unknown) => e);
  expect(err).toBeInstanceOf(BlizzardError);
  expect((err as Error).message).toContain("Token request failed: HTTP 401");
  expect((err as Error).message).not.toContain("SUPERSECRET");
});

test("network error: BlizzardError without token and secret in the text", async () => {
  const f = fakeFetch({
    api: (call) => {
      throw new Error(`connect failed ${call.headers.authorization}`);
    },
  });
  const c = client(f.fetchFn, { secret: "SUPERSECRET" });
  const err = await c.get("/data/wow/guild/x", "profile").catch((e: unknown) => e);
  expect(err).toBeInstanceOf(BlizzardError);
  const text = String((err as Error).message) + String((err as Error).stack) + JSON.stringify(err);
  expect(text).toContain("/data/wow/guild/x");
  expect(text).not.toContain("tok1");
  expect(text).not.toContain("SUPERSECRET");
});

test("hanging request aborts after the timeout with BlizzardError, without token in the text", async () => {
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    if (String(input) === TOKEN_URL) return json(200, { access_token: "tok1", expires_in: 86400 });
    return new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error(`aborted ${new Headers(init.headers).get("authorization")}`)));
    });
  }) as typeof fetch;
  const c = createBlizzardClient({ clientId: "i", clientSecret: "SUPERSECRET", region: "eu", locale: "de_DE", fetch: fetchFn, requestTimeoutMs: 50 });
  const startedAt = Date.now();
  const err = await c.get("/profile/wow/character/x", "profile").catch((e: unknown) => e);
  expect(Date.now() - startedAt).toBeLessThan(2000);
  expect(err).toBeInstanceOf(BlizzardError);
  expect((err as Error).message).toContain("/profile/wow/character/x");
  expect((err as Error).message).not.toContain("tok1");
});

test("rate limit: at most n requests per second", async () => {
  const f = fakeFetch({});
  const c = createBlizzardClient({ clientId: "i", clientSecret: "s", region: "eu", locale: "de_DE", fetch: f.fetchFn, maxRequestsPerSecond: 20 });
  const startedAt = Date.now();
  await Promise.all([1, 2, 3, 4, 5].map((n) => c.get(`/a${n}`, "static")));
  expect(Date.now() - startedAt).toBeGreaterThanOrEqual(190);
  expect(f.apiCalls()).toHaveLength(5);
});

test("concurrent requests without a token share one token request", async () => {
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

test("concurrent 401s renew the token only once", async () => {
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

test("after a failed token request the next call tries again", async () => {
  let n = 0;
  const f = fakeFetch({ token: () => (++n === 1 ? json(500, {}) : json(200, { access_token: "tok2", expires_in: 86400 })) });
  const c = client(f.fetchFn);
  await expect(c.get("/a", "static")).rejects.toBeInstanceOf(BlizzardError);
  expect((await c.get("/b", "static")).status).toBe(200);
  expect(f.tokenCalls()).toHaveLength(2);
});
