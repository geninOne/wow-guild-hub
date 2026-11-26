/**
 * Angaben zur Seite aus den Umgebungsvariablen `SEITE_…`, beim Bauen eingesetzt (siehe `.env.example`).
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
  /** Alternativtext aus SEITE_LOGO_ALT; ohne Angabe baut die Oberfläche ihn je Sprache aus dem Namen. */
  logoAlt: string | null;
  untertitel: string | null;
  discord: string | null;
  /** Ohne Name gibt es weder Impressum noch Datenschutzerklärung (beides gehört in Deutschland zusammen). */
  impressum: Impressum | null;
  /** Besucherstatistik mit Umami aktiv, dann erklärt die Datenschutzerklärung sie. */
  umami: boolean;
}

export function seite(): Seite {
  const name = wert("SEITE_NAME") ?? "Gildenseite";
  const impressumName = wert("SEITE_IMPRESSUM_NAME");
  const discord = wert("SEITE_DISCORD");
  return {
    name,
    logo: wert("SEITE_LOGO") ?? "/logo.svg",
    logoAlt: wert("SEITE_LOGO_ALT"),
    untertitel: wert("SEITE_UNTERTITEL"),
    discord: discord && /^https:\/\//.test(discord) ? discord : null,
    impressum: impressumName
      ? {
          name: impressumName,
          anschrift: (wert("SEITE_IMPRESSUM_ANSCHRIFT") ?? "").split("|").map((z) => z.trim()).filter(Boolean),
          email: wert("SEITE_IMPRESSUM_EMAIL"),
        }
      : null,
    umami: wert("SEITE_UMAMI_ID") !== null,
  };
}
