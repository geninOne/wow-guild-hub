// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test, vi } from "vitest";
import { GuildPage } from "../../web/src/pages/GuildPage";
import type { GuildView, MemberRow } from "../../src/api/types";
import { SpracheProvider, type Sprache } from "../../web/src/lib/sprache";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function member(over: Partial<MemberRow>): MemberRow {
  return {
    id: 1,
    name: "X",
    surname: null,
    slug: "x",
    level: 10,
    classId: 5,
    className: "Priester",
    raceId: 1,
    raceName: "Mensch",
    rank: 1,
    rankName: "Offizier",
    itemLevel: null,
    mainSpecName: null,
    hasProfile: true,
    former: false,
    guildSlug: "bärenklaue",
    guildName: "Bärenklaue",
    professions: [],
    ...over,
  };
}

const view: GuildView = {
  fetchedAt: "2026-11-06T09:13:00Z",
  name: "Bärenklaue",
  faction: "HORDE",
  rulesetName: "Classic Era",
  memberCount: 3,
  guilds: [
    { slug: "bärenklaue", name: "Bärenklaue", faction: "HORDE", memberCount: 76, main: true },
    { slug: "goldene-bärenklaue", name: "Goldene Bärenklaue", faction: "ALLIANCE", memberCount: 19, main: false },
  ],
  classes: [{ id: 5, name: "Priester" }, { id: 1, name: "Krieger" }],
  ranks: [
    { guildSlug: "bärenklaue", rank: 1, name: "Gildenleitung" },
    { guildSlug: "goldene-bärenklaue", rank: 1, name: "Rang 1" },
  ],
  members: [
    member({ id: 1, name: "Gelmar", surname: "Soulvenn", slug: "gelmar-soulvenn", level: 40, itemLevel: 25, mainSpecName: "Heilig" }),
    member({
      id: 2, name: "Neuling", slug: "neuling", level: 5, hasProfile: false, classId: 1, className: "Krieger",
      guildSlug: "goldene-bärenklaue", guildName: "Goldene Bärenklaue",
    }),
    member({ id: 3, name: "Alter Hase", slug: "alter-hase", level: 60, former: true }),
  ],
};

function mockFetch() {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(view), { status: 200 })));
}

function renderPage() {
  render(
    <MemoryRouter>
      <GuildPage />
    </MemoryRouter>,
  );
}

test("Tabelle zeigt Aktive und blendet Ehemalige erst nach Schalter ein", async () => {
  mockFetch();
  renderPage();
  const link = await screen.findByRole("link", { name: "Gelmar Soulvenn" });
  expect(link.getAttribute("href")).toBe("/charakter/gelmar-soulvenn");
  expect(screen.queryByText("Alter Hase")).toBeNull();
  fireEvent.click(screen.getByLabelText("Ehemalige anzeigen"));
  expect(screen.getByText("Alter Hase")).toBeTruthy();
  expect(screen.getByText("ehemalig")).toBeTruthy();
});

test("Kopf, Hinweis ohne Profil, k. A. und Standardsortierung nach Level", async () => {
  mockFetch();
  renderPage();
  await screen.findByText("Gelmar Soulvenn");
  expect(screen.getByText(/Stand: 06\.11\.2026, 10:13 Uhr/)).toBeTruthy();
  expect(screen.getByText(/Normal|Classic Era/).textContent).toContain("Classic Era");
  expect(screen.getByTitle("Details erst ab Level 10")).toBeTruthy();
  const table = screen.getByRole("table");
  const bodyRows = within(table).getAllByRole("row").slice(1);
  expect(bodyRows[0].textContent).toContain("Gelmar");
  expect(within(bodyRows[1]).getAllByText("k. A.").length).toBeGreaterThan(0);
});

test("Klick auf Spaltenkopf sortiert, zweiter Klick dreht um", async () => {
  mockFetch();
  renderPage();
  await screen.findByText("Gelmar Soulvenn");
  const names = () =>
    within(screen.getByRole("table")).getAllByRole("row").slice(1).map((r) => r.textContent ?? "");
  fireEvent.click(screen.getByRole("button", { name: /^Name/ }));
  expect(names()[0]).toContain("Gelmar");
  fireEvent.click(screen.getByRole("button", { name: /^Name/ }));
  expect(names()[0]).toContain("Neuling");
});

