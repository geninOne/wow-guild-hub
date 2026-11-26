import { describe, expect, test } from "vitest";
import {
  NETLIFY_VARIABLEN,
  SITE_VARIABLEN,
  setzeVariablen,
  variablenAusEnv,
  variablenAusUmgebung,
} from "../../scripts/netlify-umgebung-lib.mjs";

const ENV = `# Kommentar
BNET_CLIENT_ID=id-wert-123
BNET_CLIENT_SECRET="geheimer wert"
GUILD_SLUGS=bärenklaue,goldene-bärenklaue
BNET_REGION=eu
BNET_LOCALE=
COLLECT_CONCURRENCY=10
LOCAL_SCHEDULER=on
LOCAL_SCHEDULER_GUILD_MINUTES=60
FREMD=x
`;

describe("variablenAusEnv", () => {
  test("übernimmt nur die Variablen für Netlify mit Wert, ohne Taktgeber", () => {
    expect(variablenAusEnv(ENV)).toEqual([
      { key: "BNET_CLIENT_ID", value: "id-wert-123" },
      { key: "BNET_CLIENT_SECRET", value: "geheimer wert" },
      { key: "GUILD_SLUGS", value: "bärenklaue,goldene-bärenklaue" },
      { key: "BNET_REGION", value: "eu" },
      { key: "COLLECT_CONCURRENCY", value: "10" },
    ]);
  });

  test("die Liste entspricht der Spec", () => {
    expect(NETLIFY_VARIABLEN).toEqual([
      "BNET_CLIENT_ID",
      "BNET_CLIENT_SECRET",
      "GUILD_SLUGS",
      "GUILD_RANKS",
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
      ...SITE_VARIABLEN,
    ]);
    expect(SITE_VARIABLEN.every((v) => v.startsWith("SITE_"))).toBe(true);
    expect(NETLIFY_VARIABLEN).not.toContain("ANTHROPIC_API_KEY");
  });

  test("KI-Variablen kommen mit, wenn sie einen Wert haben", () => {
    const keys = variablenAusEnv(`${ENV}NEWSPAPER_AI_URL=https://gateway.example\nNEWSPAPER_AI_KEY=\nANTHROPIC_API_KEY=x\n`).map((v) => v.key);
    expect(keys).toContain("NEWSPAPER_AI_URL");
    expect(keys).not.toContain("NEWSPAPER_AI_KEY");
    expect(keys).not.toContain("ANTHROPIC_API_KEY");
  });
});

describe("variablenAusUmgebung", () => {
  test("Zugangsdaten aus der Umgebung, nicht gesetzte oder leere Einstellungen mit Standardwert", () => {
    expect(
      variablenAusUmgebung({
        BNET_CLIENT_ID: "id-wert-123",
        BNET_CLIENT_SECRET: "geheimer wert",
        GUILD_SLUGS: "meine-gilde",
        GUILD_RANKS: "",
        BNET_REGION: "us",
        COLLECT_BUDGET_MS: "15000",
        LOCAL_SCHEDULER: "on",
      }),
    ).toEqual([
      { key: "BNET_CLIENT_ID", value: "id-wert-123" },
      { key: "BNET_CLIENT_SECRET", value: "geheimer wert" },
      { key: "GUILD_SLUGS", value: "meine-gilde" },
      { key: "BNET_REGION", value: "us" },
      { key: "BNET_LOCALE", value: "de_DE" },
      { key: "COLLECT_CONCURRENCY", value: "10" },
      { key: "COLLECT_BUDGET_MS", value: "15000" },
    ]);
  });

  test("KI-Variablen sind freiwillig: fehlen sie, kommen sie nicht mit und nichts scheitert", () => {
    const zugang = { BNET_CLIENT_ID: "id", BNET_CLIENT_SECRET: "geheim", GUILD_SLUGS: "g" };
    const ohne = variablenAusUmgebung({ ...zugang, NEWSPAPER_AI_URL: "", ANTHROPIC_API_KEY: "netlify" }).map((v) => v.key);
    expect(ohne.filter((k) => k.startsWith("ZEITUNG") || k.startsWith("ANTHROPIC"))).toEqual([]);
    const mit = variablenAusUmgebung({ ...zugang, NEWSPAPER_AI_URL: "https://gateway.example", NEWSPAPER_AI_KEY: "s", NEWSPAPER_AI_MODEL: "anthropic-router" });
    expect(mit.slice(-3)).toEqual([
      { key: "NEWSPAPER_AI_URL", value: "https://gateway.example" },
      { key: "NEWSPAPER_AI_KEY", value: "s" },
      { key: "NEWSPAPER_AI_MODEL", value: "anthropic-router" },
    ]);
  });

  test("fehlende Zugangsdaten brechen mit den Namen ab, ohne Werte", () => {
    expect(() => variablenAusUmgebung({ BNET_CLIENT_ID: "id-wert-123" })).toThrow(/BNET_CLIENT_SECRET/);
    expect(() => variablenAusUmgebung({ BNET_CLIENT_ID: "id-wert-123" })).not.toThrow(/id-wert-123/);
    expect(() => variablenAusUmgebung({})).toThrow(/BNET_CLIENT_ID, BNET_CLIENT_SECRET, GUILD_SLUGS/);
  });
});

type Aufruf = { methode: string; url: string; auth: string | null; body: unknown };

type Vorhanden = { key: string; values: { value?: string; context: string }[] };

