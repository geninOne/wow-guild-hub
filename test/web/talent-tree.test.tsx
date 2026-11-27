// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { TALENT_FIXES } from "../../src/api/config";
import { layoutTalentTree } from "../../src/api/talent-layout";
import type { TalentView } from "../../src/api/types";
import type { CharacterRecord, TalentTreeRecord } from "../../src/model";
import { TalentTree } from "../../web/src/components/TalentTree";

afterEach(cleanup);

function fixture<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8")) as T;
}

const tree = fixture<TalentTreeRecord>("test/fixtures/records/talent-trees/1114.json");
const gelmar = fixture<CharacterRecord>("test/fixtures/records/character-1647409.json");
const view: TalentView = { layout: layoutTalentTree(tree, TALENT_FIXES), icons: {} };

/** Node element that carries the (hidden) talent name. */
function nodeOf(name: string): HTMLElement {
  const label = screen.getByText(name);
  const el = label.closest<HTMLElement>(".talent-node");
  if (!el) throw new Error(`No node for ${name}`);
  return el;
}

test("Gelmar: three trees, Discipline 1 point, ranks x/y", () => {
  render(<TalentTree view={view} specs={gelmar.specs} />);

  const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
  expect(headings).toEqual(["Disziplin", "Heilig", "Schattenmagie"]);

  const trees = screen.getAllByRole("region");
  expect(within(trees[0]).getByText("1 Punkt")).toBeTruthy();
  expect(within(trees[1]).getByText("0 Punkte")).toBeTruthy();
  expect(within(trees[2]).getByText("0 Punkte")).toBeTruthy();
  expect(screen.getByText("Verteilte Punkte 1")).toBeTruthy();
  expect(screen.queryByText("Noch keine Talentpunkte verteilt")).toBeNull();

  const wand = nodeOf("Zauberstab-Spezialisierung");
  expect(within(wand).getByText("1/2")).toBeTruthy();
  expect(wand.className).toContain("talent-partial");

  const mental = nodeOf("Mentale Stärke");
  expect(within(mental).getByText("0/5")).toBeTruthy();
  expect(mental.className).toContain("talent-empty");

  expect(screen.getAllByText("Heiligspezialisierung")).toHaveLength(1);
  expect(screen.getByText("Unbenanntes Talent")).toBeTruthy();
});

test("arrows are drawn and colored by their target", () => {
  const { container } = render(<TalentTree view={view} specs={gelmar.specs} />);
  const arrows = container.querySelectorAll(".talent-arrow");
  expect(arrows.length).toBeGreaterThan(0);
  expect(container.querySelectorAll(".talent-arrow-active")).toHaveLength(0);
  cleanup();

  // Seelenwehr (talentId 135369) requires Verbessertes Machtwort: Schild; with points in the target, the arrow is gold.
  const withTarget = [{ ...gelmar.specs[0], talents: [{ talentId: 135369, spellId: 0, name: "Seelenwehr", rank: 1, description: "" }] }];
  const { container: c2 } = render(<TalentTree view={view} specs={withTarget} />);
  expect(c2.querySelectorAll(".talent-arrow-active")).toHaveLength(1);
});

test("tooltip shows rank, current and next description", () => {
  render(<TalentTree view={view} specs={gelmar.specs} />);
  const trigger = nodeOf("Zauberstab-Spezialisierung").querySelector<HTMLElement>(".tooltip-trigger")!;
  fireEvent.focus(trigger);
  const tip = screen.getByRole("tooltip");
  expect(within(tip).getByText("Zauberstab-Spezialisierung")).toBeTruthy();
  expect(within(tip).getByText("Rang 1/2")).toBeTruthy();
  expect(within(tip).getByText("Nächster Rang:")).toBeTruthy();
  expect(tip.textContent).toMatch(/Zauberstäben um 13%/);
});

test("without points: note and all trees with 0 points"
, () => {
  render(<TalentTree view={view} specs={[]} />);
  expect(screen.getByText("Noch keine Talentpunkte verteilt")).toBeTruthy();
  expect(screen.getByText("Verteilte Punkte 0")).toBeTruthy();
  expect(screen.getAllByText("0 Punkte")).toHaveLength(3);
});
