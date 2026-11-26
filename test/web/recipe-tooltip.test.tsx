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

const STOFF = "https://render.worldofwarcraft.com/forever-eu/icons/56/inv_fabric_linen_02.jpg";

function view(recipe: string, icon: string | null, item: string | null): RecipeView {
  const d = toRecipeDetail(loadFixture(recipe).data, icon, item ? loadFixture(item).data : null);
  return { ...d, reagents: d.reagents.map((r) => ({ ...r, icon: r.id === 2996 ? STOFF : null })) };
}

const hose = view("recipe-2408", "https://render.worldofwarcraft.com/forever-eu/icons/56/134586.jpg", "item-4343");
const verzauberung = view("recipe-4289", null, null);

test("Tooltip mit Gegenstand: Name einmal, Werte, Materialien mit Menge und Icon", () => {
  const { container } = render(<RecipeTooltip name="Braune Leinenhose" recipe={hose} />);
  expect(screen.getAllByText("Braune Leinenhose")).toHaveLength(1);
  expect(screen.getByText("17 Rüstung")).toBeTruthy();
  expect(screen.getByText("+1 Zaubermacht")).toBeTruthy();
  expect(screen.getByText("Materialien")).toBeTruthy();
  const reagents = [...container.querySelectorAll(".recipe-tip-reagents li")].map((li) => li.textContent);
  expect(reagents).toEqual(["2× Leinenstoffballen", "1× Grober Faden"]);
  expect(container.querySelector(".recipe-tip-reagents img")?.getAttribute("src")).toBe(STOFF);
  expect(screen.queryByText(/Stellt/)).toBeNull();
});

test("Tooltip mit Menge über 1 und abweichendem Rezeptnamen", () => {
  render(<RecipeTooltip name="Leinenhosen nähen" recipe={{ ...hose, name: "Leinenhosen nähen", craftedQuantity: 5 }} />);
  expect(screen.getByText("Leinenhosen nähen")).toBeTruthy();
  expect(screen.getByText("Braune Leinenhose")).toBeTruthy();
  expect(screen.getByText("Stellt 5 Stück her")).toBeTruthy();
});

test("Tooltip ohne Gegenstand zeigt Rezeptname und Wirkung", () => {
  render(<RecipeTooltip name={verzauberung.name} recipe={verzauberung} />);
  expect(screen.getByText("Armschiene - Minderwertige Ausdauer")).toBeTruthy();
  expect(screen.getByText(/^Armschienen dauerhaft so verzaubern/).className).toContain("item-tip-green");
  expect(screen.getByText("1× Magiepartikel")).toBeTruthy();
});

test("Tooltip ohne Details nennt nur den Namen und einen Hinweis", () => {
  render(<RecipeTooltip name="Bolt of Linen Cloth" recipe={null} />);
  expect(screen.getByText("Bolt of Linen Cloth")).toBeTruthy();
  expect(screen.getByText("Details folgen nach dem nächsten Datenabruf.")).toBeTruthy();
});

test("Icon im Qualitätsrahmen, ohne Gegenstand im Standardrahmen", () => {
  const { container } = render(
    <>
      <RecipeIcon name="Braune Leinenhose" recipe={hose} size={40} />
      <RecipeIcon name="Verzauberung" recipe={verzauberung} size={40} />
    </>,
  );
  const [a, b] = [...container.querySelectorAll<HTMLElement>(".icon")];
  expect(a.style.borderColor).toBe("rgb(30, 255, 0)");
  expect(within(a).getByRole("img", { name: "Braune Leinenhose" })).toBeTruthy();
  expect(b.style.borderColor).toBe("");
  expect(b.getAttribute("aria-label")).toBe("Verzauberung");
});

test("Tooltip zeigt die Platzzahl einer Tasche", () => {
  const tasche: RecipeView = {
    ...hose, name: "Leinentasche",
    item: { id: 4238, name: "Leinentasche", quality: "COMMON", itemLevel: null, tooltip: { ...hose.item!.tooltip!, armor: null, stats: [], containerSlots: "6 Platz Behälter" } },
  };
  render(<RecipeTooltip name="Leinentasche" recipe={tasche} />);
  expect(screen.getByText("6 Platz Behälter")).toBeTruthy();
});
