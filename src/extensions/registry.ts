// All registered server modules: those of `./index.ts` and, until 4.0, those of the 2.x registry
// `src/erweiterungen/index.ts` (converted). The core reads this list unless a caller passes its own.
import { SERVER_ERWEITERUNGEN } from "../erweiterungen";
import { SERVER_EXTENSIONS } from ".";
import { serverExtensions } from "./legacy";
import type { ServerExtension } from "./types";

export const REGISTERED_SERVER_EXTENSIONS: readonly ServerExtension[] = serverExtensions([
  ...SERVER_EXTENSIONS,
  ...SERVER_ERWEITERUNGEN,
]);
