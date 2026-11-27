// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, expect, test, vi } from "vitest";
import type { ActivityView, NewspaperView, CharacterRef, TitlesView, WrappedView } from "../../src/api/types";
import { TitleBadge } from "../../web/src/components/TitleBadge";
import { WrappedPanel } from "../../web/src/components/WrappedCard";
import { sameInAll, type Translations } from "../../src/language";
import { dayTotals, heatLevel, monthLabel, peak, splitByNames, weekLabel, weekRangeLabel } from "../../web/src/lib/fun";
import { LanguageProvider, type Language } from "../../web/src/lib/language";
import { StatsPage } from "../../web/src/pages/StatsPage";
import { NewspaperArchivePage, NewspaperPage } from "../../web/src/pages/NewspaperPage";
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

function renderAt(path: string, routes: React.ReactNode, language?: Language) {
  const site = <MemoryRouter initialEntries={[path]}><Routes>{routes}</Routes></MemoryRouter>;
  render(language ? <LanguageProvider start={language}>{site}</LanguageProvider> : site);
}

const f = (de: string, schwaebisch = de, bayrisch = de, en = de): Translations => ({ de, en, schwaebisch, bayrisch });

test("helpers: heat levels, peak, day totals, names in text, labels", () => {
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

test("activity: grid, busiest hour, sample data notice, guild filter with empty state", async () => {
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

test("activity: characters opens the list with logins per character", async () => {
  const member = (id: number, name: string, guildSlug: string) => ({
    id, name, surname: null, slug: name.toLowerCase(), level: 30, classId: 1, className: "Krieger", raceId: 2, raceName: "Orc",
    rank: 1, rankName: "Mitglied", itemLevel: null, mainSpecName: null, hasProfile: true, former: false, guildSlug, guildName: guildSlug, professions: [],
  });
  mockFetch({
    "/api/activity": activity,
    "/api/guild": {
      fetchedAt: "2026-11-21T09:00:00Z", name: "Bärenklaue", faction: "HORDE", rulesetName: "Classic", memberCount: 2, guilds: activity.guilds,
      classes: [], ranks: [], members: [member(1, "Anna", "bärenklaue"), member(2, "Bodo", "goldene-bärenklaue")],
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

test("titles: tiles with winners, empty titles, hall of fame", async () => {
  mockFetch({ "/api/titles": titles });
  renderAt("/titel", <Route path="/titel" element={<TitlesPage />} />);
  const winner = await screen.findByRole("link", { name: "Anna" });
  expect(winner.getAttribute("href")).toBe("/charakter/anna");
  expect(screen.getByText("7 Tode")).toBeTruthy();
  expect(screen.getByRole("img", { name: "Horde" }).getAttribute("src")).toContain("pvpcurrency-honor-horde");
  // Large badges in the tiles, titles not awarded dimmed; hall of fame with small badges in the header
  const tiles = [...document.querySelectorAll(".title-tile")];
  expect(tiles.map((k) => k.querySelector("img.title-medal")?.getAttribute("src"))).toEqual(["/titel/pechvogel.png", "/titel/nachteule.png"]);
  expect(tiles[1].querySelector("img.title-medal")?.className).toContain("title-medal-muted");
  expect(tiles[0].querySelector("img.title-medal")?.getAttribute("width")).toBe("92");
  // Hall of fame rotated: one row per title with a small badge, not awarded shown as a dash
  expect(document.querySelectorAll(".honor-title img.title-medal")).toHaveLength(2);
  expect(document.querySelectorAll(".honor-none").length).toBeGreaterThan(0);
  expect(screen.queryByText("k. A.")).toBeNull();
  // Rule visible only after pressing the button
  const rule = screen.getByRole("button", { name: "Regel für Pechvogel" });
  expect(rule.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(rule);
  expect(rule.getAttribute("aria-expanded")).toBe("true");
  expect(document.getElementById("regel-pechvogel")?.className).toContain("title-tile-rule-open");
  expect(screen.getByText("Diese Woche niemand")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Woche vom 02.11. bis 08.11.2026" }).getAttribute("href")).toBe("/zeitung/2026-W45");
  expect(screen.queryByRole("note")).toBeNull();
  // Clearly visible: when there is something new, and no more calendar weeks
  expect(document.querySelector(".page-header .erscheint-hint")?.textContent).toContain("jeden Sonntag ab 10 Uhr");
  expect(screen.getByText(/gewertet wird Sonntag bis Samstag\. Bei Gleichstand/)).toBeTruthy();
  expect(document.body.textContent).not.toMatch(/KW \d/);
});

test("titles: click on tile or hall of fame shows the ranking of the week, all holders highlighted", async () => {
  const member = (id: number, name: string) => ({
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
    "/api/titles?title=pechvogel&week=2026-W46": {
      titleId: "pechvogel", week: "2026-W46", from: "2026-11-09", to: "2026-11-15", winnerIds: [1, 2], complete: true,
      // Tie: Anna and Bodo share the title, Anna is shown on the card
      entries: [[1, 7], [2, 7], [3, 1]], valueTexts: { "7": f("7 Tode"), "1": f("1 Tod") },
    },
    "/api/titles?title=pechvogel&week=2026-W45": {
      titleId: "pechvogel", week: "2026-W45", from: "2026-11-02", to: "2026-11-08", winnerIds: [2], complete: false,
      entries: [[2, 4]], valueTexts: { "4": f("4 Tode") },
    },
    "/api/guild": {
      fetchedAt: "2026-11-21T09:00:00Z", name: "Bärenklaue", faction: "HORDE", rulesetName: "Classic", memberCount: 3, guilds: view.guilds,
      classes: [], ranks: [], members: [member(1, "Anna"), member(2, "Bodo"), member(3, "Cleo")],
    },
  });
  renderAt("/titel", <Route path="/titel" element={<TitlesPage />} />);
  await screen.findByText("7 Tode");
  // Titles not awarded without a stored ranking have no trigger, the current week does
  const tiles = [...document.querySelectorAll(".title-tile")];
  expect(tiles.map((k) => k.className.includes("title-tile-clickable"))).toEqual([true, true]);
  // Click on the tile itself (not on the link) opens the list
  fireEvent.click(tiles[0].querySelector(".title-tile-name")!);
  let dialog = await screen.findByRole("dialog", { name: "Pechvogel" });
  await within(dialog).findByRole("table");
  expect(fetch).toHaveBeenCalledWith("/api/titles?title=pechvogel&week=2026-W46", expect.anything());
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

  // Hall of fame: old week without ranking shows the winner with a note
  fireEvent.click(screen.getByRole("button", { name: "Rangliste Pechvogel, Woche vom 02.11. bis 08.11.2026" }));
  dialog = await screen.findByRole("dialog", { name: "Pechvogel" });
  await within(dialog).findByRole("table");
  expect(within(dialog).getByText(/nur der Gewinner gespeichert/)).toBeTruthy();
  const older = within(dialog).getAllByRole("row").slice(1);
  expect(older.map((r) => [r.querySelector("a")?.textContent, r.lastElementChild?.textContent])).toEqual([["Bodo", "4 Tode"]]);
  // Nachteule in the old week: not awarded, no ranking, no button
  expect(screen.queryByRole("button", { name: /Rangliste Nachteule, Woche vom 02\.11\./ })).toBeNull();
});

test("shared title: card shows the holder and how many others have it, the extra opens the ranking", async () => {
  const view: TitlesView = {
    ...titles,
    current: { ...titles.current!, awards: [{ ...titles.current!.awards[0], sharedWith: 12 }] },
  };
  const fetch = mockFetch({
    "/api/titles": view,
    "/api/titles?title=pechvogel&week=2026-W46": {
      titleId: "pechvogel", week: "2026-W46", from: "2026-11-09", to: "2026-11-15", winnerIds: [1], complete: true,
      entries: [[1, 7]], valueTexts: { "7": f("7 Tode") },
    },
    "/api/guild": { fetchedAt: "2026-11-21T09:00:00Z", name: "Bärenklaue", faction: "HORDE", rulesetName: "Classic", memberCount: 0, guilds: view.guilds, classes: [], ranks: [], members: [] },
  });
  renderAt("/titel", <Route path="/titel" element={<TitlesPage />} />);
  // Only one name on the card, no list of names
  expect(await screen.findByRole("link", { name: "Anna" })).toBeTruthy();
  const extra = screen.getByRole("button", { name: "teilt sich den Titel mit 12 weiteren" });
  // Rule popup explains the tie, only for shared titles
  expect(document.getElementById("regel-pechvogel")?.textContent).toMatch(/am längsten nicht hatte/);
  expect(document.getElementById("regel-nachteule")?.textContent).not.toMatch(/Gleichstand/);
  expect(screen.getByText(/Bei Gleichstand teilen sich alle den Titel/)).toBeTruthy();
  expect(document.body.textContent).not.toMatch(/alphabetisch/);
  fireEvent.click(extra);
  await screen.findByRole("dialog", { name: "Pechvogel" });
  expect(fetch).toHaveBeenCalledWith("/api/titles?title=pechvogel&week=2026-W46", expect.anything());
});

test("shared title: singular and dialect", async () => {
  const view: TitlesView = {
    ...titles,
    current: { ...titles.current!, awards: [{ ...titles.current!.awards[0], sharedWith: 1 }] },
  };
  mockFetch({ "/api/titles": view });
  renderAt("/titel", <Route path="/titel" element={<TitlesPage />} />, "schwaebisch");
  expect(await screen.findByRole("button", { name: "teilt sich dr Titel mit oim andre" })).toBeTruthy();
});

test("titles before the first scoring: empty state", async () => {
  mockFetch({ "/api/titles": { ...titles, current: null, history: [] } });
  renderAt("/titel", <Route path="/titel" element={<TitlesPage />} />);
  expect(await screen.findByText(/noch nicht ausgewertet/)).toBeTruthy();
  expect(screen.getByText(/Neue Titel gibt es jeden Sonntag ab 10 Uhr/)).toBeTruthy();
});

const issue: NewspaperView = {
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

test("newspaper: masthead, linked names, saying and paging", async () => {
  mockFetch({ "/api/newspaper": issue });
  renderAt("/zeitung", <Route path="/zeitung" element={<NewspaperPage />} />);
  expect(await screen.findByRole("heading", { name: "Gildenblatt", level: 1 })).toBeTruthy();
  // Without guild names in the issue the subline stays neutral
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

test("newspaper: week in numbers with guild filter, weather forecast and look back", async () => {
  const z = (kind: "anmeldungen" | "level" | "tode", value: number, lastWeek: number | null) => ({ art: kind, wert: value, vorwoche: lastWeek });
  mockFetch({
    "/api/newspaper": {
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
  renderAt("/zeitung", <Route path="/zeitung" element={<NewspaperPage />} />);
  const box = await screen.findByRole("region", { name: "Woche in Zahlen" });
  // Guild names in the subline come from the issue data
  expect(screen.getByText("Wochenzeitung von Bärenklaue und Goldene Bärenklaue")).toBeTruthy();
  const rows = () => [...box.querySelectorAll(".zeitung-zahlen-zeile")].map((d) => d.textContent);
  expect(rows()).toEqual(["Anmeldungen120▲ +20 zur Vorwoche", "Level30=wie in der Vorwoche", "Tode9"]);
  fireEvent.click(within(box).getByRole("radio", { name: /Goldene Bärenklaue/ }));
  expect(rows()).toEqual(["Tode7▲ +6 zur Vorwoche"]);
  fireEvent.click(within(box).getByRole("radio", { name: /^Bärenklaue/ }));
  expect(rows()).toEqual(["Tode2▼ −3 zur Vorwoche"]);
  expect(screen.getByRole("region", { name: "Wetterbericht" }).textContent).toContain("Sturm über Azeroth.");
  const lookBack = screen.getByRole("region", { name: "Vor 4 Wochen" });
  expect(within(lookBack).getByRole("link").getAttribute("href")).toBe("/zeitung/2026-W42");
  expect(lookBack.textContent).toContain("Anna rast los");
});

test("newspaper: old issue without numbers, weather and look back", async () => {
  mockFetch({ "/api/newspaper": issue });
  renderAt("/zeitung", <Route path="/zeitung" element={<NewspaperPage />} />);
  await screen.findByRole("heading", { name: "Gildenblatt", level: 1 });
  expect(screen.queryByRole("region", { name: "Woche in Zahlen" })).toBeNull();
  expect(screen.queryByRole("region", { name: "Wetterbericht" })).toBeNull();
  expect(screen.queryByRole("region", { name: "Vor 4 Wochen" })).toBeNull();
});

test("newspaper: unknown issue and no issue yet", async () => {
  mockFetch({});
  renderAt("/zeitung/2026-W01", <Route path="/zeitung/:woche" element={<NewspaperPage />} />);
  expect(await screen.findByText("Diese Ausgabe gibt es nicht.")).toBeTruthy();
  cleanup();
  renderAt("/zeitung", <Route path="/zeitung" element={<NewspaperPage />} />);
  const empty = await screen.findByText(/Neue Ausgaben erscheinen/);
  expect(empty.textContent).toContain("jeden Sonntag ab 10 Uhr");
  expect(empty.className).toBe("erscheint-hint");
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

test("wrapped: card with key figures, missing values as a note, month selection reloads", async () => {
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

test("wrapped: note when counting only since joining", async () => {
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

test("wrapped: in the month of the server launch it says so, item level as current value", async () => {
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

test("archive: list newest first with number, week and headline; empty state", async () => {
  mockFetch({
    "/api/newspaper/archive": {
      issues: [
        { issue: 3, week: "2026-11-21", from: "2026-11-16", to: "2026-11-21", headline: sameInAll("Übergang"), testdaten: true },
        { issue: 2, week: "2026-W46", from: "2026-11-09", to: "2026-11-15", headline: f("Anna gibt Gas"), testdaten: true },
        { issue: 1, week: "2026-W45", from: "2026-11-02", to: "2026-11-08", headline: f("Ruhige Woche", "A ruhigs Wöchle", "A ruhige Woch"), testdaten: false },
      ],
    },
  });
  renderAt("/zeitung/archiv", <><Route path="/zeitung/archiv" element={<NewspaperArchivePage />} /><Route path="/zeitung/:woche" element={<NewspaperPage />} /></>);
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
  mockFetch({ "/api/newspaper/archive": { issues: [] } });
  renderAt("/zeitung/archiv", <Route path="/zeitung/archiv" element={<NewspaperArchivePage />} />);
  expect((await screen.findByText(/Noch keine Ausgabe erschienen/)).textContent).toContain("jeden Sonntag ab 10 Uhr");
});

test("TitleBadge: nothing without a file, nothing on load error, Schleimer has its badge", () => {
  const { container, rerender } = render(<TitleBadge titleId="gibt-es-nicht" name="X" size={40} />);
  expect(container.innerHTML).toBe("");
  rerender(<TitleBadge titleId="schleimer" name="Schleimer vom Dienst" size={40} />);
  const img = screen.getByRole("img", { name: "Schleimer vom Dienst" });
  expect(img.getAttribute("src")).toBe("/titel/schleimer.png");
  fireEvent.error(img);
  expect(container.innerHTML).toBe("");
});

test("every one of the eleven titles has a badge in web/public/titel", async () => {
  const { existsSync, readdirSync } = await import("node:fs");
  const { TITLES } = await import("../../src/weekly/titles");
  const { TITLE_BADGE_IDS } = await import("../../web/src/components/TitleBadge");
  expect([...TITLE_BADGE_IDS].sort()).toEqual(TITLES.map((t) => t.id).sort());
  for (const id of TITLE_BADGE_IDS) expect(existsSync(`web/public/titel/${id}.png`)).toBe(true);
  expect(readdirSync("web/public/titel").sort()).toEqual([...TITLE_BADGE_IDS].map((id) => `${id}.png`).sort());
});

test("hall of fame: newest week on the left, five weeks per page, older by paging, value as tooltip", async () => {
  // Bärenklaue weeks, the newest ends on Saturday 14.11.
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
  const header = () => [...document.querySelectorAll(".honor-week a")].map((a) => a.textContent);
  expect(header()).toEqual(["08.11.", "01.11.", "25.10.", "18.10.", "11.10."]);
  expect([...document.querySelectorAll(".honor-week-date")].map((d) => d.textContent)[0]).toBe("bis 14.11.");
  expect(screen.getByRole("link", { name: "Woche vom 08.11. bis 14.11.2026" }).getAttribute("href")).toBe("/zeitung/2026-11-14");
  expect(screen.getByRole("link", { name: "Held45" }).parentElement?.getAttribute("title")).toBe("45 Tode");
  expect((screen.getByRole("button", { name: "‹ neuere Wochen" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "ältere Wochen ›" }));
  expect(header()).toEqual(["25.10.", "18.10.", "11.10.", "04.10.", "27.09."]);
  expect((screen.getByRole("button", { name: "ältere Wochen ›" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "‹ neuere Wochen" }));
  expect(header()[0]).toBe("08.11.");
  // Rows are the titles
  expect([...document.querySelectorAll(".honor-title")].map((t) => t.textContent)).toEqual(["Pechvogel", "Nachteule"]);
});

test("titles in Swabian and Bavarian: names, rules and notes in the selected version", async () => {
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

test("newspaper in Swabian: headline, text and saying in the Swabian version", async () => {
  mockFetch({ "/api/newspaper": issue });
  renderAt("/zeitung", <Route path="/zeitung" element={<NewspaperPage />} />, "schwaebisch");
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
  // The section color depends on the Standard German section
  expect(document.querySelector('[data-farbe="horde"]')?.getAttribute("aria-label")).toBe("Friedhof");
  expect(screen.queryByText("Nur nicht hetzen.")).toBeNull();
});

test("newspaper in Bavarian: headline, text and saying in the Bavarian version", async () => {
  mockFetch({ "/api/newspaper": issue });
  renderAt("/zeitung", <Route path="/zeitung" element={<NewspaperPage />} />, "bayrisch");
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

test("newspaper archive and empty state in dialect", async () => {
  mockFetch({
    "/api/newspaper/archive": {
      issues: [{ issue: 1, week: "2026-W45", from: "2026-11-02", to: "2026-11-08", headline: f("Ruhige Woche", "A ruhigs Wöchle", "A ruhige Woch"), testdaten: false }],
    },
  });
  renderAt("/zeitung/archiv", <Route path="/zeitung/archiv" element={<NewspaperArchivePage />} />, "schwaebisch");
  expect((await screen.findByRole("link")).textContent).toBe("Nr. 1Woch vom 02.11. bis 08.11.2026A ruhigs Wöchle");
  expect(screen.getByText(/Neie Ausgabe kommet jeden Sonndig ab 10 Uhr/)).toBeTruthy();
  cleanup();
  mockFetch({});
  renderAt("/zeitung", <Route path="/zeitung" element={<NewspaperPage />} />, "bayrisch");
  expect((await screen.findByText(/As Gildnblatt kimmt/)).textContent).toContain("De erste Ausgab kimmt am Sonntag");
});

test("activity in dialect: weekdays, key figures and grid", async () => {
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

test("titles in English: page header, tiles and newspaper without guild names", async () => {
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

test("wrapped in English: brand from WEBSITE_NAME, key figures and favorite time", async () => {
  vi.stubEnv("WEBSITE_NAME", "Die Tapferen");
  mockFetch({ "/api/wrapped/anna": wrapped });
  render(<LanguageProvider start="en"><MemoryRouter><WrappedPanel slug="anna" /></MemoryRouter></LanguageProvider>);
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

test("wrapped in dialect: key figures, favorite time and titles", async () => {
  mockFetch({ "/api/wrapped/anna": wrapped });
  render(<LanguageProvider start="schwaebisch"><MemoryRouter><WrappedPanel slug="anna" /></MemoryRouter></LanguageProvider>);
  expect(await screen.findByText(/Level gwonne, vo 20 auf 25/)).toBeTruthy();
  expect(screen.getByText("Dienschdigs, 21 bis 22 Uhr")).toBeTruthy();
  expect(screen.getByText("no koine Date")).toBeTruthy();
  expect(screen.getByText("net kaputt z'kriege!")).toBeTruthy();
  cleanup();
  mockFetch({ "/api/wrapped/anna": wrapped });
  render(<LanguageProvider start="bayrisch"><MemoryRouter><WrappedPanel slug="anna" /></MemoryRouter></LanguageProvider>);
  expect(await screen.findByText(/Platz 2 vo 9 in da Gmoaschaft/)).toBeTruthy();
  expect(screen.getByText("Pechvogerl")).toBeTruthy();
  expect(screen.getByText("ned umzbringa!")).toBeTruthy();
});

test("newspaper in English: masthead, sections and texts in English, missing English falls back to German", async () => {
  const en: NewspaperView = {
    ...issue,
    lead: { ...issue.lead, headline: f("Anna gibt Gas", "Anna gibt Gas wie verruckt", "Anna gibt Gas, Obacht", "Anna hits the gas") },
    motto: f("Nur nicht hetzen.", "No ned hudla.", "Nur ned hudln.", "Slow and steady wins the race."),
    articles: [issue.articles[0], { ...issue.articles[1], section: f("Zahl der Woche", "Zahl der Woche", "Zahl der Woche", "Number of the Week") }],
  };
  mockFetch({ "/api/newspaper": en });
  renderAt("/zeitung", <Route path="/zeitung" element={<NewspaperPage />} />, "en");
  expect(await screen.findByRole("heading", { name: "Guild Gazette", level: 1 })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Anna hits the gas", level: 2 })).toBeTruthy();
  expect(screen.getByText("Slow and steady wins the race.")).toBeTruthy();
  expect(screen.getByText("Saying of the week")).toBeTruthy();
  expect(screen.getByText("Issue 3")).toBeTruthy();
  expect(screen.getByText("The guild's weekly paper")).toBeTruthy();
  expect(screen.getByText("Price: one healing potion")).toBeTruthy();
  expect(screen.getByRole("link", { name: "All issues in the archive" })).toBeTruthy();
  // Old issues without English show the German text
  expect(screen.getByText("Level gesammelt.")).toBeTruthy();
});

test("WEBSITE_NEWSPAPER gives the newspaper the same name in all languages", async () => {
  vi.stubEnv("WEBSITE_NEWSPAPER", "Bärenklaue-Blatt");
  try {
    mockFetch({ "/api/newspaper": issue });
    renderAt("/zeitung", <Route path="/zeitung" element={<NewspaperPage />} />, "en");
    expect(await screen.findByRole("heading", { name: "Bärenklaue-Blatt", level: 1 })).toBeTruthy();
    cleanup();
    mockFetch({ "/api/newspaper/archive": { issues: [] } });
    renderAt("/zeitung/archiv", <Route path="/zeitung/archiv" element={<NewspaperArchivePage />} />, "bayrisch");
    expect(await screen.findByRole("heading", { name: "Bärenklaue-Blatt-Archiv", level: 1 })).toBeTruthy();
    expect(screen.getByText(/As Bärenklaue-Blatt kimmt/)).toBeTruthy();
  } finally {
    vi.unstubAllEnvs();
  }
});
