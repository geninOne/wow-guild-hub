// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, expect, test, vi } from "vitest";
import type { ProfessionRecipe, ProfessionRecipesView, ProfessionsView } from "../../src/api/types";
import { ProfessionsPage } from "../../web/src/pages/ProfessionsPage";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const gelmar = {
  id: 1647409, name: "Gelmar", surname: "Soulvenn", slug: "gelmar-soulvenn", classId: 5, className: "Priester",
  former: false, guildSlug: "bärenklaue",
};
const gold = { id: 7, name: "Goldi", surname: null, slug: "goldi", classId: 2, className: "Paladin", former: false, guildSlug: "goldene-bärenklaue" };

const prof = (id: number, name: string, slug: string, group: string, members: ProfessionsView["professions"][number]["members"]) => ({
  id, name, slug, group, icon: id === 186 ? "https://render.worldofwarcraft.com/forever-eu/icons/56/136248.jpg" : null,
  primary: group !== "Nebenberufe", members,
});

const view: ProfessionsView = {
  guilds: [
    { slug: "bärenklaue", name: "Bärenklaue", faction: "HORDE", memberCount: 76, main: true },
    { slug: "goldene-bärenklaue", name: "Goldene Bärenklaue", faction: "ALLIANCE", memberCount: 19, main: false },
  ],
  professions: [
    prof(171, "Alchemie", "alchemie", "Handwerk", []),
    prof(197, "Schneiderei", "schneiderei", "Handwerk", [{ ...gelmar, skill: 37, max: 75 }, { ...gold, skill: 5, max: 75 }]),
    prof(186, "Bergbau", "bergbau", "Sammeln", [{ ...gelmar, skill: 10, max: 75 }]),
    prof(185, "Kochkunst", "kochkunst", "Nebenberufe", [{ ...gold, skill: 40, max: 75 }]),
  ],
  characters: { "1647409": gelmar, "7": gold },
};

const ballen: ProfessionRecipe = {
  id: 2963, name: "Leinenstoffballen", characterIds: [7, 1647409],
  recipe: {
    id: 2963, name: "Leinenstoffballen", description: null, icon: "https://render.worldofwarcraft.com/forever-eu/icons/56/132889.jpg",
    craftedQuantity: 1,
    item: { id: 2996, name: "Leinenstoffballen", quality: "COMMON", itemLevel: null, tooltip: null },
    reagents: [{ id: 2589, name: "Leinenstoff", quantity: 2, icon: null }],
  },
};
const hose: ProfessionRecipe = {
  id: 2408, name: "Braune Leinenhose", characterIds: [1647409],
  recipe: {
    id: 2408, name: "Braune Leinenhose", description: null, icon: null, craftedQuantity: 1,
    item: { id: 4343, name: "Braune Leinenhose", quality: "UNCOMMON", itemLevel: 10, tooltip: null },
    reagents: [],
  },
};

const recipesBy: Record<string, ProfessionRecipesView> = {
  schneiderei: { professionId: 197, slug: "schneiderei", recipes: [hose, ballen, { id: null, name: "Old Recipe", characterIds: [7], recipe: null }] },
  bergbau: {
    professionId: 186, slug: "bergbau",
    recipes: [
      { id: 2659, name: "Bronze verhütten", characterIds: [1647409], recipe: null },
      { id: 2657, name: "Kupfer verhütten", characterIds: [1647409], recipe: null },
    ],
  },
};

function Where() {
  return <span data-testid="pfad">{useLocation().pathname}</span>;
}

function renderAt(path: string, base: ProfessionsView = view, recipes = recipesBy) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/professions") return new Response(JSON.stringify(base), { status: 200 });
      const slug = decodeURIComponent(url.replace("/api/professions/", ""));
      const body = recipes[slug] ?? { professionId: 0, slug, recipes: [] };
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/berufe" element={<ProfessionsPage />} />
        <Route path="/berufe/:beruf" element={<ProfessionsPage />} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
}

const nav = () => screen.getByRole("navigation", { name: "Berufe" });
const entry = (link: HTMLElement) =>
  `${link.querySelector(".bench-nav-name")?.textContent}${link.querySelector(".bench-nav-count")?.textContent}`;

