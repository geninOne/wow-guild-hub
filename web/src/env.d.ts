/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Version aus package.json, beim Bauen eingesetzt. */
  readonly VITE_VERSION?: string;
  /** Datum der Version aus CHANGELOG.md (sonst Baudatum) als JJJJ-MM-TT. */
  readonly VITE_VERSION_DATUM?: string;
  /** Angaben zur Seite, siehe .env.example. */
  readonly WEBSITE_NAME?: string;
  readonly WEBSITE_LOGO?: string;
  readonly WEBSITE_LOGO_ALT?: string;
  readonly WEBSITE_TAGLINE?: string;
  readonly WEBSITE_DISCORD?: string;
  readonly WEBSITE_IMPRINT_NAME?: string;
  readonly WEBSITE_IMPRINT_ADDRESS?: string;
  readonly WEBSITE_IMPRINT_EMAIL?: string;
  readonly WEBSITE_UMAMI_ID?: string;
  /** Angebotene Sprachen, kommagetrennt: de, en, schwaebisch, bayrisch. */
  readonly WEBSITE_LANGUAGES?: string;
  /** Name der Wochenzeitung. */
  readonly WEBSITE_NEWSPAPER?: string;
}
