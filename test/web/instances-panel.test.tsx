// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import type { InstancesView } from "../../src/api/types";
import { InstancesPanel } from "../../web/src/components/InstancesPanel";

afterEach(cleanup);

const TILE = "https://render.worldofwarcraft.com/eu/zones/ragefire-chasm-small.jpg";
type Dungeon = InstancesView["dungeonTiers"][number]["dungeons"][number];

const dungeon = (over: Partial<Dungeon> & { criterionId: number; name: string }): Dungeon => ({
  description: over.name, completed: false, onAccount: false, tracked: true, kills: [], image: null, levels: null, bosses: null, finalBosses: [], completedAt: null, timesCompleted: 0, ...over,
});

const view: InstancesView = {
  available: true,
  dungeonTiers: [
    {
      achievementId: 62031,
      tier: "Novize",
      dungeons: [
        dungeon({
          criterionId: 1, name: "Flammenschlund", completed: true, image: TILE, levels: { min: 13, max: 18 },
          kills: [{ boss: "Bazzalan", quantity: 1, lastAt: "2026-11-03T18:00:00.000Z" }],
          bosses: ["Flintauge", "Taragaman der Hungerleider", "Bazzalan"], finalBosses: ["Bazzalan"],
          completedAt: "2026-11-03T18:00:00.000Z", timesCompleted: 1,
        }),
        dungeon({
          criterionId: 2, name: "Todesminen", completed: true, levels: { min: 17, max: 26 },
          kills: [{ boss: "Edwin van Cleef", quantity: 3, lastAt: "2026-11-05T18:00:00.000Z" }],
          bosses: ["Rhahk'Zor", "Edwin van Cleef"], finalBosses: ["Edwin van Cleef"],
          completedAt: "2026-11-05T18:00:00.000Z", timesCompleted: 3,
        }),
        dungeon({ criterionId: 3, name: "Höhlen des Wehklagens", levels: { min: 15, max: 25 }, bosses: ["A", "B", "Mutanus"], finalBosses: ["Mutanus"] }),
        dungeon({ criterionId: 4, name: "Ruinen von Lordaeron", completed: true }),
      ],
    },
    { achievementId: 62033, tier: "Meister", dungeons: [dungeon({ criterionId: 5, name: "Scholomance" })] },
  ],
  raids: [
    {
      achievementId: 62034, name: "Hyjalgipfel", image: null, levels: { min: 60, max: 60 }, completed: false, onAccount: false,
      bosses: [
        ...["Bandalar", "Urtum des Verfalls", "Zeitverlorenes Bataillon"].map((name) => ({ name, defeated: true, lastAt: null })),
        ...Array.from({ length: 10 }, (_, i) => ({ name: `Boss ${i}`, defeated: false, lastAt: null })),
      ],
    },
    {
      achievementId: 684, name: "Onyxia", image: "https://render.worldofwarcraft.com/eu/zones/onyxias-lair-small.jpg", levels: null,
      completed: false, onAccount: false, bosses: [{ name: "Onyxia", defeated: false, lastAt: null }],
    },
  ],
  otherKills: [],
};

const card = (name: string) => screen.getByRole("heading", { name }).closest<HTMLElement>(".instance-card")!;

test("Dungeon-Karte: Name und Stufe oben, goldener Wimpel mit Datum fest oben rechts, Bosse unten", () => {
  render(<InstancesPanel view={view} />);
  const flamme = card("Flammenschlund");
  expect(flamme.className).toContain("instance-card-done");
  expect(flamme.querySelector("img.instance-card-img")?.getAttribute("src")).toBe(TILE);
  const head = flamme.querySelector(".instance-card-head")!;
  // Wimpel steht zuerst im Kopf (schwimmt rechts oben), danach Name und Stufe.
  expect([...head.children].map((e) => e.className)).toEqual(["instance-pennant", "instance-card-name", "instance-card-level"]);
  const pennant = head.querySelector(".instance-pennant")!;
  expect(pennant.textContent).toBe("✦Abgeschlossen 03.11.");
  expect(pennant.getAttribute("title")).toBe("Abgeschlossen am 03.11.2026");
  expect(head.querySelector(".instance-card-level")?.textContent).toBe("Stufe 13 bis 18");
  expect(flamme.querySelector(".instance-card-content > :last-child")?.className).toBe("instance-card-bosses");
  expect(flamme.querySelector(".instance-card-bosses")?.textContent).toBe("Bosse: Flintauge, Taragaman der Hungerleider, Bazzalan");
  expect(flamme.querySelector(".instance-final-boss")?.textContent).toBe("Bazzalan");
  expect(within(flamme).queryAllByRole("listitem")).toHaveLength(0);
  expect(flamme.textContent).not.toMatch(/von \d+ Bossen|✔|Noch nicht besucht/);
});

test("Wimpel mit Anzahl bei mehreren Siegen, ohne Datum nur Abgeschlossen; offen gedämpft mit ruhigem Hinweis", () => {
  render(<InstancesPanel view={view} />);
  const todesminen = card("Todesminen").querySelector(".instance-pennant")!;
  expect(todesminen.textContent).toBe("✦Abgeschlossen 05.11. 3×");
  expect(todesminen.getAttribute("title")).toBe("Abgeschlossen am 05.11.2026, 3 Mal");
  const ruinen = card("Ruinen von Lordaeron");
  expect(ruinen.querySelector(".instance-pennant")?.textContent).toBe("✦Abgeschlossen");
  const hoehlen = card("Höhlen des Wehklagens");
  expect(hoehlen.className).toContain("instance-card-open");
  expect(hoehlen.querySelector(".instance-pennant")).toBeNull();
  expect(hoehlen.querySelector(".instance-card-head > .instance-card-note")?.textContent).toBe("Noch nicht besucht");
  expect(hoehlen.textContent).toContain("Bosse: A, B, Mutanus");
});

