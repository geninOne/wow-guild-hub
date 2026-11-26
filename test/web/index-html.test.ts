import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { parseFarben, seitenKopf, withSeite } from "../../web/build/seite";
import { withSiteUrl } from "../../web/build/site-url";

const web = (pfad: string) => fileURLToPath(new URL(`../../web/${pfad}`, import.meta.url));
const roh = readFileSync(web("index.html"), "utf8");

/** index.html, wie sie beim Bauen mit diesen Variablen entsteht. */
function gebaut(env: Record<string, string> = {}, url?: string): string {
  return withSiteUrl(withSeite(roh, seitenKopf(env)), url);
}

function meta(html: string, attribut: "name" | "property", wert: string): string | undefined {
  const tag = html.match(new RegExp(`<meta[^>]*${attribut}="${wert}"[^>]*>`))?.[0];
  return tag?.match(/content="([^"]*)"/)?.[1];
}

function link(html: string, rel: string): string | undefined {
  return html.match(new RegExp(`<link[^>]*rel="${rel}"[^>]*>`))?.[0].match(/href="([^"]*)"/)?.[1];
}

test("ohne Angaben: neutraler Name, Logo als Symbol und Teilen-Bild, keine Platzhalter übrig", () => {
  const html = gebaut({}, "https://gilde.example/");
  expect(html).toContain("<title>Gildenseite | Gildenseite</title>");
  expect(link(html, "icon")).toBe("/logo.svg");
  expect(link(html, "apple-touch-icon")).toBe("/apple-touch-icon.png");
  expect(meta(html, "property", "og:image")).toBe("https://gilde.example/og.png");
  expect(meta(html, "property", "og:locale")).toBe("de_DE");
  expect(meta(html, "name", "theme-color")).toBe("#14161c");
  expect(html).not.toMatch(/%SITE_|\{\{SITE_|seite-kopf|umami/);
  expect(roh).not.toMatch(/%SITE_/);
});

test("leere Variablen (wie aus .env.example kopiert) ergeben die Standardwerte", () => {
  const html = gebaut({ SITE_NAME: "", SITE_LOGO: " ", SITE_FAVICON: "", SITE_DESCRIPTION: "" });
  expect(html).toContain("<title>Gildenseite | Gildenseite</title>");
  expect(link(html, "icon")).toBe("/logo.svg");
});

test("mit Angaben: Name, Bilder, Beschreibung und Umami nur mit ID", () => {
  const html = gebaut({
    SITE_NAME: "Musterzunft",
    SITE_DESCRIPTION: 'Mitglieder & "Freunde"',
    SITE_OG_IMAGE: "/og.jpg",
    SITE_FAVICON: "/favicon-32.png",
    SITE_UMAMI_ID: "00000000-1111-2222-3333-444444444444",
    SITE_UMAMI_DOMAINS: "gilde.example",
  }, "https://gilde.example");
  expect(meta(html, "property", "og:site_name")).toBe("Musterzunft");
  expect(meta(html, "name", "description")).toBe("Mitglieder &amp; &quot;Freunde&quot;");
  expect(meta(html, "property", "og:image")).toBe("https://gilde.example/og.jpg");
  expect(link(html, "icon")).toBe("/favicon-32.png");
  const tag = html.match(/<script[^>]*cloud\.umami\.is[^>]*>/)?.[0];
  expect(tag).toContain('data-website-id="00000000-1111-2222-3333-444444444444"');
  expect(tag).toContain('data-domains="gilde.example"');
  expect(gebaut({ SITE_UMAMI_ID: '"><script>' })).not.toContain("umami");
});

test("eigenes Logo ohne eigene Symbole: Logo auch für Homescreen und Teilen-Bild", () => {
  const html = gebaut({ SITE_LOGO: "/zunft/logo.png" }, "https://gilde.example");
  expect(link(html, "apple-touch-icon")).toBe("/zunft/logo.png");
  expect(meta(html, "property", "og:image")).toBe("https://gilde.example/zunft/logo.png");
});

test("SITE_COLORS setzt nur gültige Farben als CSS-Variablen", () => {
  expect(parseFarben("gold-1=#7fb3ff; steel-deep = #0b1020 ;kaputt;x=url(evil);--y=#fff;z=rgb(1, 2, 3)")).toEqual([
    ["gold-1", "#7fb3ff"],
    ["steel-deep", "#0b1020"],
    ["z", "rgb(1, 2, 3)"],
  ]);
  expect(gebaut({ SITE_COLORS: "gold-1=#7fb3ff" })).toContain("<style>:root{--gold-1:#7fb3ff}</style>");
});

test("alle Bilder der Vorgabe liegen in web/public, keine externen Schriften, keine Gedankenstriche", () => {
  for (const bild of ["logo.svg", "og.png", "apple-touch-icon.png"]) expect(existsSync(web(`public/${bild}`))).toBe(true);
  expect(roh).not.toMatch(/fonts\.(googleapis|gstatic)/);
  expect(roh).not.toContain("—");
});

test("Seitenadresse wird beim Bauen eingesetzt, lokal bleiben die Pfade relativ", () => {
  const tag = '<meta property="og:image" content="{{SITE_URL}}/og.jpg" />';
  expect(withSiteUrl(tag, "https://gilde.example/")).toBe('<meta property="og:image" content="https://gilde.example/og.jpg" />');
  expect(withSiteUrl(tag, undefined)).toBe('<meta property="og:image" content="/og.jpg" />');
});
