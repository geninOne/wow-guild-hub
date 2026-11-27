import { describe, expect, test } from "vitest";
import {
  NETLIFY_VARIABLES,
  WEBSITE_VARIABLES,
  setVariables,
  variablesFromEnvFile,
  variablesFromEnvironment,
} from "../../scripts/netlify-env-lib.mjs";

const ENV = `# Comment
BNET_CLIENT_ID=id-value-123
BNET_CLIENT_SECRET="secret value"
GUILD_SLUGS=bärenklaue,goldene-bärenklaue
BNET_REGION=eu
BNET_LOCALE=
COLLECT_CONCURRENCY=10
LOCAL_SCHEDULER=on
LOCAL_SCHEDULER_GUILD_MINUTES=60
FOREIGN=x
`;

describe("variablesFromEnvFile", () => {
  test("takes only the Netlify variables with a value, without the scheduler", () => {
    expect(variablesFromEnvFile(ENV)).toEqual([
      { key: "BNET_CLIENT_ID", value: "id-value-123" },
      { key: "BNET_CLIENT_SECRET", value: "secret value" },
      { key: "GUILD_SLUGS", value: "bärenklaue,goldene-bärenklaue" },
      { key: "BNET_REGION", value: "eu" },
      { key: "COLLECT_CONCURRENCY", value: "10" },
    ]);
  });

  test("the list matches the spec", () => {
    expect(NETLIFY_VARIABLES).toEqual([
      "BNET_CLIENT_ID",
      "BNET_CLIENT_SECRET",
      "GUILD_SLUGS",
      "GUILD_RANKS",
      "TWINK_RANKS",
      "TITLE_OPT_OUTS",
      "WOW_VERSION",
      "BNET_REGION",
      "BNET_LOCALE",
      "COLLECT_CONCURRENCY",
      "COLLECT_BUDGET_MS",
      "NEWSPAPER_AI_URL",
      "NEWSPAPER_AI_KEY",
      "NEWSPAPER_AI_MODEL",
      "NEWSPAPER_AI_EFFORT",
      "NEWSPAPER_AI_OUTPUT_CONFIG",
      ...WEBSITE_VARIABLES,
    ]);
    expect(WEBSITE_VARIABLES.every((v) => v.startsWith("WEBSITE_"))).toBe(true);
    expect(NETLIFY_VARIABLES).not.toContain("ANTHROPIC_API_KEY");
  });

  test("AI variables are included when they have a value", () => {
    const keys = variablesFromEnvFile(`${ENV}NEWSPAPER_AI_URL=https://gateway.example\nNEWSPAPER_AI_KEY=\nANTHROPIC_API_KEY=x\n`).map((v) => v.key);
    expect(keys).toContain("NEWSPAPER_AI_URL");
    expect(keys).not.toContain("NEWSPAPER_AI_KEY");
    expect(keys).not.toContain("ANTHROPIC_API_KEY");
  });
});

describe("variablesFromEnvironment", () => {
  test("credentials from the environment, unset or empty settings with their default", () => {
    expect(
      variablesFromEnvironment({
        BNET_CLIENT_ID: "id-value-123",
        BNET_CLIENT_SECRET: "secret value",
        GUILD_SLUGS: "my-guild",
        GUILD_RANKS: "",
        BNET_REGION: "us",
        COLLECT_BUDGET_MS: "15000",
        LOCAL_SCHEDULER: "on",
      }),
    ).toEqual([
      { key: "BNET_CLIENT_ID", value: "id-value-123" },
      { key: "BNET_CLIENT_SECRET", value: "secret value" },
      { key: "GUILD_SLUGS", value: "my-guild" },
      { key: "BNET_REGION", value: "us" },
      { key: "BNET_LOCALE", value: "de_DE" },
      { key: "COLLECT_CONCURRENCY", value: "10" },
      { key: "COLLECT_BUDGET_MS", value: "15000" },
    ]);
  });

  test("AI variables are optional: if missing, they are left out and nothing fails", () => {
    const credentials = { BNET_CLIENT_ID: "id", BNET_CLIENT_SECRET: "secret", GUILD_SLUGS: "g" };
    const without = variablesFromEnvironment({ ...credentials, NEWSPAPER_AI_URL: "", ANTHROPIC_API_KEY: "netlify" }).map((v) => v.key);
    expect(without.filter((k) => k.startsWith("NEWSPAPER_AI") || k.startsWith("ANTHROPIC"))).toEqual([]);
    const withAi = variablesFromEnvironment({ ...credentials, NEWSPAPER_AI_URL: "https://gateway.example", NEWSPAPER_AI_KEY: "s", NEWSPAPER_AI_MODEL: "anthropic-router" });
    expect(withAi.slice(-3)).toEqual([
      { key: "NEWSPAPER_AI_URL", value: "https://gateway.example" },
      { key: "NEWSPAPER_AI_KEY", value: "s" },
      { key: "NEWSPAPER_AI_MODEL", value: "anthropic-router" },
    ]);
  });

  test("missing credentials abort with their names, without values", () => {
    expect(() => variablesFromEnvironment({ BNET_CLIENT_ID: "id-value-123" })).toThrow(/BNET_CLIENT_SECRET/);
    expect(() => variablesFromEnvironment({ BNET_CLIENT_ID: "id-value-123" })).not.toThrow(/id-value-123/);
    expect(() => variablesFromEnvironment({})).toThrow(/BNET_CLIENT_ID, BNET_CLIENT_SECRET, GUILD_SLUGS/);
  });
});

