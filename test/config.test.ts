import { expect, test } from "vitest";
import { loadConfig } from "../src/config";

test("Standardwerte", () => {
  const c = loadConfig({ BNET_CLIENT_ID: "id", BNET_CLIENT_SECRET: "geheim", GUILD_SLUG: "meine-gilde" });
  expect(c).toEqual({
    clientId: "id",
    clientSecret: "geheim",
    guildSlugs: ["meine-gilde"],
    gameVersion: "forever",
    region: "eu",
    locale: "de_DE",
    concurrency: 10,
    budgetMs: 12000,
  });
});

test("Werte aus der Umgebung, GUILD_SLUG allein gilt als einzige Gilde", () => {
  const c = loadConfig({
    BNET_CLIENT_ID: "id",
    BNET_CLIENT_SECRET: "s",
    GUILD_SLUG: "andere",
    COLLECT_CONCURRENCY: "4",
    COLLECT_BUDGET_MS: "8000",
  });
  expect([c.guildSlugs, c.concurrency, c.budgetMs]).toEqual([["andere"], 4, 8000]);
});

test("ohne GUILD_SLUGS und GUILD_SLUG bricht die Konfiguration ab", () => {
  expect(() => loadConfig({ BNET_CLIENT_ID: "id", BNET_CLIENT_SECRET: "s" })).toThrow("GUILD_SLUGS");
});

test("WOW_VERSION: Standard forever, Groß- und Kleinschreibung egal, Unbekanntes bricht ab", () => {
  const basis = { BNET_CLIENT_ID: "id", BNET_CLIENT_SECRET: "s", GUILD_SLUG: "g" };
  expect(loadConfig({ ...basis, WOW_VERSION: " Forever " }).gameVersion).toBe("forever");
  expect(() => loadConfig({ ...basis, WOW_VERSION: "retail" })).toThrow("WOW_VERSION");
});

test("fehlende Zugangsdaten nennen nur den Variablennamen", () => {
  expect(() => loadConfig({ BNET_CLIENT_ID: "id" })).toThrow("BNET_CLIENT_SECRET");
  expect(() => loadConfig({ BNET_CLIENT_SECRET: "geheim" })).toThrow("BNET_CLIENT_ID");
});

test.each(["abc", "0", "-3", "2.5", "1e400"])("ungültige COLLECT_CONCURRENCY %s nennt nur den Variablennamen", (wert) => {
  const env = { BNET_CLIENT_ID: "id", BNET_CLIENT_SECRET: "geheim", GUILD_SLUG: "g", COLLECT_CONCURRENCY: wert };
  expect(() => loadConfig(env)).toThrow("COLLECT_CONCURRENCY");
  expect(() => loadConfig(env)).not.toThrow(/geheim/);
});

test.each(["abc", "-1", "Infinity"])("ungültiges COLLECT_BUDGET_MS %s nennt nur den Variablennamen", (wert) => {
  const env = { BNET_CLIENT_ID: "id", BNET_CLIENT_SECRET: "geheim", GUILD_SLUG: "g", COLLECT_BUDGET_MS: wert };
  expect(() => loadConfig(env)).toThrow("COLLECT_BUDGET_MS");
  expect(() => loadConfig(env)).not.toThrow(/geheim/);
});

test("Budget 0 ist erlaubt", () => {
  const c = loadConfig({ BNET_CLIENT_ID: "id", BNET_CLIENT_SECRET: "s", GUILD_SLUG: "g", COLLECT_BUDGET_MS: "0" });
  expect(c.budgetMs).toBe(0);
});

test("GUILD_SLUGS hat Vorrang vor GUILD_SLUG", () => {
  const c = loadConfig({ BNET_CLIENT_ID: "id", BNET_CLIENT_SECRET: "s", GUILD_SLUGS: "a,b", GUILD_SLUG: "x" });
  expect(c.guildSlugs).toEqual(["a", "b"]);
});

test("GUILD_SLUGS wird getrimmt, leere und doppelte Einträge fallen weg", () => {
  const c = loadConfig({
    BNET_CLIENT_ID: "id", BNET_CLIENT_SECRET: "s", GUILD_SLUGS: " bärenklaue, ,bärenklaue,goldene-bärenklaue ",
  });
  expect(c.guildSlugs).toEqual(["bärenklaue", "goldene-bärenklaue"]);
});

test("GUILD_SLUGS ohne Eintrag ist ungültig", () => {
  expect(() => loadConfig({ BNET_CLIENT_ID: "id", BNET_CLIENT_SECRET: "s", GUILD_SLUGS: " , " })).toThrow("GUILD_SLUGS");
});

test("Zeitbudget des Sammlers bleibt mit Reserve unter dem 15-s-Abbruch von Netlify, Standard überall gleich", async () => {
  // Netlify bricht geplante Läufe nach 15 s ab (Status 499) und wiederholt sie teils; Vor- und Nacharbeit brauchen gut 1 s.
  const c = loadConfig({ BNET_CLIENT_ID: "id", BNET_CLIENT_SECRET: "s", GUILD_SLUG: "g" });
  expect(c.budgetMs).toBeLessThanOrEqual(12000);
  const { STANDARDWERTE } = await import("../scripts/netlify-umgebung-lib.mjs");
  expect(STANDARDWERTE.COLLECT_BUDGET_MS).toBe(String(c.budgetMs));
});
