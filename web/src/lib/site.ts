/**
 * Site details from the `WEBSITE_…` environment variables, inserted at build time (see `.env.example`).
 * A function, so tests can change the values with `vi.stubEnv`.
 */

const envValue = (name: keyof ImportMetaEnv): string | null => {
  const v = import.meta.env[name];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};

export interface Imprint {
  name: string;
  address: string[];
  email: string | null;
}

export interface Site {
  name: string;
  logo: string;
  /** Alt text from WEBSITE_LOGO_ALT; if not set, the UI builds it from the name per language. */
  logoAlt: string | null;
  tagline: string | null;
  discord: string | null;
  /** Without a name there is neither legal notice nor privacy policy (in Germany both belong together). */
  imprint: Imprint | null;
  /** Visitor statistics with Umami active; the privacy policy then explains them. */
  umami: boolean;
}

export function site(): Site {
  const name = envValue("WEBSITE_NAME") ?? "Gildenseite";
  const imprintName = envValue("WEBSITE_IMPRINT_NAME");
  const discord = envValue("WEBSITE_DISCORD");
  return {
    name,
    logo: envValue("WEBSITE_LOGO") ?? "/logo.svg",
    logoAlt: envValue("WEBSITE_LOGO_ALT"),
    tagline: envValue("WEBSITE_TAGLINE"),
    discord: discord && /^https:\/\//.test(discord) ? discord : null,
    imprint: imprintName
      ? {
          name: imprintName,
          address: (envValue("WEBSITE_IMPRINT_ADDRESS") ?? "").split("|").map((line) => line.trim()).filter(Boolean),
          email: envValue("WEBSITE_IMPRINT_EMAIL"),
        }
      : null,
    umami: envValue("WEBSITE_UMAMI_ID") !== null,
  };
}
