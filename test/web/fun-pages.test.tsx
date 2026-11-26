// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, expect, test, vi } from "vitest";
import type { ActivityView, ZeitungView, CharacterRef, TitlesView, WrappedView } from "../../src/api/types";
import { TitleBadge } from "../../web/src/components/TitleBadge";
import { WrappedPanel } from "../../web/src/components/WrappedCard";
import { ueberall, type Fassungen } from "../../src/sprache";
import { dayTotals, heatLevel, monthLabel, peak, splitByNames, weekLabel, weekRangeLabel } from "../../web/src/lib/fun";
import { SpracheProvider, type Sprache } from "../../web/src/lib/sprache";
import { StatsPage } from "../../web/src/pages/StatsPage";
import { ZeitungArchivePage, ZeitungPage } from "../../web/src/pages/ZeitungPage";
import { TitlesPage } from "../../web/src/pages/TitlesPage";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ref = (over: Partial<CharacterRef>): CharacterRef => ({
  id: 1, name: "Anna", surname: null, slug: "anna", classId: 1, former: false, guildSlug: "bärenklaue", ...over,
});

function mockFetch(routes: Record<string, unknown>) {
  const fn = vi.fn(async (path: string) => {
    const body = routes[path];
    return body === undefined
      ? new Response(JSON.stringify({ error: "Nicht gefunden" }), { status: 404 })
      : new Response(JSON.stringify(body), { status: 200 });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

function renderAt(path: string, routes: React.ReactNode, sprache?: Sprache) {
  const seite = <MemoryRouter initialEntries={[path]}><Routes>{routes}</Routes></MemoryRouter>;
  render(sprache ? <SpracheProvider start={sprache}>{seite}</SpracheProvider> : seite);
}

const f = (de: string, schwaebisch = de, bayrisch = de, en = de): Fassungen => ({ de, en, schwaebisch, bayrisch });

test("Hilfen: Farbstufen, Spitzenwert, Tagessummen, Namen im Text, Beschriftungen", () => {
  expect([0, 1, 5, 10].map((v) => heatLevel(v, 10))).toEqual([0, 1, 3, 5]);
  expect(heatLevel(3, 0)).toBe(0);
  expect(peak([0, 3, 3])).toEqual({ index: 1, value: 3 });
  expect(peak([0, 0])).toBeNull();
  const cells = new Array(168).fill(0);
  cells[24 + 5] = 2;
  expect(dayTotals(cells)).toEqual([0, 2, 0, 0, 0, 0, 0]);
  const a = { name: "Anna" };
  const an = { name: "Annabell" };
  expect(splitByNames("Annabell und Anna (wer sonst?)", [a, an])).toEqual([an, " und ", a, " (wer sonst?)"]);
  expect(weekLabel("2026-11-15", "2026-11-21")).toBe("Woche vom 15.11. bis 21.11.");
  expect(weekRangeLabel("2026-12-27", "2027-01-02")).toBe("Woche vom 27.12. bis 02.01.2027");
  expect(monthLabel("2026-11")).toBe("November 2026");
});

const cells = new Array(168).fill(0);
cells[20] = 4;
cells[24 * 4 + 21] = 7;
const activity: ActivityView = {
  guilds: [
    { slug: "bärenklaue", name: "Bärenklaue", faction: "HORDE", memberCount: 2, main: true },
    { slug: "goldene-bärenklaue", name: "Goldene Bärenklaue", faction: "ALLIANCE", memberCount: 1, main: false },
  ],
  weeks: ["2026-W46", "2026-W47"],
  weeksWithData: 2,
  from: "2026-11-09",
  to: "2026-11-22",
  all: { cells, characters: 5 },
  byGuild: { "bärenklaue": { cells, characters: 4 }, "goldene-bärenklaue": { cells: new Array(168).fill(0), characters: 0 } },
  logins: [[1, 7], [2, 4]],
  testdaten: true,
};

test("Aktivität: Raster, stärkste Stunde, Testdaten-Hinweis, Gildenfilter mit Leerzustand", async () => {
  mockFetch({ "/api/activity": activity });
  renderAt("/statistik/aktivitaet", <Route path="/statistik/:reiter" element={<StatsPage />} />);
  expect(await screen.findByText("Freitag, 21 bis 22 Uhr")).toBeTruthy();
  expect(screen.getByLabelText("Freitag, 21 bis 22 Uhr: 7 Anmeldungen").className).toContain("heat-5");
  expect(screen.getByLabelText("Montag, 20 bis 21 Uhr: 4 Anmeldungen").className).toContain("heat-3");
  expect(screen.getAllByRole("cell")).toHaveLength(168);
  expect(screen.getByRole("note").textContent).toContain("Beispieldaten");
  fireEvent.click(screen.getByRole("radio", { name: "Goldene Bärenklaue" }));
  expect(screen.getByText(/Noch keine Anmeldungen aufgezeichnet/)).toBeTruthy();
});

test("Aktivität: Charaktere öffnet die Liste mit Anmeldungen je Charakter", async () => {
  const mitglied = (id: number, name: string, guildSlug: string) => ({
    id, name, surname: null, slug: name.toLowerCase(), level: 30, classId: 1, className: "Krieger", raceId: 2, raceName: "Orc",
    rank: 1, rankName: "Mitglied", itemLevel: null, mainSpecName: null, hasProfile: true, former: false, guildSlug, guildName: guildSlug, professions: [],
  });
  mockFetch({
    "/api/activity": activity,
    "/api/guild": {
      fetchedAt: "2026-11-21T09:00:00Z", name: "Bärenklaue", faction: "HORDE", rulesetName: "Classic", memberCount: 2, guilds: activity.guilds,
      classes: [], ranks: [], members: [mitglied(1, "Anna", "bärenklaue"), mitglied(2, "Bodo", "goldene-bärenklaue")],
    },
  });
  renderAt("/statistik/aktivitaet", <Route path="/statistik/:reiter" element={<StatsPage />} />, "schwaebisch");
  await screen.findByText("Stärkschte Stond");
  fireEvent.click(screen.getByRole("button", { name: /Charaktere/ }));
  const dialog = await screen.findByRole("dialog", { name: "Charaktere" });
  await within(dialog).findByRole("table");
  expect(within(dialog).getByRole("columnheader", { name: /Anmeldunge/ })).toBeTruthy();
  const rows = within(dialog).getAllByRole("row").slice(1);
  expect(rows.map((r) => [r.querySelector("a")?.textContent, r.lastElementChild?.textContent])).toEqual([["Anna", "7"], ["Bodo", "4"]]);
  expect(within(dialog).getByRole("button", { name: "Zumache" })).toBeTruthy();
});

const titles: TitlesView = {
  guilds: [{ slug: "bärenklaue", name: "Bärenklaue", faction: "HORDE", memberCount: 2, main: true }],
  titles: [
    { id: "pechvogel", name: f("Pechvogel", "Pechvogel", "Pechvogerl"), description: f("Die meisten Tode der Woche.", "D'meischte Tode vo dr Woch.", "De meistn Tode vo da Woch.") },
    { id: "nachteule", name: f("Nachteule", "Nachteul", "Nachteiln"), description: f("Nachts.") },
  ],
  current: {
    week: "2026-W46", from: "2026-11-09", to: "2026-11-15",
    awards: [{ titleId: "pechvogel", name: f("Pechvogel", "Pechvogel", "Pechvogerl"), description: f(""), value: 7, valueText: f("7 Tode"), character: ref({}), sharedWith: 0 }],
    ranked: true,
  },
  history: [{ week: "2026-W45", from: "2026-11-02", to: "2026-11-08", awards: [], ranked: false }],
  testdaten: false,
};

test("Titel: Kacheln mit Gewinnern, leere Titel, Ehrentafel", async () => {
  mockFetch({ "/api/titles": titles });
  renderAt("/titel", <Route path="/titel" element={<TitlesPage />} />);
  const winner = await screen.findByRole("link", { name: "Anna" });
  expect(winner.getAttribute("href")).toBe("/charakter/anna");
  expect(screen.getByText("7 Tode")).toBeTruthy();
  expect(screen.getByRole("img", { name: "Horde" }).getAttribute("src")).toContain("pvpcurrency-honor-horde");
  // Abzeichen groß in den Kacheln, nicht vergebene Titel abgedunkelt; Ehrentafel mit kleinen Abzeichen im Kopf
  const kacheln = [...document.querySelectorAll(".title-tile")];
  expect(kacheln.map((k) => k.querySelector("img.title-medal")?.getAttribute("src"))).toEqual(["/titel/pechvogel.png", "/titel/nachteule.png"]);
  expect(kacheln[1].querySelector("img.title-medal")?.className).toContain("title-medal-muted");
  expect(kacheln[0].querySelector("img.title-medal")?.getAttribute("width")).toBe("92");
  // Ehrentafel gedreht: eine Zeile je Titel mit kleinem Abzeichen, nicht vergeben als Strich
  expect(document.querySelectorAll(".honor-title img.title-medal")).toHaveLength(2);
  expect(document.querySelectorAll(".honor-none").length).toBeGreaterThan(0);
  expect(screen.queryByText("k. A.")).toBeNull();
  // Regel erst auf Knopfdruck sichtbar
  const regel = screen.getByRole("button", { name: "Regel für Pechvogel" });
  expect(regel.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(regel);
  expect(regel.getAttribute("aria-expanded")).toBe("true");
  expect(document.getElementById("regel-pechvogel")?.className).toContain("title-tile-rule-open");
  expect(screen.getByText("Diese Woche niemand")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Woche vom 02.11. bis 08.11.2026" }).getAttribute("href")).toBe("/zeitung/2026-W45");
  expect(screen.queryByRole("note")).toBeNull();
  // Gut sichtbar: wann es Neues gibt, und keine Kalenderwochen mehr
  expect(document.querySelector(".page-header .erscheint-hint")?.textContent).toContain("jeden Sonntag ab 10 Uhr");
  expect(screen.getByText(/gewertet wird Sonntag bis Samstag\. Bei Gleichstand/)).toBeTruthy();
  expect(document.body.textContent).not.toMatch(/KW \d/);
});

test("Titel: Klick auf Kachel oder Ehrentafel zeigt die Rangliste der Woche, alle Inhaber hervorgehoben", async () => {
  const mitglied = (id: number, name: string) => ({
    id, name, surname: null, slug: name.toLowerCase(), level: 30, classId: 1, className: "Krieger", raceId: 2, raceName: "Orc",
    rank: 1, rankName: "Mitglied", itemLevel: null, mainSpecName: null, hasProfile: true, former: false, guildSlug: "bärenklaue", guildName: "Bärenklaue", professions: [],
  });
  const bodo = ref({ id: 2, name: "Bodo", slug: "bodo" });
  const view: TitlesView = {
    ...titles,
    history: [{
      week: "2026-W45", from: "2026-11-02", to: "2026-11-08", ranked: false,
      awards: [{ titleId: "pechvogel", name: f("Pechvogel"), description: f(""), value: 4, valueText: f("4 Tode"), character: bodo, sharedWith: 0 }],
    }],
  };
  const fetch = mockFetch({
    "/api/titles": view,
    "/api/titles?titel=pechvogel&woche=2026-W46": {
      titleId: "pechvogel", week: "2026-W46", from: "2026-11-09", to: "2026-11-15", winnerIds: [1, 2], complete: true,
      // Gleichstand: Anna und Bodo teilen sich den Titel, Anna steht auf der Karte
      entries: [[1, 7], [2, 7], [3, 1]], valueTexts: { "7": f("7 Tode"), "1": f("1 Tod") },
    },
    "/api/titles?titel=pechvogel&woche=2026-W45": {
      titleId: "pechvogel", week: "2026-W45", from: "2026-11-02", to: "2026-11-08", winnerIds: [2], complete: false,
      entries: [[2, 4]], valueTexts: { "4": f("4 Tode") },
    },
    "/api/guild": {
      fetchedAt: "2026-11-21T09:00:00Z", name: "Bärenklaue", faction: "HORDE", rulesetName: "Classic", memberCount: 3, guilds: view.guilds,
      classes: [], ranks: [], members: [mitglied(1, "Anna"), mitglied(2, "Bodo"), mitglied(3, "Cleo")],
    },
  });
  renderAt("/titel", <Route path="/titel" element={<TitlesPage />} />);
  await screen.findByText("7 Tode");
  // Nicht vergebene Titel ohne gespeicherte Rangliste haben keinen Auslöser, die aktuelle Woche schon
  const kacheln = [...document.querySelectorAll(".title-tile")];
  expect(kacheln.map((k) => k.className.includes("title-tile-clickable"))).toEqual([true, true]);
  // Klick auf die Kachel selbst (nicht auf den Link) öffnet die Liste
  fireEvent.click(kacheln[0].querySelector(".title-tile-name")!);
  let dialog = await screen.findByRole("dialog", { name: "Pechvogel" });
  await within(dialog).findByRole("table");
  expect(fetch).toHaveBeenCalledWith("/api/titles?titel=pechvogel&woche=2026-W46", expect.anything());
  expect(within(dialog).getByText("Woche vom 09.11. bis 15.11.2026")).toBeTruthy();
  const rows = within(dialog).getAllByRole("row").slice(1);
  expect(rows.map((r) => [r.querySelector("a")?.textContent, r.lastElementChild?.textContent])).toEqual([
    ["Anna", "7 Tode"], ["Bodo", "7 Tode"], ["Cleo", "1 Tod"],
  ]);
  expect(rows.map((r) => r.className)).toEqual(["member-row-highlight", "member-row-highlight", ""]);
  expect(within(rows[0]).getByText("Gewinner")).toBeTruthy();
  expect(within(rows[1]).getByText("Gewinner")).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "Schließen" }));
  expect(screen.queryByRole("dialog")).toBeNull();

  // Ehrentafel: alte Woche ohne Rangliste zeigt den Gewinner mit Hinweis
  fireEvent.click(screen.getByRole("button", { name: "Rangliste Pechvogel, Woche vom 02.11. bis 08.11.2026" }));
  dialog = await screen.findByRole("dialog", { name: "Pechvogel" });
  await within(dialog).findByRole("table");
  expect(within(dialog).getByText(/nur der Gewinner gespeichert/)).toBeTruthy();
  const alt = within(dialog).getAllByRole("row").slice(1);
  expect(alt.map((r) => [r.querySelector("a")?.textContent, r.lastElementChild?.textContent])).toEqual([["Bodo", "4 Tode"]]);
  // Nachteule in der alten Woche: nicht vergeben, keine Rangliste, kein Knopf
  expect(screen.queryByRole("button", { name: /Rangliste Nachteule, Woche vom 02\.11\./ })).toBeNull();
});

test("Titel geteilt: Karte zeigt den Titelträger und wie viele ihn noch haben, der Zusatz öffnet die Rangliste", async () => {
  const view: TitlesView = {
    ...titles,
    current: { ...titles.current!, awards: [{ ...titles.current!.awards[0], sharedWith: 12 }] },
  };
  const fetch = mockFetch({
    "/api/titles": view,
    "/api/titles?titel=pechvogel&woche=2026-W46": {
      titleId: "pechvogel", week: "2026-W46", from: "2026-11-09", to: "2026-11-15", winnerIds: [1], complete: true,
      entries: [[1, 7]], valueTexts: { "7": f("7 Tode") },
    },
    "/api/guild": { fetchedAt: "2026-11-21T09:00:00Z", name: "Bärenklaue", faction: "HORDE", rulesetName: "Classic", memberCount: 0, guilds: view.guilds, classes: [], ranks: [], members: [] },
  });
  renderAt("/titel", <Route path="/titel" element={<TitlesPage />} />);
  // Nur ein Name auf der Karte, keine Namensliste
  expect(await screen.findByRole("link", { name: "Anna" })).toBeTruthy();
  const zusatz = screen.getByRole("button", { name: "teilt sich den Titel mit 12 weiteren" });
  // Regel-Einblendung erklärt den Gleichstand, nur bei geteilten Titeln
  expect(document.getElementById("regel-pechvogel")?.textContent).toMatch(/am längsten nicht hatte/);
  expect(document.getElementById("regel-nachteule")?.textContent).not.toMatch(/Gleichstand/);
  expect(screen.getByText(/Bei Gleichstand teilen sich alle den Titel/)).toBeTruthy();
  expect(document.body.textContent).not.toMatch(/alphabetisch/);
  fireEvent.click(zusatz);
  await screen.findByRole("dialog", { name: "Pechvogel" });
  expect(fetch).toHaveBeenCalledWith("/api/titles?titel=pechvogel&woche=2026-W46", expect.anything());
});

test("Titel geteilt: Einzahl und Mundart", async () => {
  const view: TitlesView = {
    ...titles,
    current: { ...titles.current!, awards: [{ ...titles.current!.awards[0], sharedWith: 1 }] },
  };
  mockFetch({ "/api/titles": view });
  renderAt("/titel", <Route path="/titel" element={<TitlesPage />} />, "schwaebisch");
  expect(await screen.findByRole("button", { name: "teilt sich dr Titel mit oim andre" })).toBeTruthy();
});

test("Titel vor der ersten Auswertung: Leerzustand", async () => {
  mockFetch({ "/api/titles": { ...titles, current: null, history: [] } });
  renderAt("/titel", <Route path="/titel" element={<TitlesPage />} />);
  expect(await screen.findByText(/noch nicht ausgewertet/)).toBeTruthy();
  expect(screen.getByText(/Neue Titel gibt es jeden Sonntag ab 10 Uhr/)).toBeTruthy();
});

const issue: ZeitungView = {
  issue: 3, week: "2026-W46", from: "2026-11-09", to: "2026-11-15",
  lead: {
    kind: "sprung", section: f("Aufsteiger", "Aufschteiger", "Aufsteiger"), title: { id: "dauerlaeufer", name: f("Dauerläufer", "Dauerläufer", "Dauerlaufer") },
    headline: f("Anna gibt Gas", "Anna gibt Gas wie verruckt", "Anna gibt Gas, Obacht"), text: f("Anna rennt.", "Anna springt wie a Wiesele.", "Anna rennt wia da Blitz."), characters: [ref({})],
  },
  articles: [
    {
      kind: "titel", section: f("Friedhof", "Friedhof", "Friedhof"), title: { id: "pechvogel", name: f("Pechvogel", "Pechvogel", "Pechvogerl") },
      headline: f("Pechvogel: Bodo"), text: f("Bodo stirbt.", "Bodo isch scho wieder hee.", "Bodo is scho wieda hi."), characters: [ref({ id: 2, name: "Bodo", slug: "bodo" })],
    },
    { kind: "zahl", section: f("Zahl der Woche"), title: null, headline: f("42"), text: f("Level gesammelt.", "Level gsammelt.", "Level gsammlt."), characters: [] },
  ],
  motto: f("Nur nicht hetzen.", "No ned hudla.", "Nur ned hudln."),
  generator: "bausteine",
  avatars: { "1": "https://render.example/1-avatar.jpg", "2": null },
  previous: "2026-W45",
  next: null,
  testdaten: false,
};

test("Zeitung: Kopf, verlinkte Namen, Spruch und Blättern", async () => {
  mockFetch({ "/api/zeitung": issue });
  renderAt("/zeitung", <Route path="/zeitung" element={<ZeitungPage />} />);
  expect(await screen.findByRole("heading", { name: "Gildenblatt", level: 1 })).toBeTruthy();
  // Ohne Gildennamen in der Ausgabe bleibt die Unterzeile neutral
  expect(screen.getByText("Die Wochenzeitung der Gilde")).toBeTruthy();
  expect(screen.getByText("Preis: ein Heiltrank")).toBeTruthy();
  expect(screen.getByText("Ausgabe 3")).toBeTruthy();
  expect(screen.getByText("Woche vom 09.11. bis 15.11.2026")).toBeTruthy();
  expect(screen.getByText("Erscheint jeden Sonntag ab 10 Uhr")).toBeTruthy();
  const lead = screen.getByRole("heading", { name: "Anna gibt Gas", level: 2 });
  expect(within(lead).getByRole("link", { name: "Anna" }).getAttribute("href")).toBe("/charakter/anna");
  expect(screen.getAllByRole("link", { name: "Bodo" })).toHaveLength(2);
  expect(screen.getByText("Nur nicht hetzen.")).toBeTruthy();
  expect(screen.getByRole("img", { name: "Pechvogel" }).getAttribute("src")).toBe("/titel/pechvogel.png");
  expect(screen.getByRole("img", { name: "Dauerläufer" }).closest(".zeitung-lead-figur")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Friedhof", level: 2 })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Zahl der Woche", level: 2 })).toBeTruthy();
  expect(screen.getByText("42").className).toContain("zeitung-zahl-wert");
  expect(document.querySelector(".zeitung-lead-bild")?.getAttribute("src")).toBe("https://render.example/1-avatar.jpg");
  expect(document.querySelector('[data-farbe="horde"]')?.getAttribute("aria-label")).toBe("Friedhof");
  expect(screen.getByRole("link", { name: /Vorherige Ausgabe/ }).getAttribute("href")).toBe("/zeitung/2026-W45");
  expect(screen.queryByRole("link", { name: /Nächste Ausgabe/ })).toBeNull();
  expect(screen.getByText(/Nächste Ausgabe/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Alle Ausgaben im Archiv" }).getAttribute("href")).toBe("/zeitung/archiv");
  expect(screen.queryByText(/Ältere Ausgabe/)).toBeNull();
});

test("Zeitung: Woche in Zahlen mit Gildenauswahl, Wetterbericht und Rückblick", async () => {
  const z = (art: "anmeldungen" | "level" | "tode", wert: number, vorwoche: number | null) => ({ art, wert, vorwoche });
  mockFetch({
    "/api/zeitung": {
      ...issue,
      zahlen: {
        guilds: [
          { slug: "baerenklaue", name: "Bärenklaue", faction: "HORDE", memberCount: 3, main: true },
          { slug: "goldene-baerenklaue", name: "Goldene Bärenklaue", faction: "ALLIANCE", memberCount: 2, main: false },
        ],
        gesamt: [z("anmeldungen", 120, 100), z("level", 30, 30), z("tode", 9, null)],
        gilden: { baerenklaue: [z("tode", 2, 5)], "goldene-baerenklaue": [z("tode", 7, 1)] },
      },
      wetter: f("Sturm über Azeroth.", "Sturm über Azeroth, gell.", "Sturm über Azeroth, fei."),
      rueckblick: { week: "2026-W42", issue: 1, from: "2026-10-12", to: "2026-10-18", headline: f("Anna rast los"), characters: [ref({})] },
    },
  });
  renderAt("/zeitung", <Route path="/zeitung" element={<ZeitungPage />} />);
  const kasten = await screen.findByRole("region", { name: "Woche in Zahlen" });
  // Gildennamen in der Unterzeile kommen aus den Daten der Ausgabe
  expect(screen.getByText("Wochenzeitung von Bärenklaue und Goldene Bärenklaue")).toBeTruthy();
  const zeilen = () => [...kasten.querySelectorAll(".zeitung-zahlen-zeile")].map((d) => d.textContent);
  expect(zeilen()).toEqual(["Anmeldungen120▲ +20 zur Vorwoche", "Level30=wie in der Vorwoche", "Tode9"]);
  fireEvent.click(within(kasten).getByRole("radio", { name: /Goldene Bärenklaue/ }));
  expect(zeilen()).toEqual(["Tode7▲ +6 zur Vorwoche"]);
  fireEvent.click(within(kasten).getByRole("radio", { name: /^Bärenklaue/ }));
  expect(zeilen()).toEqual(["Tode2▼ −3 zur Vorwoche"]);
  expect(screen.getByRole("region", { name: "Wetterbericht" }).textContent).toContain("Sturm über Azeroth.");
  const rueck = screen.getByRole("region", { name: "Vor 4 Wochen" });
  expect(within(rueck).getByRole("link").getAttribute("href")).toBe("/zeitung/2026-W42");
  expect(rueck.textContent).toContain("Anna rast los");
});

test("Zeitung: alte Ausgabe ohne Zahlen, Wetter und Rückblick", async () => {
  mockFetch({ "/api/zeitung": issue });
  renderAt("/zeitung", <Route path="/zeitung" element={<ZeitungPage />} />);
  await screen.findByRole("heading", { name: "Gildenblatt", level: 1 });
  expect(screen.queryByRole("region", { name: "Woche in Zahlen" })).toBeNull();
  expect(screen.queryByRole("region", { name: "Wetterbericht" })).toBeNull();
  expect(screen.queryByRole("region", { name: "Vor 4 Wochen" })).toBeNull();
});

test("Zeitung: unbekannte Ausgabe und noch keine Ausgabe", async () => {
  mockFetch({});
  renderAt("/zeitung/2026-W01", <Route path="/zeitung/:woche" element={<ZeitungPage />} />);
  expect(await screen.findByText("Diese Ausgabe gibt es nicht.")).toBeTruthy();
  cleanup();
  renderAt("/zeitung", <Route path="/zeitung" element={<ZeitungPage />} />);
  const leer = await screen.findByText(/Neue Ausgaben erscheinen/);
  expect(leer.textContent).toContain("jeden Sonntag ab 10 Uhr");
  expect(leer.className).toBe("erscheint-hint");
});

const wrapped: WrappedView = {
  character: { ...ref({}), level: 25, className: "Krieger" },
  month: "2026-11", months: ["2026-11", "2026-10"], running: true,
  from: "2026-10-31", to: "2026-11-17", since: null, serverStart: null,
  levels: { gained: 5, start: 20, end: 25 }, rank: { place: 2, of: 9 },
  itemLevel: 4, professionPoints: 35, dungeons: 3, recipes: null, deaths: 0,
  logins: 4, activeDays: 3, favoriteHour: 21, favoriteWeekday: 1,
  titles: [{ titleId: "pechvogel", name: f("Pechvogel", "Pechvogel", "Pechvogerl"), week: "2026-11-14", from: "2026-11-08", to: "2026-11-14", valueText: f("7 Tode") }],
  testdaten: false,
};

test("Wrapped: Karte mit Kennzahlen, fehlende Werte als Hinweis, Monatswahl lädt neu", async () => {
  const fetch = mockFetch({
    "/api/wrapped/anna": wrapped,
    "/api/wrapped/anna/2026-10": { ...wrapped, month: "2026-10", running: false, levels: null, rank: null, titles: [] },
  });
  render(<MemoryRouter><WrappedPanel slug="anna" /></MemoryRouter>);
  expect(await screen.findByText("+5")).toBeTruthy();
  expect(screen.getByText(/Platz 2 von 9/)).toBeTruthy();
  expect(screen.getByText(/Zwischenstand/)).toBeTruthy();
  expect(screen.getByText("Dienstags, 21 bis 22 Uhr")).toBeTruthy();
  expect(screen.getByText("noch keine Daten")).toBeTruthy();
  expect(screen.getByText("unsterblich!")).toBeTruthy();
  expect(screen.getByText("Pechvogel")).toBeTruthy();
  expect(screen.getByText("Woche vom 08.11. bis 14.11., 7 Tode")).toBeTruthy();
  expect(document.querySelector(".wrapped-title-list img")?.getAttribute("src")).toBe("/titel/pechvogel.png");
  fireEvent.change(screen.getByLabelText("Monat"), { target: { value: "2026-10" } });
  expect(await screen.findByText(/noch keinen Verlauf/)).toBeTruthy();
  expect(screen.getByText(/Diesmal kein Titel/)).toBeTruthy();
  expect(fetch.mock.calls.map((c) => c[0])).toEqual(["/api/wrapped/anna", "/api/wrapped/anna/2026-10"]);
});

test("Wrapped: Hinweis, wenn erst seit dem Beitritt gezählt wird", async () => {
  mockFetch({ "/api/wrapped/anna": wrapped });
  render(<MemoryRouter><WrappedPanel slug="anna" /></MemoryRouter>);
  await screen.findByText("+5");
  expect(screen.queryByText(/gezählt seit/)).toBeNull();
  cleanup();
  mockFetch({ "/api/wrapped/emil": { ...wrapped, from: "2026-11-12", since: "2026-11-12", levels: { gained: 4, start: 40, end: 44 } } });
  render(<MemoryRouter><WrappedPanel slug="emil" /></MemoryRouter>);
  expect(await screen.findByText(/gezählt seit dem Beitritt am 12\.11\./)).toBeTruthy();
  expect(screen.getByText(/Verglichen: 12\.11\.2026 und 17\.11\.2026/)).toBeTruthy();
});

test("Wrapped: im Monat des Serverstarts steht der Hinweis darauf, die Gegenstandsstufe als aktueller Stand", async () => {
  mockFetch({
    "/api/wrapped/anna": {
      ...wrapped, from: "2026-11-05", serverStart: "2026-11-05", levels: { gained: 24, start: 1, end: 25 }, itemLevel: 14,
    },
  });
  render(<MemoryRouter><WrappedPanel slug="anna" /></MemoryRouter>);
  expect(await screen.findByText("+24")).toBeTruthy();
  expect(screen.getByText(/von 1 auf 25/)).toBeTruthy();
  expect(screen.getByText(/gezählt seit dem Serverstart am 05\.11\./)).toBeTruthy();
  expect(screen.queryByText(/Beitritt/)).toBeNull();
  expect(screen.getByText("14")).toBeTruthy();
  expect(screen.queryByText("+14")).toBeNull();
  expect(screen.getByText("aktueller Stand")).toBeTruthy();
  expect(screen.getByText("Seit dem Serverstart am 05.11.2026, Stand vom 17.11.2026")).toBeTruthy();
  expect(screen.queryByText(/Verglichen/)).toBeNull();
});

test("Archiv: Liste neueste zuerst mit Nummer, Woche und Schlagzeile; Leerzustand", async () => {
  mockFetch({
    "/api/zeitung/archiv": {
      issues: [
        { issue: 3, week: "2026-11-21", from: "2026-11-16", to: "2026-11-21", headline: ueberall("Übergang"), testdaten: true },
        { issue: 2, week: "2026-W46", from: "2026-11-09", to: "2026-11-15", headline: f("Anna gibt Gas"), testdaten: true },
        { issue: 1, week: "2026-W45", from: "2026-11-02", to: "2026-11-08", headline: f("Ruhige Woche", "A ruhigs Wöchle", "A ruhige Woch"), testdaten: false },
      ],
    },
  });
  renderAt("/zeitung/archiv", <><Route path="/zeitung/archiv" element={<ZeitungArchivePage />} /><Route path="/zeitung/:woche" element={<ZeitungPage />} /></>);
  const links = await screen.findAllByRole("link");
  expect(links.map((l) => l.textContent)).toEqual([
    "Nr. 3Woche vom 16.11. bis 21.11.2026Übergang",
    "Nr. 2Woche vom 09.11. bis 15.11.2026Anna gibt Gas",
    "Nr. 1Woche vom 02.11. bis 08.11.2026Ruhige Woche",
  ]);
  expect(links[0].getAttribute("href")).toBe("/zeitung/2026-11-21");
  expect(links[1].getAttribute("href")).toBe("/zeitung/2026-W46");
  expect(screen.getByText(/Neue Ausgaben erscheinen jeden Sonntag ab 10 Uhr/)).toBeTruthy();
  expect(screen.getByRole("note")).toBeTruthy();
  cleanup();
  mockFetch({ "/api/zeitung/archiv": { issues: [] } });
  renderAt("/zeitung/archiv", <Route path="/zeitung/archiv" element={<ZeitungArchivePage />} />);
  expect((await screen.findByText(/Noch keine Ausgabe erschienen/)).textContent).toContain("jeden Sonntag ab 10 Uhr");
});

test("TitleBadge: ohne Datei nichts, bei Ladefehler nichts, Schleimer hat sein Abzeichen", () => {
  const { container, rerender } = render(<TitleBadge titleId="gibt-es-nicht" name="X" size={40} />);
  expect(container.innerHTML).toBe("");
  rerender(<TitleBadge titleId="schleimer" name="Schleimer vom Dienst" size={40} />);
  const img = screen.getByRole("img", { name: "Schleimer vom Dienst" });
  expect(img.getAttribute("src")).toBe("/titel/schleimer.png");
  fireEvent.error(img);
  expect(container.innerHTML).toBe("");
});

test("Für jeden der elf Titel liegt ein Abzeichen unter web/public/titel", async () => {
  const { existsSync, readdirSync } = await import("node:fs");
  const { TITLES } = await import("../../src/weekly/titles");
  const { TITLE_BADGE_IDS } = await import("../../web/src/components/TitleBadge");
  expect([...TITLE_BADGE_IDS].sort()).toEqual(TITLES.map((t) => t.id).sort());
  for (const id of TITLE_BADGE_IDS) expect(existsSync(`web/public/titel/${id}.png`)).toBe(true);
  expect(readdirSync("web/public/titel").sort()).toEqual([...TITLE_BADGE_IDS].map((id) => `${id}.png`).sort());
});

test("Ehrentafel: neueste Woche links, fünf Wochen je Seite, ältere per Blättern, Wert als Tooltip", async () => {
  // Bärenklaue-Wochen, die neueste endet am Samstag 14.11.
  const weeks = Array.from({ length: 7 }, (_, i) => {
    const w = 45 - i;
    const to = new Date(Date.UTC(2026, 10, 14 - 7 * i)).toISOString().slice(0, 10);
    const from = new Date(Date.UTC(2026, 10, 8 - 7 * i)).toISOString().slice(0, 10);
    return {
      week: to, from, to,
      awards: [{ titleId: "pechvogel", name: f("Pechvogel"), description: f(""), value: w, valueText: f(`${w} Tode`), character: ref({ id: w, name: `Held${w}`, slug: `held${w}` }) }],
    };
  });
  mockFetch({ "/api/titles": { ...titles, history: weeks } });
  renderAt("/titel", <Route path="/titel" element={<TitlesPage />} />);
  await screen.findByText("Ehrentafel der Vorwochen");
  const kopf = () => [...document.querySelectorAll(".honor-week a")].map((a) => a.textContent);
  expect(kopf()).toEqual(["08.11.", "01.11.", "25.10.", "18.10.", "11.10."]);
  expect([...document.querySelectorAll(".honor-week-date")].map((d) => d.textContent)[0]).toBe("bis 14.11.");
  expect(screen.getByRole("link", { name: "Woche vom 08.11. bis 14.11.2026" }).getAttribute("href")).toBe("/zeitung/2026-11-14");
  expect(screen.getByRole("link", { name: "Held45" }).parentElement?.getAttribute("title")).toBe("45 Tode");
  expect((screen.getByRole("button", { name: "‹ neuere Wochen" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "ältere Wochen ›" }));
  expect(kopf()).toEqual(["25.10.", "18.10.", "11.10.", "04.10.", "27.09."]);
  expect((screen.getByRole("button", { name: "ältere Wochen ›" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "‹ neuere Wochen" }));
  expect(kopf()[0]).toBe("08.11.");
  // Zeilen sind die Titel
  expect([...document.querySelectorAll(".honor-title")].map((t) => t.textContent)).toEqual(["Pechvogel", "Nachteule"]);
});

test("Titel auf Schwäbisch und Bayrisch: Namen, Regeln und Hinweise in der gewählten Fassung", async () => {
  mockFetch({ "/api/titles": titles });
  renderAt("/titel", <Route path="/titel" element={<TitlesPage />} />, "schwaebisch");
  expect(await screen.findByRole("heading", { name: "Titel vo dr Woch", level: 1 })).toBeTruthy();
  expect(document.querySelector(".page-header .erscheint-hint")?.textContent).toBe(
    "Neie Titel ond a neis Gildeblatt gibt's jeden Sonndig ab 10 Uhr, gwertet wird Sonndig bis Samschdig.",
  );
  expect(screen.getByText("Die Woch koiner")).toBeTruthy();
  expect(document.getElementById("regel-pechvogel")?.textContent).toBe("D'meischte Tode vo dr Woch.");
  expect(screen.getByText("Ehretafel vo de Vorwoche")).toBeTruthy();
  expect(screen.getByRole("link", { name: "zum Gildeblatt vo dere Woch" })).toBeTruthy();
  cleanup();
  renderAt("/titel", <Route path="/titel" element={<TitlesPage />} />, "bayrisch");
  expect(await screen.findByRole("heading", { name: "Titel vo da Woch", level: 1 })).toBeTruthy();
  expect([...document.querySelectorAll(".title-tile-name")].map((n) => n.textContent)).toEqual(["Pechvogerl", "Nachteiln"]);
  expect(screen.getByRole("button", { name: "Regel fia Pechvogerl" })).toBeTruthy();
  expect(screen.getByText("De Woch koana")).toBeTruthy();
  expect(screen.getByText(/De Titel gibt's oamoi in da Woch/)).toBeTruthy();
  expect(document.querySelector(".title-tile img.title-medal")?.getAttribute("src")).toBe("/titel/pechvogel.png");
});

test("Zeitung auf Schwäbisch: Schlagzeile, Text und Spruch in der schwäbischen Fassung", async () => {
  mockFetch({ "/api/zeitung": issue });
  renderAt("/zeitung", <Route path="/zeitung" element={<ZeitungPage />} />, "schwaebisch");
  const lead = await screen.findByRole("heading", { name: "Anna gibt Gas wie verruckt", level: 2 });
  expect(within(lead).getByRole("link", { name: "Anna" })).toBeTruthy();
  expect(screen.getByText("springt wie a Wiesele.", { exact: false })).toBeTruthy();
  expect(screen.getByText("isch scho wieder hee.", { exact: false })).toBeTruthy();
  expect(screen.getByText("No ned hudla.")).toBeTruthy();
  expect(screen.getByText("Level gsammelt.")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Zahl vo dr Woch", level: 2 })).toBeTruthy();
  expect(screen.getByText("Spruch vo dr Woch")).toBeTruthy();
  expect(screen.getByText("Kommt jeden Sonndig ab 10 Uhr")).toBeTruthy();
  expect(screen.getByText("Woch vom 09.11. bis 15.11.2026")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Gildeblatt", level: 1 })).toBeTruthy();
  expect(screen.getByText("S'Wocheblatt vo dr Gilde")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Älle Ausgabe im Archiv" })).toBeTruthy();
  // Die Rubrikfarbe hängt an der hochdeutschen Rubrik
  expect(document.querySelector('[data-farbe="horde"]')?.getAttribute("aria-label")).toBe("Friedhof");
  expect(screen.queryByText("Nur nicht hetzen.")).toBeNull();
});

test("Zeitung auf Bayrisch: Schlagzeile, Text und Spruch in der bayrischen Fassung", async () => {
  mockFetch({ "/api/zeitung": issue });
  renderAt("/zeitung", <Route path="/zeitung" element={<ZeitungPage />} />, "bayrisch");
  expect(await screen.findByRole("heading", { name: "Gildnblatt", level: 1 })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Anna gibt Gas, Obacht", level: 2 })).toBeTruthy();
  expect(screen.getByText("rennt wia da Blitz.", { exact: false })).toBeTruthy();
  expect(screen.getByText("is scho wieda hi.", { exact: false })).toBeTruthy();
  expect(screen.getByText("Nur ned hudln.")).toBeTruthy();
  expect(screen.getByText("Spruch vo da Woch")).toBeTruthy();
  expect(screen.getByText("Preis: a Brezn und a Hoibe")).toBeTruthy();
  expect(screen.getByRole("img", { name: "Pechvogerl" })).toBeTruthy();
  expect(screen.queryByText("No ned hudla.")).toBeNull();
});

test("Zeitungsarchiv und Leerzustand im Dialekt", async () => {
  mockFetch({
    "/api/zeitung/archiv": {
      issues: [{ issue: 1, week: "2026-W45", from: "2026-11-02", to: "2026-11-08", headline: f("Ruhige Woche", "A ruhigs Wöchle", "A ruhige Woch"), testdaten: false }],
    },
  });
  renderAt("/zeitung/archiv", <Route path="/zeitung/archiv" element={<ZeitungArchivePage />} />, "schwaebisch");
  expect((await screen.findByRole("link")).textContent).toBe("Nr. 1Woch vom 02.11. bis 08.11.2026A ruhigs Wöchle");
  expect(screen.getByText(/Neie Ausgabe kommet jeden Sonndig ab 10 Uhr/)).toBeTruthy();
  cleanup();
  mockFetch({});
  renderAt("/zeitung", <Route path="/zeitung" element={<ZeitungPage />} />, "bayrisch");
  expect((await screen.findByText(/As Gildnblatt kimmt/)).textContent).toContain("De erste Ausgab kimmt am Sonntag");
});

test("Aktivität im Dialekt: Wochentage, Kennzahlen und Raster", async () => {
  mockFetch({ "/api/activity": activity });
  renderAt("/statistik/aktivitaet", <Route path="/statistik/:reiter" element={<StatsPage />} />, "schwaebisch");
  expect(await screen.findByText("Freidig, 21 bis 22 Uhr")).toBeTruthy();
  expect(screen.getByText("Stärkschte Stond")).toBeTruthy();
  expect(screen.getByLabelText("Freidig, 21 bis 22 Uhr: 7 Anmeldunge").className).toContain("heat-5");
  expect(screen.getByText("Wann isch d'Gilde online?")).toBeTruthy();
  cleanup();
  renderAt("/statistik/aktivitaet", <Route path="/statistik/:reiter" element={<StatsPage />} />, "bayrisch");
  expect(await screen.findByText("Stärksta Tag")).toBeTruthy();
  expect(screen.getByText(/De letztn 2 Wochn/)).toBeTruthy();
  expect(screen.getByText("vui")).toBeTruthy();
});

test("Titel auf Englisch: Seitenkopf, Kacheln und Wochenzeitung ohne Gildennamen", async () => {
  mockFetch({ "/api/titles": titles });
  renderAt("/titel", <Route path="/titel" element={<TitlesPage />} />, "en");
  expect(await screen.findByRole("heading", { name: "Titles of the Week", level: 1 })).toBeTruthy();
  expect(document.querySelector(".page-header .erscheint-hint")?.textContent).toBe(
    "New titles and a new issue of Guild Gazette arrive every Sunday from 10:00, counting Sunday to Saturday.",
  );
  expect(screen.getByText("Nobody this week")).toBeTruthy();
  expect(screen.getByText("Hall of Fame: Previous Weeks")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Read this week's Guild Gazette" })).toBeTruthy();
  expect(document.body.textContent).not.toMatch(/Gildeblatt|Bärenklaue/);
  cleanup();
  vi.stubEnv("WEBSITE_NEWSPAPER", "Gildenkurier");
  renderAt("/titel", <Route path="/titel" element={<TitlesPage />} />);
  expect(await screen.findByRole("link", { name: "Gildenkurier dieser Woche lesen" })).toBeTruthy();
  vi.unstubAllEnvs();
});

test("Wrapped auf Englisch: Marke aus WEBSITE_NAME, Kennzahlen und Lieblingszeit", async () => {
  vi.stubEnv("WEBSITE_NAME", "Die Tapferen");
  mockFetch({ "/api/wrapped/anna": wrapped });
  render(<SpracheProvider start="en"><MemoryRouter><WrappedPanel slug="anna" /></MemoryRouter></SpracheProvider>);
  expect(await screen.findByText(/Levels gained, from 20 to 25/)).toBeTruthy();
  expect(document.querySelector(".wrapped-brand")?.textContent).toBe("Die Tapferen Wrapped");
  expect(screen.getByText(/Rank 2 of 9 in the community/)).toBeTruthy();
  expect(screen.getByText("Tuesdays, 21:00 to 22:00")).toBeTruthy();
  expect(screen.getByText("immortal!")).toBeTruthy();
  expect(screen.getByText("Week of 08.11. to 14.11., 7 Tode")).toBeTruthy();
  cleanup();
  vi.unstubAllEnvs();
  mockFetch({ "/api/wrapped/anna": wrapped });
  render(<MemoryRouter><WrappedPanel slug="anna" /></MemoryRouter>);
  expect((await screen.findByRole("article")).getAttribute("aria-label")).toBe("Gildenseite-Rückblick November 2026 für Anna");
  expect(document.querySelector(".wrapped-brand")?.textContent).toBe("Gildenseite-Rückblick");
});

test("Wrapped im Dialekt: Kennzahlen, Lieblingszeit und Titel", async () => {
  mockFetch({ "/api/wrapped/anna": wrapped });
  render(<SpracheProvider start="schwaebisch"><MemoryRouter><WrappedPanel slug="anna" /></MemoryRouter></SpracheProvider>);
  expect(await screen.findByText(/Level gwonne, vo 20 auf 25/)).toBeTruthy();
  expect(screen.getByText("Dienschdigs, 21 bis 22 Uhr")).toBeTruthy();
  expect(screen.getByText("no koine Date")).toBeTruthy();
  expect(screen.getByText("net kaputt z'kriege!")).toBeTruthy();
  cleanup();
  mockFetch({ "/api/wrapped/anna": wrapped });
  render(<SpracheProvider start="bayrisch"><MemoryRouter><WrappedPanel slug="anna" /></MemoryRouter></SpracheProvider>);
  expect(await screen.findByText(/Platz 2 vo 9 in da Gmoaschaft/)).toBeTruthy();
  expect(screen.getByText("Pechvogerl")).toBeTruthy();
  expect(screen.getByText("ned umzbringa!")).toBeTruthy();
});

test("Wochenzeitung auf Englisch: Kopf, Rubriken und Texte in der englischen Fassung, fehlendes Englisch fällt auf Deutsch zurück", async () => {
  const en: ZeitungView = {
    ...issue,
    lead: { ...issue.lead, headline: f("Anna gibt Gas", "Anna gibt Gas wie verruckt", "Anna gibt Gas, Obacht", "Anna hits the gas") },
    motto: f("Nur nicht hetzen.", "No ned hudla.", "Nur ned hudln.", "Slow and steady wins the race."),
    articles: [issue.articles[0], { ...issue.articles[1], section: f("Zahl der Woche", "Zahl der Woche", "Zahl der Woche", "Number of the Week") }],
  };
  mockFetch({ "/api/zeitung": en });
  renderAt("/zeitung", <Route path="/zeitung" element={<ZeitungPage />} />, "en");
  expect(await screen.findByRole("heading", { name: "Guild Gazette", level: 1 })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Anna hits the gas", level: 2 })).toBeTruthy();
  expect(screen.getByText("Slow and steady wins the race.")).toBeTruthy();
  expect(screen.getByText("Saying of the week")).toBeTruthy();
  expect(screen.getByText("Issue 3")).toBeTruthy();
  expect(screen.getByText("The guild's weekly paper")).toBeTruthy();
  expect(screen.getByText("Price: one healing potion")).toBeTruthy();
  expect(screen.getByRole("link", { name: "All issues in the archive" })).toBeTruthy();
  // Alte Ausgaben ohne Englisch zeigen den deutschen Text
  expect(screen.getByText("Level gesammelt.")).toBeTruthy();
});

test("WEBSITE_NEWSPAPER gibt der Wochenzeitung in allen Sprachen denselben Namen", async () => {
  vi.stubEnv("WEBSITE_NEWSPAPER", "Bärenklaue-Blatt");
  try {
    mockFetch({ "/api/zeitung": issue });
    renderAt("/zeitung", <Route path="/zeitung" element={<ZeitungPage />} />, "en");
    expect(await screen.findByRole("heading", { name: "Bärenklaue-Blatt", level: 1 })).toBeTruthy();
    cleanup();
    mockFetch({ "/api/zeitung/archiv": { issues: [] } });
    renderAt("/zeitung/archiv", <Route path="/zeitung/archiv" element={<ZeitungArchivePage />} />, "bayrisch");
    expect(await screen.findByRole("heading", { name: "Bärenklaue-Blatt-Archiv", level: 1 })).toBeTruthy();
    expect(screen.getByText(/As Bärenklaue-Blatt kimmt/)).toBeTruthy();
  } finally {
    vi.unstubAllEnvs();
  }
});
