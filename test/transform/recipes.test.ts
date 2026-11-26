import { expect, test } from "vitest";
import { toRecipeDetail } from "../../src/transform/recipes";
import { loadFixture } from "../helpers/fixtures";

const ICON = "https://render.worldofwarcraft.com/forever-eu/icons/56/134586.jpg";

test("Rezept mit hergestelltem Gegenstand: Qualität, Stufe, Tooltip und Materialien", () => {
  const r = toRecipeDetail(loadFixture("recipe-2408").data, ICON, loadFixture("item-4343").data);
  expect(r).toMatchObject({
    id: 2408,
    name: "Braune Leinenhose",
    icon: ICON,
    craftedQuantity: 1,
    reagents: [
      { id: 2996, name: "Leinenstoffballen", quantity: 2 },
      { id: 2320, name: "Grober Faden", quantity: 1 },
    ],
  });
  expect(r.item).toMatchObject({ id: 4343, name: "Braune Leinenhose", quality: "UNCOMMON", itemLevel: 10 });
  expect(r.item?.tooltip).toMatchObject({
    armor: "17 Rüstung",
    stats: ["+1 Zaubermacht"],
    requiredLevel: "Benötigt Stufe 5",
    slotType: "Beine",
    subclass: "Stoff",
    binding: "Wird beim Anlegen gebunden",
  });
});

test("Verzauberung ohne Gegenstand: Beschreibung statt Gegenstand", () => {
  const r = toRecipeDetail(loadFixture("recipe-4289").data, null, null);
  expect(r.item).toBeNull();
  expect(r.name).toBe("Armschiene - Minderwertige Ausdauer");
  expect(r.description).toMatch(/^Armschienen dauerhaft so verzaubern/);
  expect(r.reagents).toEqual([{ id: 247786, name: "Magiepartikel", quantity: 1 }]);
});

test("Verbrauchsgut: keine Gegenstandsstufe, kein Platz, Wirkung als Zauber", () => {
  const recipe = {
    id: 1838,
    name: "Leinenverband",
    crafted_item: { id: 1251, name: "Leinenverband" },
    reagents: [{ reagent: { id: 2589, name: "Leinenstoff" }, quantity: 1 }],
    crafted_quantity: { value: 1 },
  };
  const r = toRecipeDetail(recipe, null, loadFixture("item-1251").data);
  expect(r.item?.itemLevel).toBeNull();
  expect(r.item?.quality).toBe("COMMON");
  expect(r.item?.tooltip?.slotType).toBeNull();
  expect(r.item?.tooltip?.subclass).toBeNull();
  expect(r.item?.tooltip?.spells).toEqual(["Benutzen: Heilt 6 Sek. lang 66 Punkt(e) Schaden."]);
  expect(r.description).toBeNull();
});

test("Gegenstand nicht abrufbar: Name aus dem Rezept, sonst leer", () => {
  const r = toRecipeDetail({ ...loadFixture("recipe-2408").data, crafted_quantity: { value: 5 } }, null, null);
  expect(r.craftedQuantity).toBe(5);
  expect(r.item).toEqual({ id: 4343, name: "Braune Leinenhose", quality: null, itemLevel: null, tooltip: null });
});

test("Tasche: Platzzahl im Tooltip", () => {
  const item = { name: "Leinentasche", quality: { type: "COMMON" }, preview_item: { container_slots: { value: 6, display_string: "6 Platz Behälter" } } };
  const r = toRecipeDetail({ id: 3755, name: "Leinentasche", crafted_item: { id: 4238, name: "Leinentasche" } }, null, item);
  expect(r.item?.tooltip?.containerSlots).toBe("6 Platz Behälter");
});
