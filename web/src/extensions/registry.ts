// All registered interface modules: those of `./index.ts` and, until 4.0, those of the 2.x registry
// `web/src/erweiterungen/index.ts`. Each 2.x module is converted only once (cached per module object), so wrapped
// components keep their identity and state across renders.
import { OBERFLAECHEN_ERWEITERUNGEN } from "../erweiterungen";
import { UI_EXTENSIONS } from ".";
import { toUiExtension, type AnyUiExtension } from "./legacy";
import type { UiExtension } from "./types";

const converted = new WeakMap<AnyUiExtension, UiExtension>();

function cachedUiExtension(e: AnyUiExtension): UiExtension {
  let result = converted.get(e);
  if (!result) {
    result = toUiExtension(e);
    converted.set(e, result);
  }
  return result;
}

/** The registered modules in the 3.0 shape, read at call time (tests may replace a registry). */
export function registeredUiExtensions(): readonly UiExtension[] {
  return [...UI_EXTENSIONS, ...OBERFLAECHEN_ERWEITERUNGEN].map(cachedUiExtension);
}
