/**
 * Deprecated 2.x interface for server modules (`ServerErweiterung`), so modules written for 2.x keep working
 * unchanged. Modules registered in `./index.ts` with this shape are converted by `src/extensions/legacy.ts`.
 * Removed in the major version after 3.0.0. New modules use `ServerExtension` from `src/extensions/types.ts`.
 */
import type { ApiContext, CharacterContext, ExtensionEnvironment, WeeklyContext } from "../extensions/types";
import type { Fassungen } from "../sprache";
import type { ErweiterungsFakt } from "../weekly/zeitung-facts";

/** @deprecated Use `ExtensionEnvironment`. */
export type ErweiterungsUmgebung = ExtensionEnvironment;
/** @deprecated Use `ApiContext`. */
export type ApiKontext = ApiContext;
/** @deprecated Use `CharacterContext`. */
export type CharakterKontext = CharacterContext;
/** @deprecated Use `WeeklyContext`. */
export type WochenKontext = WeeklyContext;

/** @deprecated Use `ServerExtension` (`character`, `characterCacheTags`, `weeklyArticles`, `sections`). */
export interface ServerErweiterung {
  id: string;
  api?(req: Request, pfad: string, kontext: ApiKontext): Promise<Response | null>;
  charakter?(kontext: CharakterKontext): Promise<unknown>;
  charakterCacheTags?: string[];
  wochenArtikel?(kontext: WochenKontext): Promise<ErweiterungsFakt[]>;
  rubriken?: Record<string, Fassungen>;
}
