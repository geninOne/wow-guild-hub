/**
 * Deprecated aliases of 2.x for `web/src/lib/language.tsx`, so extension modules written for 2.x keep compiling and
 * keep following the language switch (same context). Removed in the next major version after 3.0.0.
 */
import type { Language, Translations } from "../../../src/language";
import {
  LANGUAGE_STORAGE_KEY,
  LanguageProvider,
  offeredLanguages,
  storedLanguage,
  storeLanguage,
  useLanguage,
} from "./language";

export { fassungIn, SPRACH_NAMEN, SPRACHEN, type Fassungen, type Sprache } from "../../../src/sprache";

/** @deprecated Use `LANGUAGE_STORAGE_KEY` from `web/src/lib/language.tsx`. */
export const SPRACH_SCHLUESSEL = LANGUAGE_STORAGE_KEY;
/** @deprecated Use `offeredLanguages`. */
export const angeboteneSprachen = offeredLanguages;
/** @deprecated Use `storedLanguage`. */
export const gemerkteSprache = storedLanguage;
/** @deprecated Use `storeLanguage`. */
export const spracheMerken = storeLanguage;
/** @deprecated Use `LanguageProvider`. */
export const SpracheProvider = LanguageProvider;

/** @deprecated Use `useLanguage`, which returns `language` and `setLanguage`. */
export function useSprache(): {
  sprache: Language;
  setSprache(sprache: Language): void;
  t<T>(fassungen: Translations<T>): T;
} {
  const { language, setLanguage, t } = useLanguage();
  return { sprache: language, setSprache: setLanguage, t };
}
