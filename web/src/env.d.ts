/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Version from package.json, inserted during the build. */
  readonly VITE_VERSION?: string;
  /** Date of the version from CHANGELOG.md (otherwise the build date) as YYYY-MM-DD. */
  readonly VITE_VERSION_DATUM?: string;
  /** Site details, see .env.example. */
  readonly WEBSITE_NAME?: string;
  readonly WEBSITE_LOGO?: string;
  readonly WEBSITE_LOGO_ALT?: string;
  readonly WEBSITE_TAGLINE?: string;
  readonly WEBSITE_DISCORD?: string;
  readonly WEBSITE_IMPRINT_NAME?: string;
  readonly WEBSITE_IMPRINT_ADDRESS?: string;
  readonly WEBSITE_IMPRINT_EMAIL?: string;
  readonly WEBSITE_UMAMI_ID?: string;
  /** Offered languages, comma-separated: de, en, schwaebisch, bayrisch. */
  readonly WEBSITE_LANGUAGES?: string;
  /** Name of the weekly newspaper. */
  readonly WEBSITE_NEWSPAPER?: string;
}
