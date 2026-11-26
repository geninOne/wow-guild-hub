import { expect, test } from "vitest";
import { buildAttributesView } from "../../src/api/attributes-view";
import { toAttributes } from "../../src/transform/attributes";

/** Antwort in der Form von `/statistics` (gekürzt), Werte erfunden. */
const RAW = {
  _links: { self: { href: "https://eu.api.blizzard.com/profile/wow/character/test/statistics" } },
  character: { id: 1, name: "Test" },
  health: 4210,
  power: 3100,
  power_type: { key: { href: "x" }, name: "Mana", id: 0 },
  strength: { base: 40, effective: 52 },
  agility: { base: 35, effective: 35 },
  intellect: { base: 120, effective: 168 },
  stamina: { base: 60, effective: 91 },
  spirit: { base: 110, effective: 140 },
  attack_power: 120,
  melee_crit: { rating: 0, rating_bonus: 0, value: 4.123 },
  spell_power: 85,
  spell_crit: { rating: 0, rating_bonus: 0, value: 7.5 },
  mana_regen: 32.5,
  armor: { base: 410, effective: 510 },
  dodge: { rating: 0, rating_bonus: 0, value: 3.2 },
  parry: { rating: 0, rating_bonus: 0, value: 0 },
  fire_resistance: { base: 0, effective: 0 },
  shadow_resistance: { base: 0, effective: 10 },
  name: "kein Zahlenfeld",
};

test("toAttributes behält nur Zahlen und die Ressource", () => {
  const rec = toAttributes(RAW, "2026-11-26T03:00:00.000Z");
  expect(rec.fetchedAt).toBe("2026-11-26T03:00:00.000Z");
  expect(rec.powerType).toEqual({ id: 0, name: "Mana" });
  expect(rec.fields).toMatchObject({ health: 4210, strength: { base: 40, effective: 52 }, melee_crit: { value: 4.123 } });
  expect(rec.fields).not.toHaveProperty("_links");
  expect(rec.fields).not.toHaveProperty("character");
  expect(rec.fields).not.toHaveProperty("power_type");
  expect(rec.fields).not.toHaveProperty("name");
});

test("toAttributes ohne Ressource und ohne Felder", () => {
  expect(toAttributes(null, "t")).toEqual({ fetchedAt: "t", fields: {}, powerType: null });
});

test("Ansicht gruppiert, wählt Effektiv- und Prozentwerte und blendet leere Widerstände aus", () => {
  const view = buildAttributesView(toAttributes(RAW, "t"));
  expect(view.available).toBe(true);
  expect(view.resource).toEqual({ id: 0, kind: "mana", name: "Mana" });
  expect(view.groups.map((g) => g.id)).toEqual(["basis", "angriff", "zauber", "verteidigung"]);
  const basis = view.groups[0].rows;
  expect(basis.map((r) => r.key)).toEqual(["health", "power", "strength", "agility", "intellect", "stamina", "spirit"]);
  expect(basis.find((r) => r.key === "strength")).toEqual({ key: "strength", kind: "number", value: 52, base: 40 });
  // Ohne Unterschied kein Grundwert.
  expect(basis.find((r) => r.key === "agility")).toEqual({ key: "agility", kind: "number", value: 35 });
  expect(view.groups[1].rows).toEqual([
    { key: "attack_power", kind: "number", value: 120 },
    { key: "melee_crit", kind: "percent", value: 4.123 },
  ]);
  const verteidigung = view.groups[3].rows.map((r) => r.key);
  expect(verteidigung).toEqual(["armor", "dodge", "parry", "shadow_resistance"]);
});

test("Ressourcen nach ID: Wut, Energie, Runenmacht und Unbekanntes", () => {
  const kind = (id: number) => buildAttributesView(toAttributes({ ...RAW, power_type: { id, name: "N" } }, "t")).resource?.kind;
  expect([kind(1), kind(3), kind(6), kind(2), kind(99)]).toEqual(["rage", "energy", "runic_power", "focus", "other"]);
});

test("ohne Ressource keine Ressourcenzeile", () => {
  const view = buildAttributesView(toAttributes({ health: 100, power: 50 }, "t"));
  expect(view.groups).toEqual([{ id: "basis", rows: [{ key: "health", kind: "number", value: 100 }] }]);
});

test("ohne Datensatz, ohne Felder (404) oder ohne bekannte Felder nicht verfügbar", () => {
  expect(buildAttributesView(null)).toEqual({ available: false, fetchedAt: null, resource: null, groups: [] });
  expect(buildAttributesView(undefined).available).toBe(false);
  expect(buildAttributesView({ fetchedAt: "t", fields: null, powerType: null })).toEqual({
    available: false, fetchedAt: "t", resource: null, groups: [],
  });
  expect(buildAttributesView({ fetchedAt: "t", fields: { unbekannt: 3 }, powerType: null }).available).toBe(false);
});