test("Liste aller Berufe in Gruppen mit Anzahl, ohne Angabe ist der erste gewählt", async () => {
  renderAt("/berufe");
  await screen.findByRole("heading", { name: "Alchemie", level: 2 });
  expect(within(nav()).getAllByRole("heading").map((h) => h.textContent)).toEqual(["Handwerk", "Sammeln", "Nebenberufe"]);
  const links = within(nav()).getAllByRole("link");
  expect(links.map((l) => [entry(l), l.getAttribute("href")])).toEqual([
    ["Alchemie0", "/berufe/alchemie"],
    ["Schneiderei2", "/berufe/schneiderei"],
    ["Bergbau1", "/berufe/bergbau"],
    ["Kochkunst1", "/berufe/kochkunst"],
  ]);
  expect(links[0].getAttribute("aria-current")).toBe("page");
  expect(screen.getByText("Noch niemand hat Alchemie erlernt.")).toBeTruthy();
});

test("gewählter Beruf aus der URL mit Kopf, Symbol und Personenkarten", async () => {
  renderAt("/berufe/schneiderei");
  const detail = (await screen.findByRole("heading", { name: "Schneiderei", level: 2 })).closest("section")!;
  expect(detail.textContent).toContain("2 Charaktere in beiden Gilden");
  const cards = within(detail).getAllByRole("listitem");
  expect(cards[0].textContent).toContain("Gelmar Soulvenn");
  expect(cards[0].textContent).toContain("Priester · Bärenklaue");
  expect(cards[0].textContent).toContain("37 / 75");
  expect(within(cards[0]).getByRole("img", { name: "Horde" })).toBeTruthy();
  expect(within(cards[0]).getByRole("link", { name: "Gelmar Soulvenn" }).getAttribute("href")).toBe(
    "/charakter/gelmar-soulvenn?reiter=berufe#schneiderei",
  );
  expect(cards[1].textContent).toContain("Paladin · Goldene Bärenklaue");
  expect(within(cards[1]).getByRole("img", { name: "Allianz" })).toBeTruthy();
  expect(within(nav()).getByRole("link", { name: /Schneiderei/ }).getAttribute("aria-current")).toBe("page");
});

const cards = (list: HTMLElement) => [...list.querySelectorAll<HTMLElement>(":scope > li")];

test("Rezeptsuche zeigt Karten mit Icon, Ergebnis und Personen-Chips, leere Suche die Personen", async () => {
  renderAt("/berufe/schneiderei");
  const input = await screen.findByLabelText("Rezept in Schneiderei suchen");
  fireEvent.change(input, { target: { value: "leinen" } });
  const hits = await screen.findByRole("list", { name: "Treffer" });
  const [first, second] = cards(hits);
  expect(cards(hits)).toHaveLength(2);
  expect(first.querySelector(".recipe-card-name")?.textContent).toBe("Braune Leinenhose");
  expect(first.textContent).toContain("kennt 1 Charakter");
  expect(second.textContent).toContain("kennen 2 Charaktere");
  expect(second.textContent).toContain("2× Leinenstoff");
  const chips = within(within(second).getByRole("list", { name: "Wer kennt Leinenstoffballen" })).getAllByRole("link");
  expect(chips.map((c) => c.textContent)).toEqual(["Gelmar Soulvenn37", "Goldi5"]);
  expect(chips.map((c) => c.querySelector("img")?.getAttribute("alt"))).toEqual(["Horde", "Allianz"]);
  expect(chips[0].getAttribute("href")).toBe("/charakter/gelmar-soulvenn?reiter=berufe#schneiderei");
  expect(within(chips[1]).getByRole("img", { name: "Allianz" })).toBeTruthy();
  fireEvent.focus(first.querySelector(".tooltip-trigger")!);
  expect(screen.getByRole("tooltip").textContent).toContain("Braune Leinenhose");
  fireEvent.change(input, { target: { value: "gibtsnicht" } });
  expect(screen.getByText("Kein Rezept gefunden.")).toBeTruthy();
  fireEvent.change(input, { target: { value: "" } });
  expect(screen.queryByRole("list", { name: "Treffer" })).toBeNull();
  expect(screen.getByRole("list", { name: "Personen" })).toBeTruthy();
});

test("Rezeptsuche nur im gewählten Beruf", async () => {
  renderAt("/berufe/bergbau");
  fireEvent.change(await screen.findByLabelText("Rezept in Bergbau suchen"), { target: { value: "verh" } });
  const hits = await screen.findByRole("list", { name: "Treffer" });
  expect(cards(hits).map((c) => c.querySelector(".recipe-card-name")?.textContent)).toEqual(["Bronze verhütten", "Kupfer verhütten"]);
  expect(cards(hits)[0].textContent).toContain("Details folgen");
});

