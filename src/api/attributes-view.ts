import type { AttributeField, CharacterAttributesRecord } from "../model";
import type { AttributeGroupId, AttributeRow, AttributesView, ResourceKind } from "./types";

type Kind = AttributeRow["kind"];

/**
 * Welche Felder der Antwort in welcher Gruppe stehen, in dieser Reihenfolge. Felder, die die Antwort nicht hat,
 * entfallen; so passt dieselbe Tabelle für Forever, Classic und Retail. `zeroHidden`: nur zeigen, wenn nicht 0.
 * Forever liefert auch Felder aus Retail (Meisterschaft, Vielseitigkeit, Lebensraub ...), dort meist mit 0.
 */
export const ATTRIBUTE_GROUPS: { id: AttributeGroupId; rows: { key: string; kind: Kind; zeroHidden?: boolean }[] }[] = [
  {
    id: "basis",
    rows: [
      { key: "health", kind: "number" },
      { key: "power", kind: "number" },
      { key: "strength", kind: "number" },
      { key: "agility", kind: "number" },
      { key: "intellect", kind: "number" },
      { key: "stamina", kind: "number" },
      { key: "spirit", kind: "number" },
    ],
  },
  {
    id: "angriff",
    rows: [
      { key: "attack_power", kind: "number" },
      { key: "ranged_attack_power", kind: "number", zeroHidden: true },
      { key: "main_hand_dps", kind: "number", zeroHidden: true },
      { key: "melee_crit", kind: "percent" },
      { key: "ranged_crit", kind: "percent" },
      { key: "melee_haste", kind: "percent", zeroHidden: true },
      { key: "ranged_haste", kind: "percent", zeroHidden: true },
      { key: "melee_hit", kind: "percent", zeroHidden: true },
      { key: "ranged_hit", kind: "percent", zeroHidden: true },
      { key: "expertise", kind: "number", zeroHidden: true },
      { key: "armor_penetration", kind: "number", zeroHidden: true },
      { key: "mastery", kind: "percent", zeroHidden: true },
      { key: "versatility", kind: "number", zeroHidden: true },
    ],
  },
  {
    id: "zauber",
    rows: [
      { key: "spell_power", kind: "number" },
      { key: "spell_healing", kind: "number", zeroHidden: true },
      { key: "spell_crit", kind: "percent" },
      { key: "spell_haste", kind: "percent", zeroHidden: true },
      { key: "spell_hit", kind: "percent", zeroHidden: true },
      { key: "mana_regen", kind: "number" },
      { key: "mana_regen_combat", kind: "number" },
      { key: "spell_penetration", kind: "number", zeroHidden: true },
    ],
  },
  {
    id: "verteidigung",
    rows: [
      { key: "armor", kind: "number" },
      { key: "defense", kind: "number", zeroHidden: true },
      { key: "dodge", kind: "percent" },
      { key: "parry", kind: "percent" },
      { key: "block", kind: "percent" },
      { key: "fire_resistance", kind: "number", zeroHidden: true },
      { key: "frost_resistance", kind: "number", zeroHidden: true },
      { key: "nature_resistance", kind: "number", zeroHidden: true },
      { key: "shadow_resistance", kind: "number", zeroHidden: true },
      { key: "arcane_resistance", kind: "number", zeroHidden: true },
      { key: "holy_resistance", kind: "number", zeroHidden: true },
    ],
  },
];

/** Ressourcen nach der ID des Power-Types bei Blizzard. */
const RESOURCES: Record<number, ResourceKind> = { 0: "mana", 1: "rage", 2: "focus", 3: "energy", 6: "runic_power" };

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Anzeigewert eines Felds: Prozentwerte aus `value`, Zahlen aus `effective`, sonst die erste passende Angabe. */
function pick(field: AttributeField | undefined, kind: Kind): { value: number; base: number | null } | null {
  if (field === undefined) return null;
  if (typeof field === "number") return { value: field, base: null };
  const value = kind === "percent" ? (num(field.value) ?? num(field.effective)) : (num(field.effective) ?? num(field.value) ?? num(field.rating));
  if (value === null) return null;
  // Forever meldet vereinzelt Effektivwert 0 bei Grundwert über 0 (gesehen: Stärke und Beweglichkeit eines Magiers).
  // Ausrüstung und Buffs können einen Wert nicht auf 0 drücken; die Zeile entfällt, statt eine falsche 0 zu zeigen.
  if (value === 0 && (num(field.base) ?? 0) > 0) return null;
  // Forever meldet bei Rüstung den Grundwert 0; ein Grundwert zählt nur, wenn er da ist und abweicht.
  const base = num(field.base);
  return { value, base: base !== null && base > 0 && base !== value ? base : null };
}

/** Werte des Charakters nach Gruppen. Ohne Datensatz oder ohne Felder ist `available` falsch. */
export function buildAttributesView(record: CharacterAttributesRecord | null | undefined): AttributesView {
  const fields = record?.fields;
  if (!record || !fields) return { available: false, fetchedAt: record?.fetchedAt ?? null, resource: null, groups: [] };
  const pt = record.powerType;
  const resource = pt ? { id: pt.id, kind: RESOURCES[pt.id] ?? ("other" as const), name: pt.name } : null;
  const groups = ATTRIBUTE_GROUPS.flatMap(({ id, rows }) => {
    const shown = rows.flatMap(({ key, kind, zeroHidden }): AttributeRow[] => {
      // Ressource ohne Art (etwa bei einem unbekannten Charakter) bleibt weg, die Zahl allein sagt nichts.
      if (key === "power" && !resource) return [];
      const hit = pick(fields[key], kind);
      if (!hit || (zeroHidden && hit.value === 0)) return [];
      return [{ key, kind, value: hit.value, ...(hit.base !== null ? { base: hit.base } : {}) }];
    });
    return shown.length > 0 ? [{ id, rows: shown }] : [];
  });
  return { available: groups.length > 0, fetchedAt: record.fetchedAt, resource, groups };
}
