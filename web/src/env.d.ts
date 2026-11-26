/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Version aus package.json, beim Bauen eingesetzt. */
  readonly VITE_VERSION?: string;
  /** Datum der Version aus CHANGELOG.md (sonst Baudatum) als JJJJ-MM-TT. */
  readonly VITE_VERSION_DATUM?: string;
  /** Angaben zur Seite, siehe .env.example. */
  readonly SEITE_NAME?: string;
  readonly SEITE_LOGO?: string;
  readonly SEITE_LOGO_ALT?: string;
  readonly SEITE_UNTERTITEL?: string;
  readonly SEITE_DISCORD?: string;
  readonly SEITE_IMPRESSUM_NAME?: string;
  readonly SEITE_IMPRESSUM_ANSCHRIFT?: string;
  readonly SEITE_IMPRESSUM_EMAIL?: string;
  readonly SEITE_UMAMI_ID?: string;
  /** Angebotene Sprachen, kommagetrennt: de, en, schwaebisch, bayrisch. */
  readonly SEITE_SPRACHEN?: string;
  /** Name der Wochenzeitung. */
  readonly SEITE_ZEITUNG?: string;
}
