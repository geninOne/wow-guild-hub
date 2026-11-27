import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { parseColors, siteHead, withSite } from "../../web/build/site";
import { withSiteUrl } from "../../web/build/site-url";

const web = (path: string) => fileURLToPath(new URL(`../../web/${path}`, import.meta.url));
const raw = readFileSync(web("index.html"), "utf8");

/** index.html as the build produces it with these variables. */
function built(env: Record<string, string> = {}, url?: string): string {
  return withSiteUrl(withSite(raw, siteHead(env)), url);
}

function meta(html: string, attribute: "name" | "property", value: string): string | undefined {
  const tag = html.match(new RegExp(`<meta[^>]*${attribute}="${value}"[^>]*>`))?.[0];
  return tag?.match(/content="([^"]*)"/)?.[1];
}

function link(html: string, rel: string): string | undefined {
  return html.match(new RegExp(`<link[^>]*rel="${rel}"[^>]*>`))?.[0].match(/href="([^"]*)"/)?.[1];
}

test("without details: neutral name, logo as icon and share image, no placeholders left", () => {
  const html = built({}, "https://gilde.example/");
  expect(html).toContain("<title>Gildenseite | Gildenseite</title>");
  expect(link(html, "icon")).toBe("/logo.svg");
  expect(link(html, "apple-touch-icon")).toBe("/apple-touch-icon.png");
  expect(meta(html, "property", "og:image")).toBe("https://gilde.example/og.png");
  expect(meta(html, "property", "og:locale")).toBe("de_DE");
  expect(meta(html, "name", "theme-color")).toBe("#14161c");
  expect(html).not.toMatch(/%WEBSITE_|\{\{WEBSITE_|seite-kopf|umami/);
  expect(raw).not.toMatch(/%WEBSITE_/);
});

test("empty variables (as copied from .env.example) yield the defaults", () => {
  const html = built({ WEBSITE_NAME: "", WEBSITE_LOGO: " ", WEBSITE_FAVICON: "", WEBSITE_DESCRIPTION: "" });
  expect(html).toContain("<title>Gildenseite | Gildenseite</title>");
  expect(link(html, "icon")).toBe("/logo.svg");
});

test("Netlify's own SITE_NAME and SITE_ID change nothing (hence the prefix WEBSITE_)", () => {
  const html = built({ SITE_NAME: "zufalls-subdomain-123", SITE_ID: "abc" });
  expect(html).toContain("<title>Gildenseite | Gildenseite</title>");
  expect(html).not.toContain("zufalls-subdomain-123");
});

test("with details: name, images, description, and Umami only with an ID", () => {
  const html = built({
    WEBSITE_NAME: "Musterzunft",
    WEBSITE_DESCRIPTION: 'Mitglieder & "Freunde"',
    WEBSITE_OG_IMAGE: "/og.jpg",
    WEBSITE_FAVICON: "/favicon-32.png",
    WEBSITE_UMAMI_ID: "00000000-1111-2222-3333-444444444444",
    WEBSITE_UMAMI_DOMAINS: "gilde.example",
  }, "https://gilde.example");
  expect(meta(html, "property", "og:site_name")).toBe("Musterzunft");
  expect(meta(html, "name", "description")).toBe("Mitglieder &amp; &quot;Freunde&quot;");
  expect(meta(html, "property", "og:image")).toBe("https://gilde.example/og.jpg");
  expect(link(html, "icon")).toBe("/favicon-32.png");
  const tag = html.match(/<script[^>]*cloud\.umami\.is[^>]*>/)?.[0];
  expect(tag).toContain('data-website-id="00000000-1111-2222-3333-444444444444"');
  expect(tag).toContain('data-domains="gilde.example"');
  expect(built({ WEBSITE_UMAMI_ID: '"><script>' })).not.toContain("umami");
});

test("custom logo without custom icons: logo also for home screen and share image", () => {
  const html = built({ WEBSITE_LOGO: "/zunft/logo.png" }, "https://gilde.example");
  expect(link(html, "apple-touch-icon")).toBe("/zunft/logo.png");
  expect(meta(html, "property", "og:image")).toBe("https://gilde.example/zunft/logo.png");
});

test("WEBSITE_COLORS sets only valid colors as CSS variables", () => {
  expect(parseColors("gold-1=#7fb3ff; steel-deep = #0b1020 ;kaputt;x=url(evil);--y=#fff;z=rgb(1, 2, 3)")).toEqual([
    ["gold-1", "#7fb3ff"],
    ["steel-deep", "#0b1020"],
    ["z", "rgb(1, 2, 3)"],
  ]);
  expect(built({ WEBSITE_COLORS: "gold-1=#7fb3ff" })).toContain("<style>:root{--gold-1:#7fb3ff}</style>");
});

test("all default images are in web/public, no external fonts, no em dashes", () => {
  for (const image of ["logo.svg", "og.png", "apple-touch-icon.png"]) expect(existsSync(web(`public/${image}`))).toBe(true);
  expect(raw).not.toMatch(/fonts\.(googleapis|gstatic)/);
  expect(raw).not.toContain("—");
});

test("the site address is inserted during the build, locally the paths stay relative", () => {
  const tag = '<meta property="og:image" content="{{SITE_URL}}/og.jpg" />';
  expect(withSiteUrl(tag, "https://gilde.example/")).toBe('<meta property="og:image" content="https://gilde.example/og.jpg" />');
  expect(withSiteUrl(tag, undefined)).toBe('<meta property="og:image" content="/og.jpg" />');
});
