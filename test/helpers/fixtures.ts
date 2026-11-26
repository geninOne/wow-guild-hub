import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../fixtures/", import.meta.url));

/** Rohantwort aus dem API-Test in der Form { status, data }. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadFixture(name: string): { status: number; data: any } {
  return JSON.parse(readFileSync(`${dir}${name}.json`, "utf-8"));
}