test("Umschalter zeigt alle Rezepte des Berufs", async () => {
  renderAt("/berufe/schneiderei");
  const toggle = await screen.findByRole("button", { name: "Alle Rezepte (3)" });
  expect(screen.getByRole("button", { name: "Personen (2)" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(toggle);
  expect(toggle.getAttribute("aria-pressed")).toBe("true");
  const list = screen.getByRole("list", { name: "Rezepte" });
  expect(cards(list).map((c) => c.querySelector(".recipe-card-name")?.textContent)).toEqual([
    "Braune Leinenhose", "Leinenstoffballen", "Old Recipe",
  ]);
});

test("Gildenfilter wirkt auf Anzahl, Karten, Treffer und Chips", async () => {
  renderAt("/berufe/schneiderei");
  await screen.findByRole("heading", { name: "Schneiderei", level: 2 });
  fireEvent.click(within(screen.getByRole("radiogroup", { name: "Gilde" })).getByRole("radio", { name: "Bärenklaue" }));
  expect(entry(within(nav()).getByRole("link", { name: /Kochkunst/ }))).toBe("Kochkunst0");
  const detail = screen.getByRole("heading", { name: "Schneiderei", level: 2 }).closest("section")!;
  expect(detail.textContent).toContain("1 Charakter in Bärenklaue");
  expect(within(detail).queryByText("Goldi")).toBeNull();
  expect(await screen.findByRole("button", { name: "Alle Rezepte (2)" })).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Rezept in Schneiderei suchen"), { target: { value: "ballen" } });
  const [hit] = cards(await screen.findByRole("list", { name: "Treffer" }));
  expect(hit.textContent).toContain("kennt 1 Charakter");
  expect(within(hit).queryByText("Goldi")).toBeNull();
});

test("Viele Personen sind eingeklappt, alle anzeigen klappt auf", async () => {
  const people = Array.from({ length: 20 }, (_, i) => ({
    id: 100 + i, name: `Person${String(i).padStart(2, "0")}`, surname: null, slug: `person${i}`, classId: 1,
    className: "Krieger", former: false, guildSlug: "bärenklaue", skill: 50 - i, max: 75,
  }));
  const base: ProfessionsView = {
    ...view,
    professions: view.professions.map((p) => (p.id === 197 ? { ...p, members: people } : p)),
    characters: Object.fromEntries(people.map((p) => [String(p.id), p])),
  };
  const tasche: ProfessionRecipe = { id: 3755, name: "Leinentasche", characterIds: people.map((p) => p.id), recipe: null };
  renderAt("/berufe/schneiderei", base, { schneiderei: { professionId: 197, slug: "schneiderei", recipes: [tasche] } });
  fireEvent.change(await screen.findByLabelText("Rezept in Schneiderei suchen"), { target: { value: "tasche" } });
  await screen.findByRole("list", { name: "Treffer" });
  const chips = () => within(screen.getByRole("list", { name: "Wer kennt Leinentasche" })).getAllByRole("link");
  expect(chips()).toHaveLength(6);
  expect(chips()[0].textContent).toContain("Person00");
  fireEvent.click(screen.getByRole("button", { name: "alle 20 anzeigen" }));
  expect(chips()).toHaveLength(20);
  fireEvent.click(screen.getByRole("button", { name: "weniger anzeigen" }));
  expect(chips()).toHaveLength(6);
});

test("Auswahlfeld für schmale Bildschirme wechselt den Beruf über die URL", async () => {
  renderAt("/berufe/schneiderei");
  await screen.findByRole("heading", { name: "Schneiderei", level: 2 });
  fireEvent.change(screen.getByLabelText("Beruf wählen"), { target: { value: "kochkunst" } });
  expect(screen.getByTestId("pfad").textContent).toBe("/berufe/kochkunst");
  expect(await screen.findByRole("heading", { name: "Kochkunst", level: 2 })).toBeTruthy();
});

test("unbekannter Beruf in der URL zeigt den ersten", async () => {
  renderAt("/berufe/gibtsnicht");
  expect(await screen.findByRole("heading", { name: "Alchemie", level: 2 })).toBeTruthy();
});
