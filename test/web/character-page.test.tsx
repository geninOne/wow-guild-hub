// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, expect, test, vi } from "vitest";
import { TALENT_FIXES } from "../../src/api/config";
import { layoutTalentTree } from "../../src/api/talent-layout";
import type { CharacterView, TalentView } from "../../src/api/types";
import type { CharacterRecord, EquippedItem, TalentTreeRecord } from "../../src/model";
import { Icon } from "../../web/src/components/Icon";
import { factionName, fallbackIconUrl } from "../../web/src/lib/wow";
import { ItemTooltip } from "../../web/src/components/ItemTooltip";
import { CharacterPage } from "../../web/src/pages/CharacterPage";
import { SpracheProvider, type Sprache } from "../../web/src/lib/sprache";
import { QUALITY_COLORS } from "../../web/src/lib/wow";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const gelmar = JSON.parse(
  readFileSync(resolve(process.cwd(), "test/fixtures/records/character-1647409.json"), "utf8"),
) as CharacterRecord;

function gelmarView(over: Partial<CharacterView> = {}, character: Partial<CharacterRecord> = {}): CharacterView {
  return {
    character: { ...gelmar, ...character },
    className: "Priester",
    raceName: "Untoter",
    guildName: "Bärenklaue",
    guildFaction: "HORDE",
    rank: 3,
    rankName: "Rang 3",
    former: false,
    itemIcons: { "6241": "https://render.worldofwarcraft.com/eu/icons/56/inv_chest_cloth_24.jpg" },
    instances: { available: false, dungeonTiers: [], raids: [], otherKills: [] },
    reputation: { available: false, groups: [] },
    recipes: {},
    ...over,
  };
}

