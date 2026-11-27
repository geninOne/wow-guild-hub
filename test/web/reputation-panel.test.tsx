// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import type { ReputationView } from "../../src/api/types";
import { ReputationPanel } from "../../web/src/components/ReputationPanel";

afterEach(cleanup);

const view: ReputationView = {
  available: true,
  groups: [
    {
      name: "Horde",
      factions: [
        { id: 81, name: "Donnerfels", tier: 3, tierName: "Neutral", value: 2116, max: 3000 },
        { id: 76, name: "Orgrimmar", tier: 4, tierName: "Freundlich", value: 1485, max: 6000 },
      ],
    },
    { name: "Weitere Fraktionen", factions: [{ id: 70, name: "Syndikat", tier: 1, tierName: "Feindselig", value: 500, max: 3000 }] },
  ],
};

test("groups with factions, standing name and bar", () => {
  render(<ReputationPanel view={view} />);
  const horde = screen.getByRole("heading", { name: "Horde" }).closest("section")!;
  const orgrimmar = within(horde).getByText("Orgrimmar").closest("li")!;
  expect(orgrimmar.textContent).toContain("Freundlich");
  expect(orgrimmar.textContent).toContain("1485 / 6000");
  const fill = orgrimmar.querySelector<HTMLElement>(".reputation-fill")!;
  expect(fill.style.width).toBe("24.75%");
  expect(fill.className).toContain("reputation-friendly");
  expect(screen.getByText("Syndikat").closest("li")!.querySelector(".reputation-hostile")).toBeTruthy();
  expect(screen.getByText("Donnerfels").closest("li")!.querySelector(".reputation-neutral")).toBeTruthy();
});

test("friendly notes without data and without factions"
, () => {
  render(<ReputationPanel view={{ available: false, groups: [] }} />);
  expect(screen.getByText("Rufdaten werden gerade zusammengetragen. Schau bald wieder vorbei.")).toBeTruthy();
  cleanup();
  render(<ReputationPanel view={{ available: true, groups: [] }} />);
  expect(screen.getByText("Noch keinen Ruf bei einer Fraktion gesammelt.")).toBeTruthy();
});
