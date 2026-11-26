/**
 * Angaben zur Seite aus den Umgebungsvariablen `SITE_…`, beim Bauen eingesetzt (siehe `.env.example`).
 * Als Funktion, damit Tests die Werte mit `vi.stubEnv` ändern können.
 */

const wert = (name: keyof ImportMetaEnv): string | null => {
  const v = import.meta.env[name];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};

export interface Impressum {
  name: string;
  anschrift: string[];
  email: string | null;
}

export interface Seite {
  name: string;
  logo: string;
  /** Alternativtext aus SITE_LOGO_ALT; ohne Angabe baut die Oberfläche ihn je Sprache aus dem Namen. */
  logoAlt: string | null;
  untertitel: string | null;
  discord: string | null;
  /** Ohne Name gibt es weder Impressum noch Datenschutzerklärung (beides gehört in Deutschland zusammen). */
  impressum: Impressum | null;
  /** Besucherstatistik mit Umami aktiv, dann erklärt die Datenschutzerklärung sie. */
  umami: boolean;
}

export function seite(): Seite {
  const name = wert("SITE_NAME") ?? "Gildenseite";
  const impressumName = wert("SITE_IMPRINT_NAME");
  const discord = wert("SITE_DISCORD");
  return {
    name,
    logo: wert("SITE_LOGO") ?? "/logo.svg",
    logoAlt: wert("SITE_LOGO_ALT"),
    untertitel: wert("SITE_TAGLINE"),
    discord: discord && /^https:\/\//.test(discord) ? discord : null,
    impressum: impressumName
      ? {
          name: impressumName,
          anschrift: (wert("SITE_IMPRINT_ADDRESS") ?? "").split("|").map((z) => z.trim()).filter(Boolean),
          email: wert("SITE_IMPRINT_EMAIL"),
        }
      : null,
    umami: wert("SITE_UMAMI_ID") !== null,
  };
}
