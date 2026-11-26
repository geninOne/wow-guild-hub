/* eslint-disable @typescript-eslint/no-explicit-any -- Rohantworten der API sind untypisiert */
import type { AttributeField, CharacterAttributesRecord } from "../model";

/** Felder ohne Werte: Verweise und der Charakter selbst. */
const SKIP = new Set(["_links", "character", "power_type"]);

/**
 * Bereinigt die Antwort von `/profile/wow/character/<slug>/statistics`: Es bleiben nur Zahlen, bei Objekten deren
 * Zahlenfelder. Welche Felder die Seite zeigt, entscheidet erst die Ansicht; so kostet eine andere Form der Antwort
 * höchstens eine Zeile in der Tabelle der Ansicht, keinen neuen Abruf.
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
