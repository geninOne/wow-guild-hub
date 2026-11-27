import { expect, test } from "vitest";
import type { RecipeView } from "../../src/api/types";
import type { CharacterProfession } from "../../src/model";
import { filterRecipes, recipeEntries } from "../../web/src/lib/recipes";

const named = (names: string[]) => names.map((name) => ({ name }));

test("recipe filter from two characters on, case-insensitive", () => {
  const list = named(["Zinn verhütten", "Brot backen", "Äpfel kandieren"]);
  expect(filterRecipes(list, "s")).toEqual(list);
  expect(filterRecipes(list, "ZINN").map((r) => r.name)).toEqual(["Zinn verhütten"]);
  expect(filterRecipes(list, "en").map((r) => r.name)).toEqual(["Zinn verhütten", "Brot backen", "Äpfel kandieren"]);
});

test("recipe filter returns at most 100 hits, keeps the order", () => {
  const many = named(Array.from({ length: 150 }, (_, i) => `Rezept ${String(i).padStart(3, "0")}`));
  expect(filterRecipes(many, "rezept")).toHaveLength(100);
  expect(filterRecipes(many, "rezept")[0].name).toBe("Rezept 000");
});

const detail = (id: number, name: string): RecipeView => ({
  id, name, description: null, icon: null, craftedQuantity: 1, item: null, reagents: [],
});

test("recipes of a character's profession: sorted in German order, with details, without ID without details", () => {
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
  const legacy = recipeEntries({ ...p, recipeIds: undefined }, {});
  expect(legacy.map((e) => e.key)).toEqual(["name:Äußerst feiner Faden", "name:Braune Leinenhose", "name:Leinenstoffballen"]);
});
