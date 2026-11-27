/* eslint-disable @typescript-eslint/no-explicit-any -- raw API responses are untyped */
import type { AttributeField, CharacterAttributesRecord } from "../model";

/** Fields without values: links and the character itself. */
const SKIP = new Set(["_links", "character", "power_type"]);

/**
 * Cleans up the response of `/profile/wow/character/<slug>/statistics`: only numbers remain, and for objects their
 * number fields. Which fields the page shows is decided by the view alone; so a different response shape costs at
 * most one line in the view's table, not a new fetch.
 */
export function toAttributes(raw: any, fetchedAt: string): CharacterAttributesRecord {
  const fields: Record<string, AttributeField> = {};
  for (const [key, value] of Object.entries(raw ?? {})) {
    if (SKIP.has(key)) continue;
    if (typeof value === "number" && Number.isFinite(value)) {
      fields[key] = value;
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      const numbers: Record<string, number> = {};
      for (const [k, v] of Object.entries(value)) if (typeof v === "number" && Number.isFinite(v)) numbers[k] = v;
      if (Object.keys(numbers).length > 0) fields[key] = numbers;
    }
  }
  const pt = raw?.power_type;
  const powerType = typeof pt?.id === "number" ? { id: pt.id, name: typeof pt.name === "string" ? pt.name : "" } : null;
  return { fetchedAt, fields, powerType };
}
