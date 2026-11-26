/**
 * Angaben zur Seite aus Umgebungsvariablen mit dem Präfix `SITE_`, beim Bauen in `index.html` eingesetzt.
 * Dieselben Variablen liest die Oberfläche über `import.meta.env` (siehe `web/src/lib/seite.ts`).
 */

type Env = Record<string, string | undefined>;

export interface SeitenKopf {
  name: string;
  beschreibung: string;
  logo: string;
  logoAlt: string;
  favicon: string;
  appleIcon: string;
  ogBild: string;
  themeColor: string;
  umamiId: string | null;
  umamiDomains: string | null;
  farben: [string, string][];
}

const wert = (env: Env, name: string): string | null => {
  const v = env[name]?.trim();
  return v ? v : null;
};

/**
 * `SITE_COLORS`: Paare `name=wert`, durch Semikolon getrennt, z. B. `gold-1=#7fb3ff;steel-deep=#0b1020`.
 * Der Name ist eine Variable aus `web/src/styles/theme.css` ohne `--`. Unpassende Einträge fallen weg, damit
 * nichts anderes als Farben in das Stylesheet gelangt.
 */
export function parseFarben(raw: string | undefined): [string, string][] {
  return (raw ?? "")
    .split(";")
    .map((paar) => paar.split("=").map((s) => s.trim()))
    .filter((p): p is [string, string] => p.length === 2 && /^[a-z][a-z0-9-]{0,40}$/.test(p[0]))
    .filter(([, v]) => /^(#[0-9a-fA-F]{3,8}|(rgb|hsl)a?\([0-9.,%\s]+\))$/.test(v));
}

export function seitenKopf(env: Env): SeitenKopf {
  const name = wert(env, "SITE_NAME") ?? "Gildenseite";
  const logo = wert(env, "SITE_LOGO") ?? "/logo.svg";
  return {
    name,
    beschreibung: wert(env, "SITE_DESCRIPTION") ?? "Mitglieder, Charaktere, Berufe, Dungeons und Raids der Gilde.",
    logo,
    logoAlt: wert(env, "SITE_LOGO_ALT") ?? `Wappen der Gilde ${name}`,
    favicon: wert(env, "SITE_FAVICON") ?? logo,
    // Ohne eigenes Logo die PNG-Fassungen des Platzhalter-Wappens: iPhones und Teilen-Vorschauen (Discord,
    // Facebook) zeigen kein SVG. Mit eigenem Logo dieses, bis SITE_APPLE_ICON und SITE_OG_IMAGE gesetzt sind.
    appleIcon: wert(env, "SITE_APPLE_ICON") ?? (wert(env, "SITE_LOGO") ? logo : "/apple-touch-icon.png"),
    ogBild: wert(env, "SITE_OG_IMAGE") ?? (wert(env, "SITE_LOGO") ? logo : "/og.png"),
    themeColor: wert(env, "SITE_THEME_COLOR") ?? "#14161c",
    umamiId: wert(env, "SITE_UMAMI_ID"),
    umamiDomains: wert(env, "SITE_UMAMI_DOMAINS"),
    farben: parseFarben(env.SITE_COLORS),
  };
}

const esc = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** Pfad mit führendem Schrägstrich bekommt die Seitenadresse davor (Open Graph will absolute Adressen). */
const absolut = (pfad: string) => (pfad.startsWith("/") ? `{{SITE_URL}}${pfad}` : pfad);

/**
 * Setzt die Platzhalter `{{SITE_…}}` ein (bewusst nicht `%SITE_…%`: das ersetzt Vite selbst, sobald die Variable
 * existiert, auch leer und ohne Standardwert) und ergänzt Umami und Farben an der Marke `<!--seite-kopf-->`.
 */
export function withSeite(html: string, kopf: SeitenKopf): string {
  const ersatz: Record<string, string> = {
    "{{SITE_NAME}}": esc(kopf.name),
    "{{SITE_DESCRIPTION}}": esc(kopf.beschreibung),
    "{{SITE_FAVICON}}": esc(kopf.favicon),
    "{{SITE_APPLE_ICON}}": esc(kopf.appleIcon),
    "{{SITE_OG_IMAGE}}": esc(absolut(kopf.ogBild)),
    "{{SITE_LOGO_ALT}}": esc(kopf.logoAlt),
    "{{SITE_THEME_COLOR}}": esc(kopf.themeColor),
  };
  let out = html;
  for (const [platzhalter, text] of Object.entries(ersatz)) out = out.replaceAll(platzhalter, text);

  const zusatz: string[] = [];
  if (kopf.farben.length > 0) {
    zusatz.push(`<style>:root{${kopf.farben.map(([n, v]) => `--${n}:${v}`).join(";")}}</style>`);
  }
  if (kopf.umamiId && /^[0-9a-fA-F-]{8,64}$/.test(kopf.umamiId)) {
    const domains = kopf.umamiDomains ? ` data-domains="${esc(kopf.umamiDomains)}"` : "";
    zusatz.push(
      `<script defer src="https://cloud.umami.is/script.js" data-website-id="${esc(kopf.umamiId)}"${domains}></script>`,
    );
  }
  return out.replace("<!--seite-kopf-->", zusatz.join("\n    "));
}
