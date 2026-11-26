/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Version aus package.json, beim Bauen eingesetzt. */
  readonly VITE_VERSION?: string;
  /** Datum der Version aus CHANGELOG.md (sonst Baudatum) als JJJJ-MM-TT. */
  readonly VITE_VERSION_DATUM?: string;
  /** Angaben zur Seite, siehe .env.example. */
  readonly SITE_NAME?: string;
  readonly SITE_LOGO?: string;
  readonly SITE_LOGO_ALT?: string;
  readonly SITE_TAGLINE?: string;
  readonly SITE_DISCORD?: string;
  readonly SITE_IMPRINT_NAME?: string;
  readonly SITE_IMPRINT_ADDRESS?: string;
  readonly SITE_IMPRINT_EMAIL?: string;
  readonly SITE_UMAMI_ID?: string;
  /** Angebotene Sprachen, kommagetrennt: de, en, schwaebisch, bayrisch. */
  readonly SITE_LANGUAGES?: string;
  /** Name der Wochenzeitung. */
  readonly SITE_NEWSPAPER?: string;
}