test("Kopf nennt beide Gilden, Bärenklaue zuerst, mit Wappen", async () => {
  mockFetch();
  renderPage();
  await screen.findByText("Gelmar Soulvenn");
  const kopf = document.querySelector(".guild-heads")!;
  expect(kopf.textContent).toMatch(/Bärenklaue.*Horde.*76 Mitglieder.*Goldene Bärenklaue.*Allianz.*19 Mitglieder/);
  expect(within(kopf as HTMLElement).getAllByRole("img").map((i) => i.getAttribute("alt"))).toEqual(["Horde", "Allianz"]);
});

test("Gildenspalte mit Wappen und Filter Alle / Bärenklaue / Goldene Bärenklaue", async () => {
  mockFetch();
  renderPage();
  await screen.findByText("Gelmar Soulvenn");
  const table = screen.getByRole("table");
  expect(within(table).getByRole("columnheader", { name: /Gilde/ })).toBeTruthy();
  expect(within(table).getByRole("img", { name: "Allianz" })).toBeTruthy();

  const filter = screen.getByRole("radiogroup", { name: "Gilde" });
  expect(within(filter).getAllByRole("radio").map((b) => b.textContent)).toEqual(["Alle", "Bärenklaue", "Goldene Bärenklaue"]);
  expect(within(filter).getByRole("radio", { name: "Alle" }).getAttribute("aria-checked")).toBe("true");

  fireEvent.click(within(filter).getByRole("radio", { name: "Goldene Bärenklaue" }));
  expect(within(filter).getByRole("radio", { name: "Goldene Bärenklaue" }).getAttribute("aria-checked")).toBe("true");
  expect(screen.queryByText("Gelmar Soulvenn")).toBeNull();
  expect(screen.getByText("Neuling")).toBeTruthy();
  // Klassenverteilung ist auf die Statistikseite umgezogen
  expect(document.querySelector(".class-bars")).toBeNull();
  expect(screen.queryByText("Klassenverteilung")).toBeNull();
});

test("Rang-Filter: bei Alle nach Gilde gruppiert, bei gewählter Gilde nur deren Namen", async () => {
  mockFetch();
  renderPage();
  await screen.findByText("Gelmar Soulvenn");
  const rang = screen.getByLabelText("Rang") as HTMLSelectElement;
  const gruppen = () => [...rang.querySelectorAll("optgroup")].map((g) => `${g.label}: ${[...g.querySelectorAll("option")].map((o) => o.textContent).join(", ")}`);
  expect(gruppen()).toEqual(["Bärenklaue: Gildenleitung", "Goldene Bärenklaue: Rang 1"]);

  fireEvent.change(rang, { target: { value: "goldene-bärenklaue:1" } });
  expect(screen.queryByText("Gelmar Soulvenn")).toBeNull();
  expect(screen.getByText("Neuling")).toBeTruthy();

  fireEvent.click(screen.getByRole("radio", { name: "Bärenklaue" }));
  expect(rang.value).toBe("");
  expect(rang.querySelectorAll("optgroup")).toHaveLength(0);
  expect([...rang.options].map((o) => o.textContent)).toEqual(["Alle Ränge", "Gildenleitung"]);
});

function renderIn(sprache: Sprache) {
  render(
    <SpracheProvider start={sprache}>
      <MemoryRouter>
        <GuildPage />
      </MemoryRouter>
    </SpracheProvider>,
  );
}

test("Gildenseite auf Schwäbisch: Bedienelemente leicht gefärbt, amtliche Namen unverändert", async () => {
  mockFetch();
  renderIn("schwaebisch");
  await screen.findByText("Gelmar Soulvenn");
  expect(screen.getByRole("heading", { level: 1, name: "Gildenübersicht" })).toBeTruthy();
  expect(screen.getByRole("option", { name: "Älle Klassa" })).toBeTruthy();
  expect(screen.getByLabelText("Ehemalige zoiga")).toBeTruthy();
  expect(screen.getByRole("radio", { name: "Älle" })).toBeTruthy();
  expect(screen.getByRole("option", { name: "Priester" })).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Name sucha"), { target: { value: "gibtsnet" } });
  expect(screen.getByText("Koine Mitglieder gfonda.")).toBeTruthy();
});

test("Gildenseite auf Bayrisch", async () => {
  mockFetch();
  renderIn("bayrisch");
  await screen.findByText("Gelmar Soulvenn");
  expect(screen.getByRole("heading", { level: 1, name: "Gildnübersicht" })).toBeTruthy();
  expect(screen.getByRole("option", { name: "Olle Räng" })).toBeTruthy();
  expect(screen.getByRole("radio", { name: "Olle" })).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Nam suachn"), { target: { value: "gibtsned" } });
  expect(screen.getByText("Koane Mitglieder gfundn.")).toBeTruthy();
});
