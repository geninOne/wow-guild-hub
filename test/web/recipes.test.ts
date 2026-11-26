import { expect, test } from "vitest";
import type { RecipeView } from "../../src/api/types";
import type { CharacterProfession } from "../../src/model";
import { filterRecipes, recipeEntries } from "../../web/src/lib/recipes";

const named = (names: string[]) => names.map((name) => ({ name }));

test("Rezeptfilter ab zwei Zeichen, ohne Rücksicht auf Groß- und Kleinschreibung", () => {
  const list = named(["Zinn verhütten", "Brot backen", "Äpfel kandieren"]);
  expect(filterRecipes(list, "s")).toEqual(list);
  expect(filterRecipes(list, "ZINN").map((r) => r.name)).toEqual(["Zinn verhütten"]);
  expect(filterRecipes(list, "en").map((r) => r.name)).toEqual(["Zinn verhütten", "Brot backen", "Äpfel kandieren"]);
});

test("Rezeptfilter liefert höchstens 100 Treffer, behält die Reihenfolge", () => {
  const many = named(Array.from({ length: 150 }, (_, i) => `Rezept ${String(i).padStart(3, "0")}`));
  expect(filterRecipes(many, "rezept")).toHaveLength(100);
  expect(filterRecipes(many, "rezept")[0].name).toBe("Rezept 000");
});

const detail = (id: number, name: string): RecipeView => ({
  id, name, description: null, icon: null, craftedQuantity: 1, item: null, reagents: [],
});

test("Rezepte eines Berufs am Charakter: deutsch sortiert, mit Details, ohne ID ohne Details", () => {
  const p: CharacterProfession = {
    id: 197, name: "Schneiderei", nameEn: "Tailoring", skill: 1, max: 75, primary: true,
    recipes: ["Leinenstoffballen", "Äußerst feiner Faden", "Braune Leinenhose"],
    recipeIds: [2963, 1, 2408],
  };
  const entries = recipeEntries(p, { "2408": detail(2408, "Braune Leinenhose") });
  expect(entries.map((e) => [e.key, e.name, e.recipe?.id ?? null])).toEqual([
    ["1", "Äußerst feiner Faden", null],
    ["2408", "Braune Leinenhose", 2408],
    ["2963", "Leinenstoffballen", null],
  ]);
  const alt = recipeEntries({ ...p, recipeIds: undefined }, {});
  expect(alt.map((e) => e.key)).toEqual(["name:Äußerst feiner Faden", "name:Braune Leinenhose", "name:Leinenstoffballen"]);
});
