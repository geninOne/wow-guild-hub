/**
 * Deprecated aliases of 2.x for `src/language.ts`, so extension modules written for 2.x keep compiling.
 * Removed in the next major version after 3.0.0. New code imports from `./language`.
 */
import {
  activeLanguages,
  DEFAULT_LANGUAGE,
  DEFAULT_LANGUAGES,
  DIALECTS,
  fromConfig,
  isDialect,
  isLanguage,
  LANGUAGE_NAMES,
  LANGUAGES,
  perLanguage,
  sameInAll,
  translationIn,
  withDialects,
  type ConfigText,
  type Dialect,
  type Language,
  type OtherTranslations,
  type Translations,
} from "./language";

/** @deprecated Use `LANGUAGES` from `src/language.ts`. */
export const SPRACHEN = LANGUAGES;
/** @deprecated Use `Language`. */
export type Sprache = Language;
/** @deprecated Use `DIALECTS`. */
export const DIALEKTE = DIALECTS;
/** @deprecated Use `Dialect`. */
export type Dialekt = Dialect;
/** @deprecated Use `Translations`. */
export type Fassungen<T = string> = Translations<T>;
/** @deprecated Use `DEFAULT_LANGUAGE`. */
export const STANDARD_SPRACHE = DEFAULT_LANGUAGE;
/** @deprecated Use `DEFAULT_LANGUAGES`. */
export const STANDARD_SPRACHEN = DEFAULT_LANGUAGES;
/** @deprecated Use `LANGUAGE_NAMES`. */
export const SPRACH_NAMEN = LANGUAGE_NAMES;
/** @deprecated Use `isLanguage`. */
export const istSprache = isLanguage;
/** @deprecated Use `isDialect`. */
export const istDialekt = isDialect;
/** @deprecated Use `activeLanguages`. */
export const aktiveSprachen = activeLanguages;
/** @deprecated Use `translationIn`. */
export const fassungIn = translationIn;
/** @deprecated Use `OtherTranslations`. */
export type Dialekte<T> = OtherTranslations<T>;
/** @deprecated Use `withDialects`. */
export const mitDialekten = withDialects;
/** @deprecated Use `sameInAll`. */
export const ueberall = sameInAll;
/** @deprecated Use `perLanguage`. */
export const jeSprache = perLanguage;
/** @deprecated Use `ConfigText`. */
export type KonfigText = ConfigText;
/** @deprecated Use `fromConfig`. */
export const ausKonfig = fromConfig;