type Call = { method: string; url: string; auth: string | null; body: unknown };

type Existing = { key: string; values: { value?: string; context: string }[] };

function fakeApi(existing: Existing[], failure?: { method: string; status: number }) {
  const calls: Call[] = [];
  const fetchFn = async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = input instanceof Request ? input.url : String(input);
    const method = init.method ?? "GET";
    const headers = new Headers(init.headers);
    calls.push({
      method,
      url,
      auth: headers.get("authorization"),
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    });
    if (failure && failure.method === method) {
      return new Response(JSON.stringify({ message: "broken", echo: init.body }), { status: failure.status });
    }
    if (method === "GET" && url.endsWith("/sites/site-1")) {
      return Response.json({ account_slug: "guild-team", account_id: "acc-9" });
    }
    if (method === "GET") return Response.json(existing);
    return Response.json(method === "POST" ? [] : {});
  };
  return { calls, fetchFn };
}

const VARIABLES = [
  { key: "BNET_CLIENT_ID", value: "id-value-123" },
  { key: "BNET_CLIENT_SECRET", value: "secret value" },
];

describe("setVariables", () => {
  test("creates new ones, changes differing ones and leaves identical ones unchanged", async () => {
    const { calls, fetchFn } = fakeApi([
      { key: "BNET_CLIENT_SECRET", values: [{ value: "old value", context: "all" }] },
      { key: "BNET_REGION", values: [{ value: "eu", context: "all" }] },
      { key: "OTHER", values: [{ value: "x", context: "all" }] },
    ]);
    const log: string[] = [];
    await setVariables({
      siteId: "site-1",
      token: "tok-xyz",
      variables: [...VARIABLES, { key: "BNET_REGION", value: "eu" }],
      fetchFn,
      log: (line: string) => log.push(line),
    });

    expect(calls.map((a) => `${a.method} ${a.url}`)).toEqual([
      "GET https://api.netlify.com/api/v1/sites/site-1",
      "GET https://api.netlify.com/api/v1/accounts/guild-team/env?site_id=site-1",
      "PUT https://api.netlify.com/api/v1/accounts/guild-team/env/BNET_CLIENT_SECRET?site_id=site-1",
      "POST https://api.netlify.com/api/v1/accounts/guild-team/env?site_id=site-1",
    ]);
    expect(calls.every((a) => a.auth === "Bearer tok-xyz")).toBe(true);
    expect(calls[2].body).toEqual({ key: "BNET_CLIENT_SECRET", values: [{ value: "secret value", context: "all" }] });
    expect(calls[3].body).toEqual([{ key: "BNET_CLIENT_ID", values: [{ value: "id-value-123", context: "all" }] }]);
    expect(log.join("\n")).toMatch(/BNET_REGION: unchanged/);
  });

  test("a second run with the same values writes nothing", async () => {
    const { calls, fetchFn } = fakeApi(VARIABLES.map(({ key, value }) => ({ key, values: [{ value, context: "all" }] })));
    await setVariables({ siteId: "site-1", token: "tok-xyz", variables: VARIABLES, fetchFn, log: () => {} });
    expect(calls.map((a) => a.method)).toEqual(["GET", "GET"]);
  });

  test("values in several contexts are replaced by one value for all", async () => {
    const { calls, fetchFn } = fakeApi([
      {
        key: "BNET_CLIENT_ID",
        values: [
          { value: "id-value-123", context: "production" },
          { value: "different", context: "dev" },
        ],
      },
    ]);
    await setVariables({ siteId: "site-1", token: "tok-xyz", variables: VARIABLES.slice(0, 1), fetchFn, log: () => {} });
    expect(calls.map((a) => a.method)).toEqual(["GET", "GET", "PUT"]);
  });

  test("prints keys, but neither token nor values", async () => {
    const { fetchFn } = fakeApi([]);
    const log: string[] = [];
    await setVariables({ siteId: "site-1", token: "tok-xyz", variables: VARIABLES, fetchFn, log: (line: string) => log.push(line) });
    const text = log.join("\n");
    expect(text).toContain("BNET_CLIENT_SECRET");
    expect(text).not.toContain("tok-xyz");
    expect(text).not.toContain("secret value");
    expect(text).not.toContain("id-value-123");
  });

  test("HTTP errors name the status, but no values from the response", async () => {
    const { fetchFn } = fakeApi([], { method: "POST", status: 422 });
    const error = await setVariables({ siteId: "site-1", token: "tok-xyz", variables: VARIABLES, fetchFn, log: () => {} }).catch(
      (e: Error) => e,
    );
    expect(error).toBeInstanceOf(Error);
    expect(String(error)).toMatch(/422/);
    expect(String(error)).not.toContain("secret value");
    expect(String(error)).not.toContain("tok-xyz");
  });

  test("without variables nothing happens", async () => {
    const { calls, fetchFn } = fakeApi([]);
    await expect(setVariables({ siteId: "site-1", token: "t", variables: [], fetchFn, log: () => {} })).rejects.toThrow(
      /no matching/i,
    );
    expect(calls).toEqual([]);
  });
});