function fakeApi(vorhanden: Vorhanden[], fehler?: { methode: string; status: number }) {
  const aufrufe: Aufruf[] = [];
  const fetchFn = async (eingabe: string | URL | Request, init: RequestInit = {}) => {
    const url = eingabe instanceof Request ? eingabe.url : String(eingabe);
    const methode = init.method ?? "GET";
    const headers = new Headers(init.headers);
    aufrufe.push({
      methode,
      url,
      auth: headers.get("authorization"),
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    });
    if (fehler && fehler.methode === methode) {
      return new Response(JSON.stringify({ message: "kaputt", echo: init.body }), { status: fehler.status });
    }
    if (methode === "GET" && url.endsWith("/sites/site-1")) {
      return Response.json({ account_slug: "gilde-team", account_id: "acc-9" });
    }
    if (methode === "GET") return Response.json(vorhanden);
    return Response.json(methode === "POST" ? [] : {});
  };
  return { aufrufe, fetchFn };
}

const VARIABLEN = [
  { key: "BNET_CLIENT_ID", value: "id-wert-123" },
  { key: "BNET_CLIENT_SECRET", value: "geheimer wert" },
];

describe("setzeVariablen", () => {
  test("legt neue an, ändert abweichende und lässt gleiche unverändert", async () => {
    const { aufrufe, fetchFn } = fakeApi([
      { key: "BNET_CLIENT_SECRET", values: [{ value: "alter wert", context: "all" }] },
      { key: "BNET_REGION", values: [{ value: "eu", context: "all" }] },
      { key: "ANDERE", values: [{ value: "x", context: "all" }] },
    ]);
    const log: string[] = [];
    await setzeVariablen({
      siteId: "site-1",
      token: "tok-xyz",
      variablen: [...VARIABLEN, { key: "BNET_REGION", value: "eu" }],
      fetchFn,
      log: (z: string) => log.push(z),
    });

    expect(aufrufe.map((a) => `${a.methode} ${a.url}`)).toEqual([
      "GET https://api.netlify.com/api/v1/sites/site-1",
      "GET https://api.netlify.com/api/v1/accounts/gilde-team/env?site_id=site-1",
      "PUT https://api.netlify.com/api/v1/accounts/gilde-team/env/BNET_CLIENT_SECRET?site_id=site-1",
      "POST https://api.netlify.com/api/v1/accounts/gilde-team/env?site_id=site-1",
    ]);
    expect(aufrufe.every((a) => a.auth === "Bearer tok-xyz")).toBe(true);
    expect(aufrufe[2].body).toEqual({ key: "BNET_CLIENT_SECRET", values: [{ value: "geheimer wert", context: "all" }] });
    expect(aufrufe[3].body).toEqual([{ key: "BNET_CLIENT_ID", values: [{ value: "id-wert-123", context: "all" }] }]);
    expect(log.join("\n")).toMatch(/BNET_REGION: unverändert/);
  });

  test("ein zweiter Lauf mit denselben Werten schreibt nichts", async () => {
    const { aufrufe, fetchFn } = fakeApi(VARIABLEN.map(({ key, value }) => ({ key, values: [{ value, context: "all" }] })));
    await setzeVariablen({ siteId: "site-1", token: "tok-xyz", variablen: VARIABLEN, fetchFn, log: () => {} });
    expect(aufrufe.map((a) => a.methode)).toEqual(["GET", "GET"]);
  });

  test("Werte in mehreren Kontexten werden durch einen Wert für alle ersetzt", async () => {
    const { aufrufe, fetchFn } = fakeApi([
      {
        key: "BNET_CLIENT_ID",
        values: [
          { value: "id-wert-123", context: "production" },
          { value: "anders", context: "dev" },
        ],
      },
    ]);
    await setzeVariablen({ siteId: "site-1", token: "tok-xyz", variablen: VARIABLEN.slice(0, 1), fetchFn, log: () => {} });
    expect(aufrufe.map((a) => a.methode)).toEqual(["GET", "GET", "PUT"]);
  });

  test("gibt Schlüssel aus, aber weder Token noch Werte", async () => {
    const { fetchFn } = fakeApi([]);
    const log: string[] = [];
    await setzeVariablen({ siteId: "site-1", token: "tok-xyz", variablen: VARIABLEN, fetchFn, log: (z: string) => log.push(z) });
    const text = log.join("\n");
    expect(text).toContain("BNET_CLIENT_SECRET");
    expect(text).not.toContain("tok-xyz");
    expect(text).not.toContain("geheimer wert");
    expect(text).not.toContain("id-wert-123");
  });

  test("HTTP-Fehler nennen Status, aber keine Werte aus der Antwort", async () => {
    const { fetchFn } = fakeApi([], { methode: "POST", status: 422 });
    const fehler = await setzeVariablen({ siteId: "site-1", token: "tok-xyz", variablen: VARIABLEN, fetchFn, log: () => {} }).catch(
      (e: Error) => e,
    );
    expect(fehler).toBeInstanceOf(Error);
    expect(String(fehler)).toMatch(/422/);
    expect(String(fehler)).not.toContain("geheimer wert");
    expect(String(fehler)).not.toContain("tok-xyz");
  });

  test("ohne Variablen passiert nichts", async () => {
    const { aufrufe, fetchFn } = fakeApi([]);
    await expect(setzeVariablen({ siteId: "site-1", token: "t", variablen: [], fetchFn, log: () => {} })).rejects.toThrow(
      /keine/i,
    );
    expect(aufrufe).toEqual([]);
  });
});
