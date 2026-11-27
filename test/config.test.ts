import { expect, test } from "vitest";
import { loadConfig } from "../src/config";

test("defaults", () => {
  const c = loadConfig({ BNET_CLIENT_ID: "id", BNET_CLIENT_SECRET: "secret", GUILD_SLUG: "my-guild" });
  expect(c).toEqual({
    clientId: "id",
    clientSecret: "secret",
    guildSlugs: ["my-guild"],
    gameVersion: "forever",
    region: "eu",
    locale: "de_DE",
    concurrency: 10,
    budgetMs: 12000,
  });
});

test("values from the environment, GUILD_SLUG alone counts as the only guild", () => {
  const c = loadConfig({
    BNET_CLIENT_ID: "id",
    BNET_CLIENT_SECRET: "s",
    GUILD_SLUG: "other",
    COLLECT_CONCURRENCY: "4",
    COLLECT_BUDGET_MS: "8000",
  });
  expect([c.guildSlugs, c.concurrency, c.budgetMs]).toEqual([["other"], 4, 8000]);
});

test("without GUILD_SLUGS and GUILD_SLUG the configuration aborts", () => {
  expect(() => loadConfig({ BNET_CLIENT_ID: "id", BNET_CLIENT_SECRET: "s" })).toThrow("GUILD_SLUGS");
});

test("WOW_VERSION: default forever, case-insensitive, unknown values abort", () => {
  const base = { BNET_CLIENT_ID: "id", BNET_CLIENT_SECRET: "s", GUILD_SLUG: "g" };
  expect(loadConfig({ ...base, WOW_VERSION: " Forever " }).gameVersion).toBe("forever");
  expect(() => loadConfig({ ...base, WOW_VERSION: "retail" })).toThrow("WOW_VERSION");
});

test("missing credentials name only the variable", () => {
  expect(() => loadConfig({ BNET_CLIENT_ID: "id" })).toThrow("BNET_CLIENT_SECRET");
  expect(() => loadConfig({ BNET_CLIENT_SECRET: "secret" })).toThrow("BNET_CLIENT_ID");
});

test.each(["abc", "0", "-3", "2.5", "1e400"])("invalid COLLECT_CONCURRENCY %s names only the variable", (value) => {
  const env = { BNET_CLIENT_ID: "id", BNET_CLIENT_SECRET: "secret", GUILD_SLUG: "g", COLLECT_CONCURRENCY: value };
  expect(() => loadConfig(env)).toThrow("COLLECT_CONCURRENCY");
  expect(() => loadConfig(env)).not.toThrow(/secret/);
});

test.each(["abc", "-1", "Infinity"])("invalid COLLECT_BUDGET_MS %s names only the variable", (value) => {
  const env = { BNET_CLIENT_ID: "id", BNET_CLIENT_SECRET: "secret", GUILD_SLUG: "g", COLLECT_BUDGET_MS: value };
  expect(() => loadConfig(env)).toThrow("COLLECT_BUDGET_MS");
  expect(() => loadConfig(env)).not.toThrow(/secret/);
});

test("budget 0 is allowed", () => {
  const c = loadConfig({ BNET_CLIENT_ID: "id", BNET_CLIENT_SECRET: "s", GUILD_SLUG: "g", COLLECT_BUDGET_MS: "0" });
  expect(c.budgetMs).toBe(0);
});

test("GUILD_SLUGS takes precedence over GUILD_SLUG", () => {
  const c = loadConfig({ BNET_CLIENT_ID: "id", BNET_CLIENT_SECRET: "s", GUILD_SLUGS: "a,b", GUILD_SLUG: "x" });
  expect(c.guildSlugs).toEqual(["a", "b"]);
});

test("GUILD_SLUGS is trimmed, empty and duplicate entries are dropped", () => {
  const c = loadConfig({
    BNET_CLIENT_ID: "id", BNET_CLIENT_SECRET: "s", GUILD_SLUGS: " bärenklaue, ,bärenklaue,goldene-bärenklaue ",
  });
  expect(c.guildSlugs).toEqual(["bärenklaue", "goldene-bärenklaue"]);
});

test("GUILD_SLUGS without an entry is invalid", () => {
  expect(() => loadConfig({ BNET_CLIENT_ID: "id", BNET_CLIENT_SECRET: "s", GUILD_SLUGS: " , " })).toThrow("GUILD_SLUGS");
});

test("collector time budget stays below the Netlify 15 s abort with a reserve, same default everywhere", async () => {
  // Netlify aborts scheduled runs after 15 s (status 499) and sometimes repeats them; setup and teardown take a good 1 s.
  const c = loadConfig({ BNET_CLIENT_ID: "id", BNET_CLIENT_SECRET: "s", GUILD_SLUG: "g" });
  expect(c.budgetMs).toBeLessThanOrEqual(12000);
  const { DEFAULTS } = await import("../scripts/netlify-env-lib.mjs");
  expect(DEFAULTS.COLLECT_BUDGET_MS).toBe(String(c.budgetMs));
});

test("TWINK_RANKS resolves rank names from GUILD_RANKS to rank numbers per guild", () => {
  const base = { BNET_CLIENT_ID: "id", BNET_CLIENT_SECRET: "s", GUILD_SLUGS: "my-guild,second" };
  const GUILD_RANKS = JSON.stringify({ "my-guild": ["GM", "Offizier", "Twink", "Mitglied", "twink gl"], second: { "3": "Twink" }, third: ["Twink"] });
  expect(loadConfig({ ...base, GUILD_RANKS, TWINK_RANKS: " Twink , Twink GL" }).twinkRanks).toEqual({
    "my-guild": [2, 4], second: [3], third: [0],
  });
  expect(loadConfig({ ...base, GUILD_RANKS }).twinkRanks).toBeUndefined();
  expect(loadConfig({ ...base, TWINK_RANKS: "Twink" }).twinkRanks).toBeUndefined();
  expect(loadConfig({ ...base, GUILD_RANKS, TWINK_RANKS: "DoesNotExist" }).twinkRanks).toBeUndefined();
});
