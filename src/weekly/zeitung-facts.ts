/**
 * Deprecated 2.x names of the extension article types (`ErweiterungsFakt` and friends), so modules written for 2.x
 * keep compiling. The core converts such articles with `src/extensions/legacy.ts`. Removed in the major version
 * after 3.0.0. New code uses `ExtensionFact`, `ArticleText` and `WriteTools` from `src/extensions/types.ts`.
 */
import type { Fassungen, Sprache } from "../sprache";
import type { ArticleText, WriteTools } from "./newspaper-facts";

/** @deprecated Use `ArticleText`. */
export type MeldungsText = ArticleText;
/** @deprecated Use `WriteTools`. */
export type SchreibWerkzeug = WriteTools;

/** @deprecated Use `ExtensionFact` (`type`, `section`, `newsValue`, `numbers`, `write`, `forAi`). */
export interface ErweiterungsFakt {
  kind: "erweiterung";
  art: string;
  rubrik: string;
  nachrichtenwert: number;
  characterIds: number[];
  zahlen: number[];
  schreibe(w: SchreibWerkzeug): Fassungen<MeldungsText>;
  fuerKi(name: (id: number) => string, sprache: Sprache): Record<string, unknown>;
}
