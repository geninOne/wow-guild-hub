// Converts server modules written for 2.x (`ServerErweiterung`, German member names) into `ServerExtension`, so they
// keep working without changes until 4.0. Every entry point of the core passes its list through `serverExtensions`.
import type { ServerErweiterung } from "../erweiterungen/typen";
import type { ErweiterungsFakt } from "../weekly/zeitung-facts";
import type { ExtensionFact, ServerExtension } from "./types";

/** A registered module in either shape. */
export type AnyServerExtension = ServerExtension | ServerErweiterung;

const LEGACY_KEYS = ["charakter", "charakterCacheTags", "wochenArtikel", "rubriken"] as const;

function isLegacy(e: AnyServerExtension): e is ServerErweiterung {
  return LEGACY_KEYS.some((key) => Object.hasOwn(e, key));
}

/** A 2.x article as `ExtensionFact`. */
export function fromLegacyFact(f: ErweiterungsFakt): ExtensionFact {
  return {
    kind: "extension",
    type: f.art,
    section: f.rubrik,
    newsValue: f.nachrichtenwert,
    characterIds: f.characterIds,
    numbers: f.zahlen,
    write: (tools) => f.schreibe(tools),
    forAi: (name, language) => f.fuerKi(name, language),
  };
}

/**
 * A module in the 3.0 shape, converted if it still has 2.x member names. A module halfway through its upgrade may
 * have both; then the 3.0 member wins and the 2.x one fills the gaps.
 */
export function toServerExtension(e: AnyServerExtension): ServerExtension {
  if (!isLegacy(e)) return e;
  const current = e as Partial<ServerExtension>;
  const { charakter, wochenArtikel } = e;
  return {
    id: e.id,
    api: e.api,
    character: current.character ?? (charakter && ((context) => e.charakter!(context))),
    characterCacheTags: current.characterCacheTags ?? e.charakterCacheTags,
    weeklyArticles:
      current.weeklyArticles ??
      (wochenArtikel && (async (context) => (await e.wochenArtikel!(context)).map(fromLegacyFact))),
    sections: current.sections ?? e.rubriken,
  };
}

/** All modules of a list in the 3.0 shape. */
export function serverExtensions(list: readonly AnyServerExtension[]): ServerExtension[] {
  return list.map(toServerExtension);
}
