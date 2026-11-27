import type { AttributeField, CharacterAttributesRecord } from "../model";
import type { AttributeGroupId, AttributeRow, AttributesView, ResourceKind } from "./types";

type Kind = AttributeRow["kind"];

/**
 * Which fields of the response belong to which group, in this order. Fields missing from the response are
 * dropped, so the same table fits Forever, Classic and Retail. `zeroHidden`: only show when not 0.
 * Forever also delivers Retail fields (mastery, versatility, leech ...), mostly with 0 there.
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

/** Resources by Blizzard's power type ID. */
const RESOURCES: Record<number, ResourceKind> = { 0: "mana", 1: "rage", 2: "focus", 3: "energy", 6: "runic_power" };

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Display value of a field: percentages from `value`, numbers from `effective`, otherwise the first usable value. */
function pick(field: AttributeField | undefined, kind: Kind): { value: number; base: number | null } | null {
  if (field === undefined) return null;
  if (typeof field === "number") return { value: field, base: null };
  const value = kind === "percent" ? (num(field.value) ?? num(field.effective)) : (num(field.effective) ?? num(field.value) ?? num(field.rating));
  if (value === null) return null;
  // Forever occasionally reports an effective value of 0 with a base value above 0 (seen: strength and agility of a
  // mage). Gear and buffs cannot push a value down to 0; the row is dropped instead of showing a wrong 0.
  if (value === 0 && (num(field.base) ?? 0) > 0) return null;
  // Forever reports a base value of 0 for armor; a base value only counts if it is present and differs.
  const base = num(field.base);
  return { value, base: base !== null && base > 0 && base !== value ? base : null };
}

/** Character stats by group. Without a record or without fields, `available` is false. */
export function buildAttributesView(record: CharacterAttributesRecord | null | undefined): AttributesView {
  const fields = record?.fields;
  if (!record || !fields) return { available: false, fetchedAt: record?.fetchedAt ?? null, resource: null, groups: [] };
  const pt = record.powerType;
  const resource = pt ? { id: pt.id, kind: RESOURCES[pt.id] ?? ("other" as const), name: pt.name } : null;
  const groups = ATTRIBUTE_GROUPS.flatMap(({ id, rows }) => {
    const shown = rows.flatMap(({ key, kind, zeroHidden }): AttributeRow[] => {
      // A resource without a kind (e.g. for an unknown character) is left out, the number alone says nothing.
      if (key === "power" && !resource) return [];
      const hit = pick(fields[key], kind);
      if (!hit || (zeroHidden && hit.value === 0)) return [];
      return [{ key, kind, value: hit.value, ...(hit.base !== null ? { base: hit.base } : {}) }];
    });
    return shown.length > 0 ? [{ id, rows: shown }] : [];
  });
  return { available: groups.length > 0, fetchedAt: record.fetchedAt, resource, groups };
}