const waistMitTooltip: EquippedItem = {
  slot: "WAIST",
  slotName: "Taille",
  itemId: 9999,
  name: "Gürtel der Probe",
  quality: "UNCOMMON",
  itemLevel: 20,
  enchantments: [],
  tooltip: {
    binding: "Wird beim Aufheben gebunden",
    unique: null,
    slotType: "Taille",
    subclass: "Schwere Rüstung",
    armor: "104 Rüstung",
    block: null,
    damage: null,
    speed: null,
    dps: null,
    stats: ["+3 Stärke", "+7 Ausdauer"],
    spells: [],
    description: null,
    durability: "Haltbarkeit 34 / 35",
    requiredLevel: "Benötigt Stufe 15",
    sellPrice: { gold: 0, silver: 5, copper: 5 },
  },
};

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(async (_path: string) => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

function renderAt(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/charakter/:key" element={<CharacterPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** jsdom liefert Inline-Farben als rgb(); Hex dafür umrechnen. */
function rgb(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

test("Kopf von Gelmar", async () => {
  const fetchMock = mockFetch(200, gelmarView());
  renderAt("/charakter/gelmar-soulvenn");
  expect(await screen.findByRole("heading", { level: 1, name: "Gelmar Soulvenn" })).toBeTruthy();
  expect(fetchMock.mock.calls[0][0]).toBe("/api/characters/gelmar-soulvenn");
  const text = document.body.textContent ?? "";
  expect(text).toContain("10 Untoter Priester");
  expect(text).toContain("<Bärenklaue>");
  expect(text).toContain("Normal");
  expect(text).toContain("GS 3");
  expect(text).toContain("Rang 3");
  expect(text).toContain("Zuletzt online: 06.11.2026, 07:14 Uhr");
  expect(text).not.toContain("Ehemaliges Mitglied");
  expect(screen.getByRole("tab", { name: "Ausrüstung" }).getAttribute("aria-selected")).toBe("true");
});

test("Ehemalige tragen einen Hinweis", async () => {
  mockFetch(200, gelmarView({ former: true }));
  renderAt("/charakter/gelmar-soulvenn");
  expect(await screen.findByText("Ehemaliges Mitglied")).toBeTruthy();
});

test("Leere Slots zeigen den Slotnamen, belegte Slots Name in Qualitätsfarbe", async () => {
  mockFetch(200, gelmarView());
  renderAt("/charakter/gelmar-soulvenn");
  const robe = await screen.findByText("Weiße Leinenrobe");
  expect(screen.getByText("Kopf")).toBeTruthy();
  expect(robe.style.color).toBe(rgb(QUALITY_COLORS.UNCOMMON));
  expect(screen.getByText("Flickwerkschuhe").style.color).toBe(rgb(QUALITY_COLORS.POOR));
  expect(screen.queryByText("Munition")).toBeNull();
  const robeIcon = document.querySelector('img[src$="inv_chest_cloth_24.jpg"]');
  expect(robeIcon).toBeTruthy();
});

test("Fokus auf einem belegten Slot zeigt den Tooltip, Escape schließt ihn", async () => {
  mockFetch(200, gelmarView());
  renderAt("/charakter/gelmar-soulvenn");
  const robe = await screen.findByText("Weiße Leinenrobe");
  const trigger = robe.closest<HTMLElement>("[tabindex='0']")!;
  fireEvent.focus(trigger);
  const tooltip = screen.getByRole("tooltip");
  expect(within(tooltip).getByText("Gegenstandsstufe 10")).toBeTruthy();
  fireEvent.keyDown(trigger, { key: "Escape" });
  expect(screen.queryByRole("tooltip")).toBeNull();
});

test("Tooltip mit allen Feldern und Minimal-Tooltip für alte Daten", () => {
  render(<ItemTooltip item={{ ...waistMitTooltip }} />);
  for (const t of [
    "Gegenstandsstufe 20",
    "Wird beim Aufheben gebunden",
    "Schwere Rüstung",
    "+7 Ausdauer",
    "Haltbarkeit 34 / 35",
    "Benötigt Stufe 15",
  ])
    expect(screen.getByText(t, { exact: false })).toBeTruthy();
  const price = screen.getByLabelText("Verkaufspreis: 5 Silber 5 Kupfer");
  expect(price.textContent).toBe("Verkaufspreis: 5 5");
  expect([...price.querySelectorAll(".coin")].map((c) => c.className)).toEqual(["coin coin-silver", "coin coin-copper"]);
  expect(price.querySelector(".coin-gold")).toBeNull();
  expect(screen.getByText("Gürtel der Probe").style.color).toBe(rgb(QUALITY_COLORS.UNCOMMON));
  cleanup();
  const altesTeil: EquippedItem = {
    slot: "WRIST",
    slotName: "Handgelenke",
    itemId: 1,
    name: "Altes Teil",
    quality: "COMMON",
    itemLevel: 5,
    enchantments: ["Verzaubert: Ausdauer +2"],
  };
  render(<ItemTooltip item={altesTeil} />);
  expect(screen.getByText("Altes Teil")).toBeTruthy();
  expect(screen.getByText("Gegenstandsstufe 5")).toBeTruthy();
  expect(screen.getByText("Verzaubert: Ausdauer +2")).toBeTruthy();
});

test("ohne Bild Platzhalter, ohne Profil Hinweis und keine Reiter", async () => {
  mockFetch(200, gelmarView({}, { media: null }));
  renderAt("/charakter/gelmar-soulvenn");
  expect(await screen.findByText("Kein Charakterbild verfügbar")).toBeTruthy();
  cleanup();

  mockFetch(
    200,
    gelmarView({}, { hasProfile: false, level: 7, equipment: [], media: null, rulesetName: null, lastLoginAt: null }),
  );
  renderAt("/charakter/gelmar-soulvenn");
  expect(await screen.findByText("Blizzard zeigt Details zu Charakteren erst ab Level 10.")).toBeTruthy();
  expect(document.body.textContent).toContain("7 Untoter Priester");
  expect(screen.queryByRole("tab", { name: "Talente" })).toBeNull();
  expect(screen.queryByRole("tablist")).toBeNull();
});

test("Reiter Verlauf und Raids gibt es nicht mehr, alte Links zeigen die Ausrüstung", async () => {
  mockFetch(200, gelmarView());
  renderAt("/charakter/gelmar-soulvenn?reiter=verlauf");
  expect(await screen.findByText("Weiße Leinenrobe")).toBeTruthy();
  const tabs = screen.getAllByRole("tab").map((t) => t.textContent);
  expect(tabs).not.toContain("Verlauf");
  expect(tabs).not.toContain("Raids");
});

test("Reiterwechsel über die Reiterleiste", async () => {
  mockFetch(200, gelmarView());
  renderAt("/charakter/gelmar-soulvenn");
  await screen.findByText("Weiße Leinenrobe");
  fireEvent.click(screen.getByRole("tab", { name: "Talente" }));
  expect(screen.getByRole("tab", { name: "Talente" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.queryByText("Weiße Leinenrobe")).toBeNull();
});

test("Icon ohne Quelle zeigt Platzhalter statt kaputtem Bild", () => {
  const { container } = render(<Icon src={null} alt="x" size={40} />);
  expect(container.querySelector("img")).toBeNull();
  cleanup();
  const { container: c2 } = render(<Icon src="https://render.worldofwarcraft.com/x.jpg" alt="x" size={40} />);
  fireEvent.error(c2.querySelector("img")!);
  expect(c2.querySelector("img")).toBeNull();
});

test("Icon versucht nach einem Ladefehler forever-us und zeigt erst dann den Platzhalter", () => {
  const { container } = render(
    <Icon src="https://render.worldofwarcraft.com/forever-eu/icons/56/a.jpg" alt="x" size={40} />,
  );
  fireEvent.error(container.querySelector("img")!);
  expect(container.querySelector("img")?.getAttribute("src")).toBe(
    "https://render.worldofwarcraft.com/forever-us/icons/56/a.jpg",
  );
  fireEvent.error(container.querySelector("img")!);
  expect(container.querySelector("img")).toBeNull();
});

test("fallbackIconUrl und factionName", () => {
  expect(fallbackIconUrl("https://r.com/forever-eu/icons/56/1.jpg")).toBe("https://r.com/forever-us/icons/56/1.jpg");
  expect(fallbackIconUrl("https://r.com/forever-us/icons/56/1.jpg")).toBeNull();
  expect(fallbackIconUrl("https://r.com/eu/icons/56/1.jpg")).toBeNull();
  expect(factionName("HORDE")).toBe("Horde");
  expect(factionName("ALLIANCE")).toBe("Allianz");
  expect(factionName("X")).toBe("X");
});

test("unbekannter Charakter", async () => {
  mockFetch(404, { error: "Nicht gefunden" });
  renderAt("/charakter/niemand");
  expect(await screen.findByText("Charakter nicht gefunden")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Zur Gildenübersicht" }).getAttribute("href")).toBe("/");
});

function mockRoutes(routes: Record<string, [number, unknown]>) {
  const fn = vi.fn(async (path: string) => {
    const [status, body] = routes[path] ?? [500, { error: "unerwartet" }];
    return new Response(JSON.stringify(body), { status });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

test("Talente-Reiter lädt den Klassenbaum und zeigt ihn", async () => {
  const tree = JSON.parse(
    readFileSync(resolve(process.cwd(), "test/fixtures/records/talent-trees/1114.json"), "utf8"),
  ) as TalentTreeRecord;
  const talents: TalentView = { layout: layoutTalentTree(tree, TALENT_FIXES), icons: {} };
  const fetchMock = mockRoutes({
    "/api/characters/gelmar-soulvenn": [200, gelmarView()],
    "/api/talents/5": [200, talents],
  });
  renderAt("/charakter/gelmar-soulvenn?reiter=talente");
  expect(await screen.findByText("Verteilte Punkte 1")).toBeTruthy();
  expect(fetchMock.mock.calls.map((c) => c[0])).toContain("/api/talents/5");
  expect(screen.getByRole("heading", { level: 2, name: "Schattenmagie" })).toBeTruthy();
});

test("Talente-Reiter ohne gesammelten Baum", async () => {
  mockRoutes({
    "/api/characters/gelmar-soulvenn": [200, gelmarView()],
    "/api/talents/5": [404, { error: "Nicht gefunden" }],
  });
  renderAt("/charakter/gelmar-soulvenn?reiter=talente");
  expect(await screen.findByText("Talentbäume sind noch nicht geladen.")).toBeTruthy();
});

const hose = {
  id: 2408, name: "Braune Leinenhose", description: null,
  icon: "https://render.worldofwarcraft.com/forever-eu/icons/56/134586.jpg", craftedQuantity: 1,
  item: { id: 4343, name: "Braune Leinenhose", quality: "UNCOMMON", itemLevel: 10, tooltip: null },
  reagents: [{ id: 2996, name: "Leinenstoffballen", quantity: 2, icon: null }],
};

test("Reiter Berufe zeigt Balken und Rezept-Icons mit Tooltip", async () => {
  mockFetch(
    200,
    gelmarView(
      { recipes: { "2408": hose } },
      {
        professions: [
          { id: 197, name: "Schneiderei", nameEn: "Tailoring", skill: 37, max: 75, primary: true,
            recipes: ["Braune Leinenhose", "Bolt of Linen Cloth"], recipeIds: [2408, 2963] },
        ],
      },
    ),
  );
  renderAt("/charakter/gelmar-soulvenn?reiter=berufe");
  const grid = await screen.findByRole("list", { name: "Rezepte Schneiderei" });
  expect(document.body.textContent).toContain("37 / 75");
  expect(document.body.textContent).toContain("2 Rezepte");
  const icons = within(grid).getAllByRole("img");
  expect(icons.map((i) => i.getAttribute("alt") ?? i.getAttribute("aria-label"))).toEqual(["Bolt of Linen Cloth", "Braune Leinenhose"]);
  const frame = icons[1].closest<HTMLElement>(".icon")!;
  expect(frame.style.borderColor).toBe("rgb(30, 255, 0)");
  fireEvent.focus(frame.closest(".tooltip-trigger")!);
  expect(screen.getByRole("tooltip").textContent).toContain("2× Leinenstoffballen");
  expect(screen.queryByLabelText("Rezepte in Schneiderei filtern")).toBeNull();
});

test("Reiter Berufe: Filter ab 24 Rezepten", async () => {
  const names = Array.from({ length: 24 }, (_, i) => `Rezept ${String(i).padStart(2, "0")}`);
  names[5] = "Leinentasche";
  mockFetch(
    200,
    gelmarView({}, { professions: [{ id: 197, name: "Schneiderei", nameEn: "Tailoring", skill: 37, max: 75, primary: true, recipes: names }] }),
  );
  renderAt("/charakter/gelmar-soulvenn?reiter=berufe");
  const input = await screen.findByLabelText("Rezepte in Schneiderei filtern");
  fireEvent.change(input, { target: { value: "tasche" } });
  const grid = screen.getByRole("list", { name: "Rezepte Schneiderei" });
  expect(within(grid).getAllByRole("img").map((i) => i.getAttribute("aria-label"))).toEqual(["Leinentasche"]);
  fireEvent.change(input, { target: { value: "gibtsnicht" } });
  expect(screen.getByText("Kein Rezept gefunden.")).toBeTruthy();
});

test("Reiter Berufe ohne Berufe", async () => {
  mockFetch(200, gelmarView({}, { professions: [] }));
  renderAt("/charakter/gelmar-soulvenn?reiter=berufe");
  expect(await screen.findByText("Keine Berufe erlernt")).toBeTruthy();
});


test("Charakterkopf zeigt Gilde und Fraktionswappen des Mitglieds", async () => {
  mockFetch(200, gelmarView({ guildName: "Goldene Bärenklaue", guildFaction: "ALLIANCE" }));
  renderAt("/charakter/gelmar-soulvenn");
  await screen.findByText("Weiße Leinenrobe");
  const meta = document.querySelector(".character-meta")!;
  expect(meta.textContent).toContain("<Goldene Bärenklaue>");
  expect(within(meta as HTMLElement).getByRole("img", { name: "Allianz" })).toBeTruthy();
});

test("Reiter Dungeons & Raids über ?reiter=dungeons", async () => {
  mockFetch(
    200,
    gelmarView({
      instances: {
        available: true,
        dungeonTiers: [{ achievementId: 1, tier: "Novize", dungeons: [{ criterionId: 1, name: "Todesminen", description: "Todesminen", completed: true, onAccount: false, tracked: true, kills: [], image: null, levels: null, bosses: null, finalBosses: [], completedAt: null, timesCompleted: 0 }] }],
        raids: [],
        otherKills: [],
      },
    }),
  );
  renderAt("/charakter/gelmar-soulvenn?reiter=dungeons");
  expect(await screen.findByText("Todesminen")).toBeTruthy();
  expect(screen.getByRole("tab", { name: "Dungeons & Raids" }).getAttribute("aria-selected")).toBe("true");
});

test("Reiter Ruf über ?reiter=ruf", async () => {
  mockFetch(
    200,
    gelmarView({
      reputation: {
        available: true,
        groups: [{ name: "Horde", factions: [{ id: 76, name: "Orgrimmar", tier: 4, tierName: "Freundlich", value: 1485, max: 6000 }] }],
      },
    }),
  );
  renderAt("/charakter/gelmar-soulvenn?reiter=ruf");
  expect(await screen.findByText("Orgrimmar")).toBeTruthy();
  expect(screen.getByRole("tab", { name: "Ruf" }).getAttribute("aria-selected")).toBe("true");
});

test("Link mit #beruf öffnet Berufe, scrollt hin und hebt hervor", async () => {
  const scroll = vi.fn();
  Element.prototype.scrollIntoView = scroll;
  mockFetch(
    200,
    gelmarView(
      {},
      {
        professions: [
          { id: 186, name: "Bergbau", nameEn: "Mining", skill: 10, max: 75, primary: true, recipes: ["Zinn verhütten"] },
          { id: 197, name: "Schneiderei", nameEn: "Tailoring", skill: 37, max: 75, primary: true, recipes: ["Leinenstoffballen"] },
        ],
      },
    ),
  );
  renderAt("/charakter/gelmar-soulvenn?reiter=berufe#schneiderei");
  const schneiderei = (await screen.findByText("Schneiderei")).closest<HTMLElement>(".character-profession")!;
  expect(screen.getByRole("tab", { name: "Berufe" }).getAttribute("aria-selected")).toBe("true");
  expect(schneiderei.className).toContain("character-profession-highlight");
  const bergbau = screen.getByText("Bergbau").closest<HTMLElement>(".character-profession")!;
  expect(bergbau.className).not.toContain("character-profession-highlight");
  expect(scroll).toHaveBeenCalledTimes(1);
  expect(scroll.mock.contexts[0]).toBe(schneiderei);
});

test("Titel der Woche erscheinen als Abzeichen im Kopf und Wrapped als Reiter", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(
        JSON.stringify(gelmarView({ titles: [{ titleId: "pechvogel", name: { de: "Pechvogel", en: "Pechvogel", schwaebisch: "Pechvogel", bayrisch: "Pechvogel" }, week: "2026-11-21", from: "2026-11-15", to: "2026-11-21", valueText: { de: "7 Tode", en: "7 Tode", schwaebisch: "7 Mol higfloga", bayrisch: "7 Moi higfoin" } }] })),
        { status: 200 },
      ),
    ),
  );
  render(
    <MemoryRouter initialEntries={["/charakter/gelmar-soulvenn"]}>
      <Routes>
        <Route path="/charakter/:key" element={<CharacterPage />} />
      </Routes>
    </MemoryRouter>,
  );
  const badge = await screen.findByRole("link", { name: "Pechvogel" });
  expect(badge.getAttribute("href")).toBe("/titel");
  const medaille = badge.querySelector("img")!;
  expect(medaille.getAttribute("src")).toBe("/titel/pechvogel.png");
  expect(medaille.getAttribute("alt")).toBe("Pechvogel");
  expect(medaille.getAttribute("title")).toBe("Pechvogel, Titel der Woche vom 15.11. bis 21.11.: 7 Tode");
  expect([medaille.getAttribute("width"), medaille.getAttribute("height"), medaille.getAttribute("loading")]).toEqual(["40", "40", "lazy"]);
  expect(screen.getByRole("tab", { name: "Rückblick" })).toBeTruthy();
  expect(screen.queryByRole("tab", { name: "Wrapped" })).toBeNull();
});

test("Titel ohne Abzeichen-Datei erscheint wie bisher als goldenes Textabzeichen", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(
        JSON.stringify(gelmarView({ titles: [{ titleId: "neuer-titel", name: { de: "Neuer Titel", en: "Neuer Titel", schwaebisch: "Neuer Titel", bayrisch: "Neier Titel" }, week: "2026-W46", from: "2026-11-09", to: "2026-11-15", valueText: { de: "3 Dinge", en: "3 Dinge", schwaebisch: "3 Sacha", bayrisch: "3 Sachan" } }] })),
        { status: 200 },
      ),
    ),
  );
  render(
    <MemoryRouter initialEntries={["/charakter/gelmar-soulvenn"]}>
      <Routes>
        <Route path="/charakter/:key" element={<CharacterPage />} />
      </Routes>
    </MemoryRouter>,
  );
  const badge = await screen.findByRole("link", { name: "Neuer Titel" });
  expect(badge.className).toContain("badge-gold");
  expect(badge.querySelector("img")).toBeNull();
});

function renderIn(sprache: Sprache, url: string) {
  render(
    <SpracheProvider start={sprache}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/charakter/:key" element={<CharacterPage />} />
        </Routes>
      </MemoryRouter>
    </SpracheProvider>,
  );
}

const pechvogel = {
  titleId: "pechvogel",
  name: { de: "Pechvogel", en: "Pechvogel", schwaebisch: "Pechvogel", bayrisch: "Pechvogel" },
  week: "2026-11-21",
  from: "2026-11-15",
  to: "2026-11-21",
  valueText: { de: "7 Tode", en: "7 Tode", schwaebisch: "7 Mol higfloga", bayrisch: "7 Moi higfoin" },
};

test("Charakterseite auf Bayrisch: Kopf, Titel-Tooltip und Hinweise im Dialekt", async () => {
  mockFetch(200, gelmarView({ former: true, titles: [pechvogel] }));
  renderIn("bayrisch", "/charakter/gelmar-soulvenn");
  expect(await screen.findByText("Ehemaligs Mitglied")).toBeTruthy();
  expect(document.body.textContent).toContain("Zletzt online: 06.11.2026, 07:14 Uhr");
  const medaille = screen.getByRole("link", { name: "Pechvogel" }).querySelector("img")!;
  expect(medaille.getAttribute("title")).toBe("Pechvogel, Titel vo da Woch vom 15.11. bis 21.11.: 7 Moi higfoin");
  // Amtliche Namen bleiben, auch der Ausrüstungsplatz.
  expect(screen.getByText("Kopf")).toBeTruthy();
  expect(document.body.textContent).toContain("10 Untoter Priester");
});

test("Charakterseite auf Schwäbisch: Reiter und leere Zustände", async () => {
  mockFetch(200, gelmarView({}, { professions: [] }));
  renderIn("schwaebisch", "/charakter/gelmar-soulvenn?reiter=berufe");
  expect(await screen.findByText("Koine Berufe glernt")).toBeTruthy();
  expect(screen.getByRole("tab", { name: "Ausrüschtung" })).toBeTruthy();
});

test("Unbekannter Charakter auf Schwäbisch", async () => {
  mockFetch(404, { error: "nicht gefunden" });
  renderIn("schwaebisch", "/charakter/niemand");
  expect(await screen.findByText("Charakter net gfonda")).toBeTruthy();
  expect(screen.getByText("Den Charakter kennet mr net.")).toBeTruthy();
});

const werte: CharacterView["attributes"] = {
  available: true,
  fetchedAt: "2026-11-26T03:00:00.000Z",
  resource: { id: 1, kind: "rage", name: "Wut" },
  groups: [
    {
      id: "basis",
      rows: [
        { key: "health", kind: "number", value: 4210 },
        { key: "power", kind: "number", value: 100 },
        { key: "strength", kind: "number", value: 152, base: 120 },
      ],
    },
    { id: "angriff", rows: [{ key: "melee_crit", kind: "percent", value: 5.25 }] },
    { id: "verteidigung", rows: [{ key: "armor", kind: "number", value: 1830 }] },
  ],
};

test("Reiter Werte zeigt Grundwerte als Kacheln, Ressource nach Art und Gruppen", async () => {
  mockFetch(200, gelmarView({ attributes: werte }));
  renderAt("/charakter/gelmar-soulvenn?reiter=werte");
  expect(await screen.findByText("Gesundheit")).toBeTruthy();
  expect(screen.getByRole("tab", { name: "Werte" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByText("4.210")).toBeTruthy();
  expect(screen.getByText("Wut")).toBeTruthy();
  const staerke = screen.getByText("Stärke").closest("li")!;
  expect(within(staerke).getByText("152")).toBeTruthy();
  // Zuwachs sichtbar in der Fußzeile.
  expect(within(staerke).getByText("+32 durch Ausrüstung und Buffs").className).toBe("attribute-foot");
  expect(staerke.getAttribute("title")).toBe("Grundwert 120, +32 durch Ausrüstung und Buffs");
  // Ohne Zuwachs keine Erklärung.
  const gesundheit = screen.getByText("Gesundheit").closest("li")!;
  expect(within(gesundheit).queryByText(/Ausrüstung/)).toBeNull();
  // Die Fußzeile bleibt auch leer stehen, damit alle Kacheln gleich hoch sind.
  expect(gesundheit.querySelector(".attribute-foot")).not.toBeNull();
  expect(screen.getByRole("heading", { name: "Angriff" })).toBeTruthy();
  expect(screen.getByText("5,25 %")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Verteidigung" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Zauber" })).toBeNull();
});

test("Reiter Werte auf Englisch", async () => {
  mockFetch(200, gelmarView({ attributes: { ...werte, resource: { id: 6, kind: "runic_power", name: "Runenmacht" } } }));
  render(
    <SpracheProvider start="en">
      <MemoryRouter initialEntries={["/charakter/gelmar-soulvenn?reiter=werte"]}>
        <Routes>
          <Route path="/charakter/:key" element={<CharacterPage />} />
        </Routes>
      </MemoryRouter>
    </SpracheProvider>,
  );
  expect(await screen.findByText("Health")).toBeTruthy();
  expect(screen.getByRole("tab", { name: "Stats" })).toBeTruthy();
  expect(screen.getByText("Runic Power")).toBeTruthy();
  expect(screen.getByText("Melee Crit")).toBeTruthy();
  expect(screen.getByText("+32 from gear and buffs")).toBeTruthy();
});

test("Reiter Werte ohne Daten: Hinweis statt leerer Seite", async () => {
  mockFetch(200, gelmarView());
  renderAt("/charakter/gelmar-soulvenn?reiter=werte");
  expect(await screen.findByText("Die Werte werden gerade zusammengetragen. Schau bald wieder vorbei.")).toBeTruthy();
  cleanup();
  mockFetch(200, gelmarView({ attributes: { available: false, fetchedAt: "2026-11-26T03:00:00.000Z", resource: null, groups: [] } }));
  renderAt("/charakter/gelmar-soulvenn?reiter=werte");
  expect(await screen.findByText("Blizzard liefert für diesen Charakter keine Werte.")).toBeTruthy();
});
