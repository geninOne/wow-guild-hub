/**
 * Deprecated 2.x names of the phrase helpers that extension modules use (`alle`, `Alle`, `list`, `gleichLang`).
 * Removed in the major version after 3.0.0. New code imports from `./phrases`.
 */
import { allLanguages, sameLength, type AllLanguages } from "./phrases";

export { list, Picker } from "./phrases";
/** @deprecated Use `allLanguages`. */
export const alle = allLanguages;
/** @deprecated Use `AllLanguages`. */
export type Alle<T> = AllLanguages<T>;
/** @deprecated Use `sameLength`. */
export const gleichLang = sameLength;
