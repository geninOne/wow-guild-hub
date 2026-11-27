/**
 * Site details from environment variables prefixed `WEBSITE_`, inserted into `index.html` during the build.
 * The UI reads the same variables via `import.meta.env` (see `web/src/lib/site.ts`).
 */

type Env = Record<string, string | undefined>;

export interface SiteHead {
  name: string;
  description: string;
  logo: string;
  logoAlt: string;
  favicon: string;
  appleIcon: string;
  ogImage: string;
  themeColor: string;
  umamiId: string | null;
  umamiDomains: string | null;
  colors: [string, string][];
}

const value = (env: Env, name: string): string | null => {
  const v = env[name]?.trim();
  return v ? v : null;
};

/**
 * `WEBSITE_COLORS`: pairs `name=value` separated by semicolons, e.g. `gold-1=#7fb3ff;steel-deep=#0b1020`.
 * The name is a variable from `web/src/styles/theme.css` without `--`. Invalid entries are dropped so that
 * nothing but colors ends up in the stylesheet.
 */
export function parseColors(raw: string | undefined): [string, string][] {
  return (raw ?? "")
    .split(";")
    .map((pair) => pair.split("=").map((s) => s.trim()))
    .filter((p): p is [string, string] => p.length === 2 && /^[a-z][a-z0-9-]{0,40}$/.test(p[0]))
    .filter(([, v]) => /^(#[0-9a-fA-F]{3,8}|(rgb|hsl)a?\([0-9.,%\s]+\))$/.test(v));
}

export function siteHead(env: Env): SiteHead {
  const name = value(env, "WEBSITE_NAME") ?? "Gildenseite";
  const logo = value(env, "WEBSITE_LOGO") ?? "/logo.svg";
  return {
    name,
    description: value(env, "WEBSITE_DESCRIPTION") ?? "Mitglieder, Charaktere, Berufe, Dungeons und Raids der Gilde.",
    logo,
    logoAlt: value(env, "WEBSITE_LOGO_ALT") ?? `Wappen der Gilde ${name}`,
    favicon: value(env, "WEBSITE_FAVICON") ?? logo,
    // Without a custom logo, the PNG versions of the placeholder crest: iPhones and share previews (Discord,
    // Facebook) show no SVG. With a custom logo that one, until WEBSITE_APPLE_ICON and WEBSITE_OG_IMAGE are set.
    appleIcon: value(env, "WEBSITE_APPLE_ICON") ?? (value(env, "WEBSITE_LOGO") ? logo : "/apple-touch-icon.png"),
    ogImage: value(env, "WEBSITE_OG_IMAGE") ?? (value(env, "WEBSITE_LOGO") ? logo : "/og.png"),
    themeColor: value(env, "WEBSITE_THEME_COLOR") ?? "#14161c",
    umamiId: value(env, "WEBSITE_UMAMI_ID"),
    umamiDomains: value(env, "WEBSITE_UMAMI_DOMAINS"),
    colors: parseColors(env.WEBSITE_COLORS),
  };
}

const esc = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** A path with a leading slash gets the site address in front (Open Graph wants absolute addresses). */
const absolute = (path: string) => (path.startsWith("/") ? `{{SITE_URL}}${path}` : path);

/**
 * Fills in the placeholders `{{WEBSITE_…}}` (deliberately not `%WEBSITE_…%`: Vite replaces those itself as soon as
 * the variable exists, even empty and without a default) and adds Umami and colors at the marker `<!--seite-kopf-->`.
 */
export function withSite(html: string, head: SiteHead): string {
  const replacements: Record<string, string> = {
    "{{WEBSITE_NAME}}": esc(head.name),
    "{{WEBSITE_DESCRIPTION}}": esc(head.description),
    "{{WEBSITE_FAVICON}}": esc(head.favicon),
    "{{WEBSITE_APPLE_ICON}}": esc(head.appleIcon),
    "{{WEBSITE_OG_IMAGE}}": esc(absolute(head.ogImage)),
    "{{WEBSITE_LOGO_ALT}}": esc(head.logoAlt),
    "{{WEBSITE_THEME_COLOR}}": esc(head.themeColor),
  };
  let out = html;
  for (const [placeholder, text] of Object.entries(replacements)) out = out.replaceAll(placeholder, text);

  const extra: string[] = [];
  if (head.colors.length > 0) {
    extra.push(`<style>:root{${head.colors.map(([n, v]) => `--${n}:${v}`).join(";")}}</style>`);
  }
  if (head.umamiId && /^[0-9a-fA-F-]{8,64}$/.test(head.umamiId)) {
    const domains = head.umamiDomains ? ` data-domains="${esc(head.umamiDomains)}"` : "";
    extra.push(
      `<script defer src="https://cloud.umami.is/script.js" data-website-id="${esc(head.umamiId)}"${domains}></script>`,
    );
  }
  return out.replace("<!--seite-kopf-->", extra.join("\n    "));
}