test("ohne Bild ein eigener Hintergrund statt Platzhalter-Symbol, Grundton je Ort fest", () => {
  render(<InstancesPanel view={view} />);
  const art = card("Ruinen von Lordaeron").querySelector<HTMLElement>(".instance-card-art")!;
  expect(art).toBeTruthy();
  expect(art.querySelector("svg")).toBeNull();
  expect(art.style.getPropertyValue("--art-tint")).toMatch(/^\d+ \d+ \d+$/);
  expect(card("Hyjalgipfel").querySelector(".instance-card-art")).toBeTruthy();
  expect(card("Onyxia").querySelector(".instance-card-art")).toBeNull();
});

test("nur zwei Bereiche Dungeons und Raids, Dungeons nach Stufe, ohne Stufe am Ende in alter Reihenfolge", () => {
  render(<InstancesPanel view={view} />);
  expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Dungeons", "Raids"]);
  expect(document.body.textContent).not.toMatch(/Novize|Erfahren|Meister/);
  expect(document.querySelector("details")).toBeNull();
  const dungeons = screen.getByRole("heading", { name: "Dungeons", level: 2 }).closest("section")!;
  expect(within(dungeons).getAllByRole("heading", { level: 4 }).map((h) => h.textContent)).toEqual([
    "Flammenschlund",
    "Höhlen des Wehklagens",
    "Todesminen",
    "Ruinen von Lordaeron",
    "Scholomance",
  ]);
});

test("Raids nach denselben Regeln: begonnen mit Bossanzahl oben rechts, offen gedämpft, abgeschlossen mit Wimpel", () => {
  render(<InstancesPanel view={view} />);
  const hyjal = card("Hyjalgipfel");
  expect(hyjal.querySelector(".instance-card-level")?.textContent).toBe("Stufe 60");
  expect(hyjal.querySelector(".instance-card-head > .instance-card-note")?.textContent).toBe("3 von 13 Bossen");
  expect(hyjal.className).toContain("instance-card-started");
  expect(within(hyjal).getAllByRole("listitem")).toHaveLength(13);
  const onyxia = card("Onyxia");
  expect(onyxia.querySelector(".instance-card-note")?.textContent).toBe("Noch nicht besucht");
  expect(onyxia.className).toContain("instance-card-open");
  expect(within(onyxia).queryAllByRole("listitem")).toHaveLength(0);
  expect(screen.queryByText("Weitere Boss-Siege")).toBeNull();
  cleanup();
  const besiegt = { ...view.raids[1], bosses: [{ name: "Onyxia", defeated: true, lastAt: "2026-11-04T20:00:00.000Z" }] };
  render(<InstancesPanel view={{ ...view, raids: [besiegt] }} />);
  expect(card("Onyxia").className).toContain("instance-card-done");
  expect(card("Onyxia").querySelector(".instance-pennant")?.textContent).toBe("✦Abgeschlossen 04.11.");
});

test("Weitere Boss-Siege nur, wenn vorhanden", () => {
  render(
    <InstancesPanel view={{ ...view, otherKills: [{ boss: "Baron Rivendare", instance: "Stratholme", quantity: 1, lastAt: null }] }} />,
  );
  expect(screen.getByText("Weitere Boss-Siege")).toBeTruthy();
  expect(document.body.textContent).toContain("Baron Rivendare (Stratholme) besiegt");
});

test("ohne Definitionen ein freundlicher Hinweis", () => {
  render(<InstancesPanel view={{ available: false, dungeonTiers: [], raids: [], otherKills: [] }} />);
  expect(screen.getByText("Dungeon- und Raiddaten werden gerade zusammengetragen. Schau bald wieder vorbei.")).toBeTruthy();
});

test("nur accountweit erledigt: kein Wimpel, sondern der Hinweis \"Auf diesem Account\" mit Erklärung", () => {
  const account: InstancesView = {
    ...view,
    dungeonTiers: [{ achievementId: 62033, tier: "Meister", dungeons: [dungeon({ criterionId: 5, name: "Scholomance" }), dungeon({ criterionId: 6, name: "Stratholme: Tot", onAccount: true })] }],
    raids: view.raids.map((r) => (r.name === "Onyxia" ? { ...r, onAccount: true } : r)),
  };
  render(<InstancesPanel view={account} />);
  for (const name of ["Stratholme: Tot", "Onyxia"]) {
    const c = card(name);
    expect(c.className).toContain("instance-card-account");
    expect(c.querySelector(".instance-pennant")).toBeNull();
    const note = c.querySelector(".instance-card-note-account")!;
    expect(note.textContent).toBe("Auf diesem Account");
    expect(note.getAttribute("title")).toContain("nur für den ganzen Account");
  }
  expect(card("Scholomance").querySelector(".instance-card-note")?.textContent).toBe("Noch nicht besucht");
});

test("ohne Statistik: der Hinweis erklärt, dass der Abschluss je Charakter unbekannt ist", () => {
  const sumpf: InstancesView = {
    ...view,
    dungeonTiers: [{ achievementId: 62031, tier: "Novize", dungeons: [dungeon({ criterionId: 7, name: "Ausgrabungsstätte: Sumpfland", onAccount: true, tracked: false })] }],
    raids: [],
  };
  render(<InstancesPanel view={sumpf} />);
  const note = card("Ausgrabungsstätte: Sumpfland").querySelector(".instance-card-note-account")!;
  expect(note.textContent).toBe("Auf diesem Account");
  expect(note.getAttribute("title")).toContain("nicht bekannt");
});
