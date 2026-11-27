// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import type { RecipeView } from "../../src/api/types";
import { toRecipeDetail } from "../../src/transform/recipes";
import { RecipeIcon, RecipeTooltip } from "../../web/src/components/RecipeTooltip";

afterEach(cleanup);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loadFixture = (name: string): { data: any } =>
  JSON.parse(readFileSync(resolve(process.cwd(), `test/fixtures/${name}.json`), "utf8"));

const CLOTH = "https://render.worldofwarcraft.com/forever-eu/icons/56/inv_fabric_linen_02.jpg";

function view(recipe: string, icon: string | null, item: string | null): RecipeView {
  const d = toRecipeDetail(loadFixture(recipe).data, icon, item ? loadFixture(item).data : null);
  return { ...d, reagents: d.reagents.map((r) => ({ ...r, icon: r.id === 2996 ? CLOTH : null })) };
}

const pants = view("recipe-2408", "https://render.worldofwarcraft.com/forever-eu/icons/56/134586.jpg", "item-4343");
const enchantment = view("recipe-4289", null, null);

test("tooltip with item: name once, stats, reagents with quantity and icon", () => {
  const { container } = render(<RecipeTooltip name="Braune Leinenhose" recipe={pants} />);
  expect(screen.getAllByText("Braune Leinenhose")).toHaveLength(1);
  expect(screen.getByText("17 Rüstung")).toBeTruthy();
  expect(screen.getByText("+1 Zaubermacht")).toBeTruthy();
  expect(screen.getByText("Materialien")).toBeTruthy();
  const reagents = [...container.querySelectorAll(".recipe-tip-reagents li")].map((li) => li.textContent);
  expect(reagents).toEqual(["2× Leinenstoffballen", "1× Grober Faden"]);
  expect(container.querySelector(".recipe-tip-reagents img")?.getAttribute("src")).toBe(CLOTH);
  expect(screen.queryByText(/Stellt/)).toBeNull();
});

test("tooltip with quantity above 1 and a different recipe name", () => {
  render(<RecipeTooltip name="Leinenhosen nähen" recipe={{ ...pants, name: "Leinenhosen nähen", craftedQuantity: 5 }} />);
  expect(screen.getByText("Leinenhosen nähen")).toBeTruthy();
  expect(screen.getByText("Braune Leinenhose")).toBeTruthy();
  expect(screen.getByText("Stellt 5 Stück her")).toBeTruthy();
});

test("tooltip without item shows recipe name and effect", () => {
  render(<RecipeTooltip name={enchantment.name} recipe={enchantment} />);
  expect(screen.getByText("Armschiene - Minderwertige Ausdauer")).toBeTruthy();
  expect(screen.getByText(/^Armschienen dauerhaft so verzaubern/).className).toContain("item-tip-green");
  expect(screen.getByText("1× Magiepartikel")).toBeTruthy();
});

test("tooltip without details shows only the name and a note", () => {
  render(<RecipeTooltip name="Bolt of Linen Cloth" recipe={null} />);
  expect(screen.getByText("Bolt of Linen Cloth")).toBeTruthy();
  expect(screen.getByText("Details folgen nach dem nächsten Datenabruf.")).toBeTruthy();
});

test("icon in a quality border, the default border without an item", () => {
  const { container } = render(
    <>
      <RecipeIcon name="Braune Leinenhose" recipe={pants} size={40} />
      <RecipeIcon name="Verzauberung" recipe={enchantment} size={40} />
    </>,
  );
  const [a, b] = [...container.querySelectorAll<HTMLElement>(".icon")];
  expect(a.style.borderColor).toBe("rgb(30, 255, 0)");
  expect(within(a).getByRole("img", { name: "Braune Leinenhose" })).toBeTruthy();
  expect(b.style.borderColor).toBe("");
  expect(b.getAttribute("aria-label")).toBe("Verzauberung");
});

test("tooltip shows the slot count of a bag"
, () => {
  const bag: RecipeView = {
    ...pants, name: "Leinentasche",
    item: { id: 4238, name: "Leinentasche", quality: "COMMON", itemLevel: null, tooltip: { ...pants.item!.tooltip!, armor: null, stats: [], containerSlots: "6 Platz Behälter" } },
  };
  render(<RecipeTooltip name="Leinentasche" recipe={bag} />);
  expect(screen.getByText("6 Platz Behälter")).toBeTruthy();
});
