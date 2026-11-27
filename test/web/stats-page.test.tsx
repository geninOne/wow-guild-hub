// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { GuildDungeonsView, GuildView, MemberRow, StatsView } from "../../src/api/types";
import { ueberall, type Fassungen } from "../../src/sprache";
import App from "../../web/src/App";
import { SpracheProvider, type Sprache } from "../../web/src/lib/sprache";
import { StatsPage } from "../../web/src/pages/StatsPage";

beforeEach(() => {
  // jsdom meldet "en-US"; ohne gemerkte Wahl gilt sonst Englisch.
  vi.spyOn(navigator, "language", "get").mockReturnValue("de-DE");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

const f = (de: string, schwaebisch = de, bayrisch = de, en = de): Fassungen => ({ de, en, schwaebisch, bayrisch });
const paar = (einzahl: string, mehrzahl: string): Fassungen<[string, string]> => ueberall([einzahl, mehrzahl]);

function member(over: Partial<MemberRow>): MemberRow {
  return {
    id: 1, name: "X", surname: null, slug: "x", level: 10, classId: 5, className: "Priester", raceId: 1, raceName: "Mensch",
    rank: 1, rankName: "Offizier", itemLevel: null, mainSpecName: null, hasProfile: true, former: false,
    guildSlug: "bärenklaue", guildName: "Bärenklaue", professions: [], ...over,
  };
}

const guild: GuildView = {
  fetchedAt: "2026-11-21T09:13:00Z", name: "Bärenklaue", faction: "HORDE", rulesetName: "Classic Era", memberCount: 3,
  guilds: [
    { slug: "bärenklaue", name: "Bärenklaue", faction: "HORDE", memberCount: 2, main: true },
    { slug: "goldene-bärenklaue", name: "Goldene Bärenklaue", faction: "ALLIANCE", memberCount: 1, main: false },
  ],
  classes: [{ id: 5, name: "Priester" }, { id: 1, name: "Krieger" }],
  ranks: [],
  members: [
    member({ id: 1, name: "Anna", level: 60 }),
    member({ id: 2, name: "Bodo", level: 12, classId: 1, className: "Krieger", guildSlug: "goldene-bärenklaue", guildName: "Goldene Bärenklaue" }),
    member({ id: 3, name: "Weg", level: 30, former: true }),
  ],
};

const ref = (id: number, name: string, classId: number, guildSlug = "bärenklaue") => ({ id, name, surname: null, slug: name.toLowerCase(), classId, former: false, guildSlug });

type Entry = StatsView["cards"][number]["stats"][number];
const entry = (over: Partial<Entry> & { id: number; name: string }): Entry => ({
  art: "zaehler", total: 0, perGuild: { "bärenklaue": 0, "goldene-bärenklaue": 0 }, leaders: [], holders: 0, sum: 0, classId: null, short: null, unit: null, honor: null,
  conversion: null, ...over,
});

const gesamt: StatsView = {
  kind: "gesamt", id: null, status: "ok", before: null, after: "2026-11-21", takenAt: "2026-11-21T09:00:00Z",
  serverStart: "2026-11-05", nachgeholt: false, characters: 2, weeks: ["2026-11-21", "2026-11-14"], months: ["2026-11"],
  guilds: guild.guilds, guild: null,
  cards: [
    {
      slug: "tode", form: "grabsteinfeld",
      title: f("Wer hat am häufigsten ins Gras gebissen?", "Wer hat am öftesten ins Gras bissa?", "Wer hod am öftan ins Gras bissn?"),
      blurb: f("Sterben gehört dazu.", "Sterbe ghört dazu.", "Sterbn ghört dazua."), span: 3,
      stats: [
        entry({ id: 60, name: "Tode insgesamt", total: 1234, short: f("Tode"), unit: paar("Tod", "Tode"), honor: f("Goldener Grabstein", "Goldener Grabstoi", "Goldener Grabstoa"), leaders: [{ character: ref(1, "Anna", 5), value: 1000 }, { character: ref(2, "Bodo", 1, "goldene-bärenklaue"), value: 234 }] }),
        entry({ id: 114, name: "Tode durch Stürze", total: 34, short: f("Stürze", "Stürz", "Stürz"), honor: f("Bleierne Feder"), leaders: [{ character: ref(2, "Bodo", 1, "goldene-bärenklaue"), value: 34 }] }),
        entry({ id: 112, name: "Tode durch Ertrinken", total: 200, short: f("Ertrinken", "Versaufa", "Dasaufa") }),
        entry({ id: 113, name: "Tode durch Erschöpfung", total: 0, short: f("Erschöpfung") }),
      ],
    },
    {
      slug: "fische", form: "piktogramm", title: f("Petri Heil!"), blurb: null, span: 1,
      stats: [entry({ id: 1518, name: "Gefangene Fische", total: 17812, unit: paar("Fisch", "Fische"), honor: f("Goldene Angel"), leaders: [{ character: ref(1, "Anna", 5), value: 17812 }] })],
    },
    {
      slug: "duelle", form: "waage", title: f("Mittagsduell vor dem Gasthaus", "Mittagsduell vorm Gasthaus", "Mittagsduell vorm Wirtshaus"), blurb: null, span: 1,
      stats: [entry({ id: 319, name: "Duelle gewonnen", total: 12, short: f("Gewonnen", "Gwonne", "Gwonna") }), entry({ id: 320, name: "Duelle verloren", total: 8, short: f("Verloren", "Verlore", "Valorn") })],
    },
    {
      slug: "vesper", form: "wusstest-du", title: f("Wusstest du?", "Hosch gwusst?", "Hosd des gwusst?"), blurb: null, span: 1,
      stats: [entry({ id: 346, name: "Getränke verbraucht", total: 19572, unit: paar("Getränk", "Getränke"), conversion: { per: 100, unit: { de: ["Fass", "Fässer"], en: ["barrel", "barrels"], schwaebisch: ["Fass", "Fässer"], bayrisch: ["Fassl", "Fassl"] }, text: f("wenn ein Fass hundert Krüge hergibt", "wenn a Fass hundert Krüg hergibt", "wenn a Fassl hundert Maß hergibt") } })],
    },
    {
      slug: "emotes", form: "fraktionsduell", title: f("Wir reden, wir winken, wir jubeln", "Mir schwätzet, mir winket, mir jubelet", "Mia redn, mia winkn, mia jubeln"), blurb: null, span: 2,
      stats: [
        entry({ id: 1065, name: "Anzahl /winken", total: 30, short: f("Winken"), perGuild: { "bärenklaue": 20, "goldene-bärenklaue": 10 }, leaders: [{ character: ref(1, "Anna", 5), value: 20 }] }),
        entry({ id: 1045, name: "Anzahl /jubeln", total: 5, short: f("Jubeln"), perGuild: { "bärenklaue": 1, "goldene-bärenklaue": 4 } }),
      ],
    },
    {
      slug: "ausreden", form: "zahl", title: f("Ach, das mache ich morgen", "Ach, des mach i morge", "Ach, des mach i morgn"), blurb: null, span: 1,
      stats: [entry({ id: 94, name: "Quests abgebrochen", total: 0 })],
    },
  ],
};

const woche: StatsView = { ...gesamt, kind: "woche", id: "2026-11-21", status: "zu-wenig", weeks: ["2026-11-21"], cards: [] };

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

function Where() {
  const location = useLocation();
  return <output data-testid="ort">{location.pathname + location.search}</output>;
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <Where />
    </MemoryRouter>,
  );
}

test("Allgemein: Klassen- und Levelverteilung ohne Ehemalige, Gildenfilter", async () => {
  mockFetch({ "/api/guild": guild });
  renderAt("/statistik");
  expect(await screen.findByText("Klassenverteilung")).toBeTruthy();
  expect(screen.getByRole("tab", { name: "Allgemein" }).getAttribute("aria-selected")).toBe("true");
  const levels = screen.getByRole("list", { name: "Mitglieder je Levelstufe" });
  const counts = within(levels).getAllByRole("button").map((b) => b.getAttribute("aria-label"));
  expect(counts).toEqual([
    "Level 1 bis 9: 0 Mitglieder", "Level 10 bis 19: 1 Mitglied", "Level 20 bis 29: 0 Mitglieder", "Level 30 bis 39: 0 Mitglieder",
    "Level 40 bis 49: 0 Mitglieder", "Level 50 bis 59: 0 Mitglieder", "Level 60: 1 Mitglied",
  ]);
  fireEvent.click(screen.getByRole("radio", { name: "Goldene Bärenklaue" }));
  const classes = document.querySelector(".class-bars")!;
  expect(classes.textContent).toContain("Krieger");
  expect(classes.textContent).not.toContain("Priester");
});

test("Allgemein: Klick auf eine Klasse filtert die Levelverteilung, nochmal Klick oder Entfernen in der Auswahl setzt zurück", async () => {
  mockFetch({ "/api/guild": guild });
  renderAt("/statistik");
  await screen.findByText("Klassenverteilung");
  const krieger = within(screen.getByRole("list", { name: "Mitglieder je Klasse" })).getByRole("button", { name: /Krieger/ });
  const levels = () => within(screen.getByRole("list", { name: "Mitglieder je Levelstufe" })).getAllByRole("button").map((b) => b.getAttribute("aria-label"));
  expect(levels()).toContain("Level 60: 1 Mitglied");
  fireEvent.click(krieger);
  expect(krieger.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getAllByText("Nur Krieger.")).toHaveLength(2);
  expect(levels()).toContain("Level 60: 0 Mitglieder");
  expect(levels()).toContain("Level 10 bis 19: 1 Mitglied");
  fireEvent.click(screen.getByRole("button", { name: "Krieger entfernen" }));
  expect(krieger.getAttribute("aria-pressed")).toBe("false");
  expect(levels()).toContain("Level 60: 1 Mitglied");
  fireEvent.click(krieger);
  fireEvent.click(krieger);
  expect(krieger.getAttribute("aria-pressed")).toBe("false");
  expect(screen.queryByRole("list", { name: "Auswahl" })).toBeNull();
});

test("Alte Adresse /aktivitaet landet im Reiter Aktivität", async () => {
  mockFetch({});
  renderAt("/aktivitaet");
  expect(screen.getByTestId("ort").textContent).toBe("/statistik/aktivitaet");
  expect(screen.getByRole("tab", { name: "Aktivität" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("link", { name: "Statistik" }).className).toContain("active");
});

test("Gildenstatistik: Kuriositäten-Wand mit verschiedenen Formen, Gildenfilter und Zeitraum", async () => {
  const horde: StatsView = { ...gesamt, guild: "bärenklaue" };
  const fetch = mockFetch({ "/api/stats": gesamt, "/api/stats/week": woche, [`/api/stats?guild=${encodeURIComponent("bärenklaue")}`]: horde });
  renderAt("/statistik/gilde");
  expect(await screen.findByRole("heading", { name: "Wer hat am häufigsten ins Gras gebissen?" })).toBeTruthy();
  expect(screen.getByText(/Gesamt seit dem Serverstart am 05\.11\.2026/).textContent).toMatch(/· 2 Charaktere$/);
  // Grabsteinfeld: Summe, je Ursache ein Stein, größte zuerst, Ehrung am Stein
  expect(screen.getByText("1.234 Tode")).toBeTruthy();
  const field = screen.getByRole("list", { name: "Tode insgesamt nach Ursache" });
  const stones = within(field).getAllByRole("listitem");
  expect(stones.map((s) => s.querySelector(".fun-gravestone-label")!.textContent)).toEqual(["Ertrinken", "Stürze", "Erschöpfung"]);
  expect(stones[1].textContent).toBe("34StürzeBleierne FederBodo");
  expect(stones[2].className).toContain("fun-gravestone-empty");
  expect(screen.getByText("Goldener Grabstein").closest(".stat-honor")?.textContent).toBe("Goldener Grabstein für Anna");
  // Piktogramm: 1 Fisch = 1.000 Fische, 17 volle und ein halber
  expect(screen.getByText("1 Fisch = 1.000 Fische")).toBeTruthy();
  expect(document.querySelectorAll(".fun-pictos .fun-picto")).toHaveLength(18);
  // Waage, Wusstest du, Fraktionsduell
  expect(screen.getByRole("img", { name: "Gewonnen 12, Verloren 8" })).toBeTruthy();
  expect(screen.getByText("196 Fässer")).toBeTruthy();
  expect(screen.getByText("19.572 Getränke, wenn ein Fass hundert Krüge hergibt.")).toBeTruthy();
  expect(screen.getByRole("list", { name: "Bärenklaue gegen Goldene Bärenklaue" })).toBeTruthy();
  expect(screen.getByText("Freundlicher war Bärenklaue: 21 gegen 14 Gesten.")).toBeTruthy();
  // Leere Karte lädt ein
  const leer = screen.getByRole("heading", { name: "Ach, das mache ich morgen" }).closest(".fun-card")!;
  expect(leer.className).toContain("fun-card-empty");
  expect(leer.textContent).toContain("Noch niemand. Wer traut sich?");
  expect(document.querySelector(".fun-card-grabsteinfeld")!.className).toContain("fun-card-span-3");
  // Formen wechseln sich ab
  expect(new Set([...document.querySelectorAll(".fun-card")].map((c) => c.className.split(" ")[1])).size).toBe(6);

  // Gildenfilter: Adresse und API mit Gilde, Emotes als Hitparade
  fireEvent.click(screen.getByRole("radio", { name: "Bärenklaue" }));
  expect(await screen.findByRole("list", { name: "Hitparade: Wir reden, wir winken, wir jubeln" })).toBeTruthy();
  expect(screen.getByTestId("ort").textContent).toBe(`/statistik/gilde?gilde=${encodeURIComponent("bärenklaue")}`);
  expect(fetch).toHaveBeenCalledWith(`/api/stats?guild=${encodeURIComponent("bärenklaue")}`, expect.anything());

  fireEvent.click(screen.getByRole("radio", { name: "Alle" }));
  fireEvent.click(await screen.findByRole("radio", { name: "Woche" }));
  expect(await screen.findByText(/fehlt noch der Stand der Vorwoche/)).toBeTruthy();
  expect(screen.getByText(/in der Woche bis zum 28\.11\. Bis dahin/)).toBeTruthy();
  expect(screen.getByTestId("ort").textContent).toBe("/statistik/gilde?zeitraum=woche");
  expect(screen.queryByText("1.234 Tode")).toBeNull();
});

test("Gildenstatistik: ein einzelner Charakter steht in der Einzahl", async () => {
  mockFetch({ "/api/stats": { ...gesamt, characters: 1 } });
  renderAt("/statistik/gilde");
  expect((await screen.findByText(/Gesamt seit dem Serverstart/)).textContent).toMatch(/· 1 Charakter$/);
});

test("Gildenstatistik: Woche aus der Adresse, Auswahl weiterer Wochen", async () => {
  const fetch = mockFetch({ "/api/stats/week/2026-11-14": { ...gesamt, kind: "woche", id: "2026-11-14", before: "2026-11-07" } });
  renderAt("/statistik/gilde?zeitraum=woche&woche=2026-11-14");
  const auswahl = (await screen.findByLabelText("Woche")) as HTMLSelectElement;
  expect([...auswahl.options].map((o) => o.textContent)).toEqual(["Woche vom 15.11. bis 21.11.", "Woche vom 08.11. bis 14.11."]);
  expect(auswahl.value).toBe("2026-11-14");
  expect(fetch).toHaveBeenCalledWith("/api/stats/week/2026-11-14", expect.anything());
});

test("Dungeons und Raids: Abenteuerkarte, Highlights, Raids und Gildenfilter", async () => {
  const dungeons: GuildDungeonsView = {
    available: true, guilds: guild.guilds, guild: null, characters: 3,
    dungeons: [
      { key: "flammenschlund", name: "Flammenschlund", tier: "Novize", image: "https://render.worldofwarcraft.com/eu/zones/ragefire-chasm-small.jpg", levels: { min: 13, max: 18 }, completed: 2, tracked: true, timesCompleted: 4, best: { character: ref(1, "Anna", 5), times: 3 }, lastAt: "2026-11-12T10:00:00.000Z", who: [[1, 3], [2, 1]] },
      { key: "maraudon", name: "Maraudon", tier: "Meister", image: null, levels: { min: 46, max: 55 }, completed: 0, tracked: true, timesCompleted: 0, best: null, lastAt: null, who: [] },
    ],
    raids: [{ name: "Onyxia", image: null, levels: { min: 60, max: 60 }, completed: 0, bosses: [{ name: "Onyxia", defeated: 0 }], who: [] }],
    frontier: { dungeon: "Flammenschlund", characters: [ref(1, "Anna", 5)] },
  };
  const fetch = mockFetch({ "/api/dungeons": dungeons, [`/api/dungeons?guild=${encodeURIComponent("goldene-bärenklaue")}`]: { ...dungeons, guild: "goldene-bärenklaue" } });
  renderAt("/statistik/dungeons");
  expect(await screen.findByRole("heading", { name: "Abenteuerkarte" })).toBeTruthy();
  expect(screen.getByRole("tab", { name: "Dungeons und Raids" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByText(/Am weitesten vorn/).textContent).toBe("Am weitesten vorn: Flammenschlund. Geschafft hat es Anna.");
  const stops = within(screen.getByRole("list", { name: "Dungeons nach Level" })).getAllByRole("listitem");
  expect(stops[0].textContent).toBe("FlammenschlundLevel 13 bis 182 durch, Alle ansehen");
  expect(stops[1].className).toContain("dungeon-fog");
  expect(stops[1].textContent).toContain("noch niemand");
  expect(stops[2].textContent).toContain("Raids");
  expect(screen.getByText("Lieblingsdungeon").closest("li")!.textContent).toContain("2 Charaktere durch");
  expect(screen.getByText("Nächstes Gildenziel").closest("li")!.textContent).toContain("Maraudon");
  expect(screen.getByText("Dauergast").closest("li")!.textContent).toContain("Anna3× Flammenschlund");
  expect(within(screen.getByRole("list", { name: "Bosse: Onyxia" })).getByText("Onyxia")).toBeTruthy();
  expect(screen.getByText("Noch niemand drin. Wer traut sich?")).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: "Goldene Bärenklaue" }));
  expect(await screen.findByTestId("ort")).toBeTruthy();
  expect(screen.getByTestId("ort").textContent).toBe(`/statistik/dungeons?gilde=${encodeURIComponent("goldene-bärenklaue")}`);
  expect(fetch).toHaveBeenCalledWith(`/api/dungeons?guild=${encodeURIComponent("goldene-bärenklaue")}`, expect.anything());
});

test("Dungeons ohne Statistik: kein Nebel, kein \"noch niemand\", kein Gildenziel", async () => {
  const dungeons: GuildDungeonsView = {
    available: true, guilds: guild.guilds, guild: null, characters: 3,
    dungeons: [
      { key: "todesminen", name: "Todesminen", tier: "Novize", image: null, levels: { min: 17, max: 26 }, completed: 1, tracked: true, timesCompleted: 1, best: { character: ref(1, "Anna", 5), times: 1 }, lastAt: null, who: [[1, 1]] },
      { key: "ausgrabungsstätte: sumpfland", name: "Ausgrabungsstätte: Sumpfland", tier: "Novize", image: null, levels: { min: 24, max: 29 }, completed: 0, tracked: false, timesCompleted: 0, best: null, lastAt: null, who: [] },
      { key: "maraudon", name: "Maraudon", tier: "Meister", image: null, levels: { min: 46, max: 55 }, completed: 0, tracked: true, timesCompleted: 0, best: null, lastAt: null, who: [] },
    ],
    raids: [],
    frontier: { dungeon: "Todesminen", characters: [ref(1, "Anna", 5)] },
  };
  mockFetch({ "/api/dungeons": dungeons });
  renderAt("/statistik/dungeons");
  await screen.findByRole("heading", { name: "Abenteuerkarte" });
  const stops = within(screen.getByRole("list", { name: "Dungeons nach Level" })).getAllByRole("listitem");
  expect(stops[1].className).not.toContain("dungeon-fog");
  expect(stops[1].className).toContain("dungeon-untracked");
  expect(stops[1].textContent).toContain("ohne Statistik");
  expect(stops[1].textContent).not.toContain("noch niemand");
  expect(stops[1].querySelector(".dungeon-stop-untracked")?.getAttribute("title")).toContain("nicht je Charakter");
  expect(screen.getByText("Nächstes Gildenziel").closest("li")!.textContent).toContain("Maraudon");
});

test("Allgemein: Mitglieder und Level 60 öffnen die Liste, Umschalter der Seite gilt, Escape schließt", async () => {
  mockFetch({ "/api/guild": guild });
  renderAt("/statistik");
  await screen.findByText("Klassenverteilung");
  fireEvent.click(screen.getByRole("radio", { name: "Bärenklaue" }));
  const trigger = screen.getByRole("button", { name: /Auf Level 60/ });
  expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog", { name: "Auf Level 60" });
  expect(within(dialog).getAllByRole("row").slice(1).map((r) => r.textContent)).toEqual([expect.stringContaining("Anna")]);
  expect(within(dialog).getByRole("radio", { name: "Bärenklaue" }).getAttribute("aria-checked")).toBe("true");
  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
  // Ehemalige stehen nicht in der Mitgliederliste; ohne jemanden auf Level 60 gibt es nichts zu klicken
  fireEvent.click(screen.getByRole("radio", { name: "Goldene Bärenklaue" }));
  expect(screen.queryByRole("button", { name: /Auf Level 60/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /^Mitglieder/ }));
  expect(within(screen.getByRole("dialog")).queryByText("Weg")).toBeNull();
});

test("Gildenstatistik: Karte mit Werten ist klickbar und lädt ihre Mitglieder erst dann", async () => {
  const [tode, ...rest] = gesamt.cards;
  const klickbar: StatsView = {
    ...gesamt,
    cards: [{ ...tode, stats: tode.stats.map((s, i) => ({ ...s, holders: i === 0 ? 2 : 0 })) }, ...rest],
  };
  const fetch = mockFetch({
    "/api/stats": klickbar,
    "/api/guild": guild,
    "/api/stats?card=tode": { slug: "tode", stats: [{ id: 60, entries: [[1, 1000], [2, 234]] }, { id: 114, entries: [[2, 34]] }] },
  });
  renderAt("/statistik/gilde");
  await screen.findByText("Wer hat am häufigsten ins Gras gebissen?");
  expect(fetch).not.toHaveBeenCalledWith("/api/stats?card=tode", expect.anything());
  // Leere Karte und Karten ohne Mitglieder bleiben, wie sie sind
  expect(screen.getAllByRole("button", { name: /^Alle .*ansehen: / })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Alle 2 ansehen: Wer hat am häufigsten ins Gras gebissen?" }));
  const dialog = await screen.findByRole("dialog", { name: "Wer hat am häufigsten ins Gras gebissen?" });
  expect(fetch).toHaveBeenCalledWith("/api/stats?card=tode", expect.anything());
  await within(dialog).findByRole("table");
  const rows = within(dialog).getAllByRole("row").slice(1);
  expect(rows.map((r) => r.querySelector("a")?.textContent)).toEqual(["Anna", "Bodo"]);
  expect(rows[0].textContent).toContain("1.000");
  fireEvent.change(within(dialog).getByRole("combobox", { name: "Wert" }), { target: { value: "114" } });
  expect(within(dialog).getAllByRole("row").slice(1).map((r) => r.querySelector("a")?.textContent)).toEqual(["Bodo"]);
  fireEvent.click(within(dialog).getByRole("button", { name: "Schließen" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("Aktivität und Dungeons: Charaktere, Dungeon-Station und Raid öffnen die Liste", async () => {
  const dungeons: GuildDungeonsView = {
    available: true, guilds: guild.guilds, guild: null, characters: 3,
    dungeons: [
      { key: "flammenschlund", name: "Flammenschlund", tier: "Novize", image: null, levels: { min: 13, max: 18 }, completed: 2, tracked: true, timesCompleted: 4, best: null, lastAt: null, who: [[1, 3], [2, 1]] },
      { key: "maraudon", name: "Maraudon", tier: "Meister", image: null, levels: { min: 46, max: 55 }, completed: 0, tracked: true, timesCompleted: 0, best: null, lastAt: null, who: [] },
    ],
    raids: [{ name: "Onyxia", image: null, levels: { min: 60, max: 60 }, completed: 0, bosses: [{ name: "Onyxia", defeated: 1 }], who: [[1, 1]] }],
    frontier: null,
  };
  mockFetch({ "/api/dungeons": dungeons, "/api/guild": guild });
  renderAt("/statistik/dungeons");
  await screen.findByRole("heading", { name: "Abenteuerkarte" });
  expect(screen.queryByRole("button", { name: /Maraudon/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /^Flammenschlund.*2 durch, Alle ansehen$/ }));
  let dialog = await screen.findByRole("dialog", { name: "Flammenschlund" });
  await within(dialog).findByRole("table");
  expect(within(dialog).getByRole("columnheader", { name: /Endboss-Siege/ })).toBeTruthy();
  expect(within(dialog).getAllByRole("row").slice(1).map((r) => r.querySelector("a")?.textContent)).toEqual(["Anna", "Bodo"]);
  // Die Antwort ist schon nach Gilde gefiltert: kein eigener Umschalter
  expect(within(dialog).queryByRole("radiogroup", { name: "Gilde" })).toBeNull();
  fireEvent.keyDown(dialog, { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "Alle 1 ansehen: Bosse besiegt, Onyxia" }));
  dialog = await screen.findByRole("dialog", { name: "Onyxia" });
  expect(await within(dialog).findByRole("columnheader", { name: /Bosse besiegt/ })).toBeTruthy();
});

test("Unbekannter Reiter zeigt die Fehlerseite", () => {
  mockFetch({});
  renderAt("/statistik/quatsch");
  expect(screen.queryByRole("tablist")).toBeNull();
});

function renderIn(sprache: Sprache, path: string) {
  render(
    <SpracheProvider start={sprache}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/statistik" element={<StatsPage />} />
          <Route path="/statistik/:reiter" element={<StatsPage />} />
        </Routes>
      </MemoryRouter>
    </SpracheProvider>,
  );
}

test("Gildenstatistik auf Schwäbisch: Karten, Bedienelemente und Hinweise in der schwäbischen Fassung", async () => {
  mockFetch({ "/api/stats": gesamt, "/api/stats/week": woche });
  renderIn("schwaebisch", "/statistik/gilde");
  expect(await screen.findByRole("heading", { name: "Wer hat am öftesten ins Gras bissa?" })).toBeTruthy();
  expect(screen.getByRole("tab", { name: "Gildestatistik" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByText(/Gsamt seit em Serverstart am 05\.11\.2026/)).toBeTruthy();
  expect(screen.getByText(/Des Kuriositätekabinett vo dr Gilde/)).toBeTruthy();
  expect(screen.getByText("Goldener Grabstoi").closest(".stat-honor")?.textContent).toBe("Goldener Grabstoi für Anna");
  expect(screen.getByText("Versaufa")).toBeTruthy();
  expect(screen.getByText("19.572 Getränke, wenn a Fass hundert Krüg hergibt.")).toBeTruthy();
  expect(screen.getByRole("img", { name: "Gwonne 12, Verlore 8" })).toBeTruthy();
  expect(screen.getByText("Freundlicher war Bärenklaue: 21 gege 14 Geschte.")).toBeTruthy();
  const leer = screen.getByRole("heading", { name: "Ach, des mach i morge" }).closest(".fun-card")!;
  expect(leer.textContent).toContain("No koiner. Wer traut sich?");
  // Amtliche Statistiknamen bleiben unverändert
  expect(screen.getByRole("list", { name: "Tode insgesamt nach Ursache" })).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: "Woch" }));
  expect(await screen.findByText(/Gemach, gemach: Für die Woch fehlt no dr Stand/)).toBeTruthy();
});

test("Gildenstatistik auf Bayrisch: eigene Fassungen für Karten und Hinweise", async () => {
  mockFetch({ "/api/stats": gesamt, "/api/stats/week": woche });
  renderIn("bayrisch", "/statistik/gilde");
  expect(await screen.findByRole("heading", { name: "Wer hod am öftan ins Gras bissn?" })).toBeTruthy();
  expect(screen.getByText(/Gsamt seit'm Serverstart am 05\.11\.2026/)).toBeTruthy();
  expect(screen.getByText("Goldener Grabstoa").closest(".stat-honor")?.textContent).toBe("Goldener Grabstoa fia Anna");
  expect(screen.getByText("196 Fassl")).toBeTruthy();
  expect(screen.getByText("19.572 Getränke, wenn a Fassl hundert Maß hergibt.")).toBeTruthy();
  expect(screen.getByText("Freindlicher war Bärenklaue: 21 gega 14 Gestn.")).toBeTruthy();
  expect(screen.getByText("Dasaufa")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Ach, des mach i morgn" }).closest(".fun-card")!.textContent).toContain("No koana. Wer traut si?");
  fireEvent.click(screen.getByRole("radio", { name: "Woch" }));
  expect(await screen.findByText(/Obacht, ned so gschwind/)).toBeTruthy();
});

test("Allgemein auf Schwäbisch und Bayrisch: Sprüche im Dialekt, Klassennamen amtlich", async () => {
  mockFetch({ "/api/guild": guild });
  renderIn("schwaebisch", "/statistik");
  expect(await screen.findByText("Wer schwingt was? Klick auf a Klass, no siehsch ihre Level ond Völker.")).toBeTruthy();
  expect(screen.getByRole("tab", { name: "Allgemei" })).toBeTruthy();
  expect(document.querySelector(".class-bars")!.textContent).toContain("Priester");
  expect(screen.getByText("Älle Mitglieder. Klick ins Diagramm, no wird gfiltert.")).toBeTruthy();
  cleanup();
  renderIn("bayrisch", "/statistik");
  expect(await screen.findByText("Wer schwingt wos? Klick auf a Klass, nacha siagst eana Level und Völker.")).toBeTruthy();
  expect(screen.getByText("Klassnverteilung")).toBeTruthy();
  fireEvent.click(within(screen.getByRole("list", { name: "Mitglieder je Klasse" })).getByRole("button", { name: /Priester/ }));
  expect(screen.getByRole("button", { name: "Priester weglassn" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Ois zruckstelln" })).toBeTruthy();
  expect(screen.getByRole("region", { name: "Kennzahln vo da Auswahl" })).toBeTruthy();
});

const neueKarten: StatsView = {
  ...gesamt,
  characters: 10,
  cards: [
    {
      slug: "ausreden", form: "zahl", title: f("Ach, das mache ich morgen", "Ach, des mach i morge", "Ach, des mach i morgn"), blurb: null, span: 1,
      stats: [
        entry({ id: 94, name: "Quests abgebrochen", total: 10, unit: paar("Quest", "Quests") }),
        entry({ id: 98, name: "Quests abgeschlossen", total: 140, unit: paar("Quest", "Quests") }),
      ],
    },
    {
      slug: "stall", form: "stall", title: f("Wer läuft noch zu Fuß?", "Wer lauft no z'Fuß?", "Wer geht no z'Fuaß?"), blurb: null, span: 1,
      stats: [
        entry({ id: 339, name: "Reittiere", art: "stand", total: 4, holders: 4 }),
        entry({ id: 338, name: "Haustiere", art: "stand", total: 3, holders: 2, sum: 5, unit: paar("Haustier", "Haustiere") }),
        entry({ id: 341, name: "Epische Gegenstände", total: 2, sum: 2, unit: paar("lila Teil", "lila Teile"), leaders: [{ character: ref(1, "Anna", 5), value: 2 }] }),
      ],
    },
    {
      slug: "schredder", form: "schredder", title: f("Kaputtgezaubert", "Kaputtgezaubert", "Hinzaubert"), blurb: null, span: 1,
      stats: [
        entry({ id: 181, name: "Entzauberte Gegenstände", total: 10, unit: paar("Gegenstand", "Gegenstände") }),
        entry({ id: 183, name: "Materialien", total: 25, unit: paar("Material", "Materialien") }),
      ],
    },
    {
      slug: "verband", form: "verband", title: f("Verbandsrolle", "Verbandsroll", "Verbandsrolln"), blurb: null, span: 1,
      stats: [
        entry({
          id: 344, name: "Verbände", total: 323, unit: paar("Verband", "Verbände"),
          conversion: { per: 80.75, unit: ueberall(["Ulmer Münster", "Ulmer Münster"] as [string, string]), text: f("aufgestapelt bis zur Turmspitze", "aufgstapelt bis zur Turmspitz", "aufgstaplt bis zur Turmspitzn") },
        }),
      ],
    },
  ],
};

test("Neue Karten auf Hochdeutsch: Papierkorb-Quote, Stall, Schredder und Verbandsrolle ohne Dialekt", async () => {
  mockFetch({ "/api/stats": neueKarten });
  renderIn("de", "/statistik/gilde");
  expect(await screen.findByText("Jede 14. Quest landet im Papierkorb.")).toBeTruthy();
  expect(screen.getByText("laufen zu Fuß")).toBeTruthy();
  expect(screen.getByText("hoch zu Ross")).toBeTruthy();
  // Stand: alle Haustiere zusammen (5), nicht der höchste Wert (3) und nicht die Besitzer (2)
  const seltenes = screen.getAllByText(/In der ganzen Gilde gerade einmal/).map((e) => e.textContent);
  expect(seltenes[0]).toMatch(/^In der ganzen Gilde gerade einmal 5 Haustiere/);
  expect(seltenes[1]).toMatch(/^In der ganzen Gilde gerade einmal 2 lila Teile/);
  expect(screen.getByText(/hinein/)).toBeTruthy();
  expect(screen.getByText("Im Schnitt 2,5 Materialien pro Teil.")).toBeTruthy();
  expect(screen.getByText(/aufgestapelt bis zur Turmspitze\./)).toBeTruthy();
});

test("Neue Karten auf Bayrisch", async () => {
  mockFetch({ "/api/stats": neueKarten });
  renderIn("bayrisch", "/statistik/gilde");
  expect(await screen.findByText("Jede 14. Quest landt im Papierkorb.")).toBeTruthy();
  expect(screen.getByText("genga z'Fuaß")).toBeTruthy();
  expect(screen.getAllByText(/In da ganzn Gilde grad amoi/)).toHaveLength(2);
  expect(screen.getByText(/ausse/)).toBeTruthy();
  expect(screen.getByText("Im Schnitt 2,5 Materialien pro Trumm.")).toBeTruthy();
  expect(screen.getByText(/aufgstaplt bis zur Turmspitzn\./)).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Hinzaubert" })).toBeTruthy();
});

test("Dungeons und Raids auf Schwäbisch und Bayrisch, Dungeon- und Bossnamen bleiben amtlich", async () => {
  const dungeons: GuildDungeonsView = {
    available: true, guilds: guild.guilds, guild: null, characters: 3,
    dungeons: [
      { key: "flammenschlund", name: "Flammenschlund", tier: "Novize", image: null, levels: { min: 13, max: 18 }, completed: 2, tracked: true, timesCompleted: 4, best: { character: ref(1, "Anna", 5), times: 3 }, lastAt: "2026-11-12T10:00:00.000Z", who: [[1, 3], [2, 1]] },
      { key: "maraudon", name: "Maraudon", tier: "Meister", image: null, levels: { min: 46, max: 55 }, completed: 0, tracked: true, timesCompleted: 0, best: null, lastAt: null, who: [] },
    ],
    raids: [{ name: "Onyxia", image: null, levels: { min: 60, max: 60 }, completed: 0, bosses: [{ name: "Onyxia", defeated: 0 }], who: [] }],
    frontier: { dungeon: "Flammenschlund", characters: [ref(1, "Anna", 5)] },
  };
  mockFetch({ "/api/dungeons": dungeons });
  renderIn("schwaebisch", "/statistik/dungeons");
  expect(await screen.findByRole("heading", { name: "Abenteuerkart" })).toBeTruthy();
  expect(screen.getByRole("tab", { name: "Dungeons ond Raids" })).toBeTruthy();
  expect(screen.getByText("Nächschtes Gildeziel").closest("li")!.textContent).toContain("Do war no koiner drin, Level 46 bis 55.");
  expect(screen.getByText("No koiner drin. Wer traut sich?")).toBeTruthy();
  cleanup();

  mockFetch({ "/api/dungeons": dungeons });
  renderIn("bayrisch", "/statistik/dungeons");
  expect(await screen.findByRole("heading", { name: "Abenteuerkartn" })).toBeTruthy();
  expect(screen.getByText(/Gschafft hod's/)).toBeTruthy();
  expect(screen.getByText("No koana drin. Wer traut si?")).toBeTruthy();
  expect(screen.getAllByText("Maraudon").length).toBeGreaterThan(0);
  cleanup();

  const drei = { ...dungeons, frontier: { dungeon: "Flammenschlund", characters: [ref(1, "Anna", 5), ref(2, "Bert", 5), ref(3, "Cora", 5)] } };
  mockFetch({ "/api/dungeons": drei });
  renderIn("de", "/statistik/dungeons");
  expect((await screen.findByText(/Am weitesten vorn/)).textContent).toBe(
    "Am weitesten vorn: Flammenschlund. Geschafft haben es Anna, Bert und Cora.",
  );
});

const voelker: GuildView = {
  ...guild,
  members: [
    member({ id: 1, name: "Grom", level: 60, classId: 1, className: "Krieger", raceId: 2, raceName: "Orc" }),
    member({ id: 2, name: "Zul", level: 15, classId: 1, className: "Krieger", raceId: 8, raceName: "Troll" }),
    member({ id: 3, name: "Mora", level: 60, classId: 5, className: "Priester", raceId: 2, raceName: "Orc" }),
    member({ id: 4, name: "Bodo", level: 12, classId: 1, className: "Krieger", raceId: 3, raceName: "Zwerg", guildSlug: "goldene-bärenklaue", guildName: "Goldene Bärenklaue" }),
    member({ id: 5, name: "Weg", level: 30, classId: 5, className: "Priester", raceId: 5, raceName: "Untoter", former: true }),
  ],
};

const legende = () =>
  within(screen.getByRole("table", { name: "Völkerverteilung" }))
    .getAllByRole("row")
    .slice(1)
    .map((r) => [...r.children].map((c) => c.textContent).join(" | "));

const saeule = (name: string) => within(screen.getByRole("list", { name: "Mitglieder je Levelstufe" })).getByRole("button", { name });
const klassenKnopf = (name: string) => within(screen.getByRole("list", { name: "Mitglieder je Klasse" })).getByRole("button", { name: new RegExp(name) });
const klassen = () =>
  within(screen.getByRole("list", { name: "Mitglieder je Klasse" }))
    .queryAllByRole("button")
    .map((b) => `${b.querySelector(".class-bar-label")!.textContent} ${b.querySelector(".class-bar-count")!.textContent}`);
const volkKnopf = (name: string) => within(screen.getByRole("table", { name: "Völkerverteilung" })).getByRole("button", { name });
const kachel = () => screen.getByRole("region", { name: /^Kennzahlen/ });

test("Allgemein: Völkertorte mit Anzahl und Prozent, gefiltert nach Klasse und Level, Gildenfilter, leerer Zustand", async () => {
  mockFetch({ "/api/guild": voelker });
  renderAt("/statistik");
  expect(await screen.findByRole("heading", { name: "Völkerverteilung" })).toBeTruthy();
  expect(legende()).toEqual(["Orc | 2 | 50 %", "Troll | 1 | 25 %", "Zwerg | 1 | 25 %"]);
  expect(screen.getByText("Orcs vorne. Lok'tar, und bitte die Hauer putzen.")).toBeTruthy();
  const torte = screen.getByRole("img", { name: /^Völker als Torte:/ });
  expect(torte.getAttribute("aria-label")).toBe("Völker als Torte: Orc 2 (50 %), Troll 1 (25 %), Zwerg 1 (25 %)");
  expect(torte.querySelectorAll("path")).toHaveLength(3);
  // Keine Auswahlfelder mehr an der Torte
  expect(within(screen.getByRole("heading", { name: "Völkerverteilung" }).closest(".panel") as HTMLElement).queryByRole("combobox")).toBeNull();

  // Klasse und Level aus den anderen Diagrammen kombiniert
  fireEvent.click(klassenKnopf("Krieger"));
  expect(legende()).toEqual(["Orc | 1 | 33 %", "Troll | 1 | 33 %", "Zwerg | 1 | 33 %"]);
  expect(screen.getByText(/^Gleichstand an der Spitze: Orc und Troll/)).toBeTruthy();
  fireEvent.click(saeule("Level 10 bis 19: 2 Mitglieder"));
  expect(legende()).toEqual(["Troll | 1 | 50 %", "Zwerg | 1 | 50 %"]);
  expect(screen.getByText("Nur Krieger · 10 bis 19.")).toBeTruthy();

  // Horde/Allianz-Umschalter gilt auch hier
  fireEvent.click(screen.getByRole("radio", { name: "Bärenklaue" }));
  expect(legende()).toEqual(["Troll | 1 | 100 %"]);
  expect(screen.getByRole("img", { name: /^Völker als Torte:/ }).querySelectorAll("path")).toHaveLength(1);

  // Keine Treffer: Level 30 bis 39
  fireEvent.click(saeule("Level 30 bis 39: 0 Mitglieder"));
  expect(screen.getByText("Niemand da. Selbst die Untoten sind heute im Grab geblieben.").getAttribute("role")).toBe("status");
  expect(screen.queryByRole("table", { name: "Völkerverteilung" })).toBeNull();
});

test("Allgemein: Volk wählen filtert Klassen und Level, hebt das Stück hervor, zweiter Klick hebt die Wahl auf", async () => {
  mockFetch({ "/api/guild": voelker });
  renderAt("/statistik");
  await screen.findByRole("heading", { name: "Völkerverteilung" });
  const orc = volkKnopf("Orc");
  expect(orc.getAttribute("aria-pressed")).toBe("false");
  expect(klassen()).toEqual(["Krieger 3", "Priester 1"]);

  fireEvent.click(orc);
  expect(volkKnopf("Orc").getAttribute("aria-pressed")).toBe("true");
  // Klassen und Level zeigen nur Orcs
  expect(klassen()).toEqual(["Krieger 1", "Priester 1"]);
  expect(saeule("Level 60: 2 Mitglieder")).toBeTruthy();
  expect(saeule("Level 10 bis 19: 0 Mitglieder")).toBeTruthy();
  expect(screen.getAllByText("Nur Orc.")).toHaveLength(2);
  // Die Torte bleibt vollständig, das Orc-Stück ist gewählt, die anderen gedimmt
  expect(legende()).toEqual(["Orc | 2 | 50 %", "Troll | 1 | 25 %", "Zwerg | 1 | 25 %"]);
  const stuecke = [...screen.getByRole("img", { name: /^Völker als Torte:/ }).querySelectorAll("path")];
  expect(stuecke.map((p) => [p.hasAttribute("data-selected"), p.hasAttribute("data-dim")])).toEqual([[true, false], [false, true], [false, true]]);

  // Klick auf ein anderes Tortenstück wechselt, ein zweiter Klick hebt die Wahl auf
  fireEvent.click(stuecke[1]);
  expect(volkKnopf("Troll").getAttribute("aria-pressed")).toBe("true");
  expect(klassen()).toEqual(["Krieger 1"]);
  fireEvent.click(screen.getByRole("img", { name: /^Völker als Torte:/ }).querySelectorAll("path")[1]);
  expect(volkKnopf("Troll").getAttribute("aria-pressed")).toBe("false");
  expect(klassen()).toEqual(["Krieger 3", "Priester 1"]);

  // Auch die ganze Legendenzeile ist klickbar
  fireEvent.click(volkKnopf("Zwerg").closest("tr")!.querySelector("td")!);
  expect(volkKnopf("Zwerg").getAttribute("aria-pressed")).toBe("true");
  expect(klassen()).toEqual(["Krieger 1"]);
});

test("Allgemein: Gewählte Einträge bleiben sichtbar und abwählbar, auch wenn andere Filter sie leeren", async () => {
  mockFetch({ "/api/guild": voelker });
  renderAt("/statistik");
  await screen.findByRole("heading", { name: "Völkerverteilung" });
  // Zwerg und Level 60: keine Treffer, Zwerg bleibt mit 0 in der Legende, die Klassen bekommen einen Spruch
  fireEvent.click(volkKnopf("Zwerg"));
  fireEvent.click(saeule("Level 60: 0 Mitglieder"));
  expect(legende()).toEqual(["Orc | 2 | 100 %", "Zwerg | 0 | 0 %"]);
  expect(volkKnopf("Zwerg").getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByText("Hier schwingt keiner was. Diese Mischung gibt es noch nicht.").getAttribute("role")).toBe("status");
  expect(klassen()).toEqual([]);
  expect(within(kachel()).getByText("Mitglieder").closest(".figure")!.querySelector(".figure-value")!.textContent).toBe("0");
  expect(within(kachel()).queryByRole("button", { name: /^Mitglieder/ })).toBeNull();

  // Priester gewählt, dann zur Allianz-Gilde ohne Priester: die Klasse bleibt mit 0 stehen, Level bekommt einen Spruch
  fireEvent.click(screen.getByRole("button", { name: "Alles zurücksetzen" }));
  fireEvent.click(klassenKnopf("Priester"));
  fireEvent.click(screen.getByRole("radio", { name: "Goldene Bärenklaue" }));
  expect(klassen()).toEqual(["Krieger 1", "Priester 0"]);
  expect(klassenKnopf("Priester").getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByText("Leere Säulen. Für diese Auswahl hat noch niemand gelevelt.")).toBeTruthy();
  fireEvent.click(klassenKnopf("Priester"));
  expect(klassen()).toEqual(["Krieger 1"]);
});

test("Allgemein: Levelsäulen sind Teil der gemeinsamen Auswahl und filtern Klassen und Völker", async () => {
  mockFetch({ "/api/guild": voelker });
  renderAt("/statistik");
  const saeulen = () => within(screen.getByRole("list", { name: "Mitglieder je Levelstufe" })).getAllByRole("button");
  await screen.findByRole("heading", { name: "Völkerverteilung" });

  // Sieben Säulen, keine gedrückt; die höchste Säule liefert den Spruch (bei Gleichstand die höhere Stufe)
  expect(saeulen()).toHaveLength(7);
  expect(saeulen().every((b) => b.getAttribute("aria-pressed") === "false")).toBe(true);
  expect(screen.getByText("Die meisten stehen schon auf der Sechzig. Respekt vor so viel Sitzfleisch.")).toBeTruthy();

  // Klick auf eine Säule filtert Torte und Klassen
  fireEvent.click(saeule("Level 60: 2 Mitglieder"));
  expect(saeule("Level 60: 2 Mitglieder").getAttribute("aria-pressed")).toBe("true");
  expect(legende()).toEqual(["Orc | 2 | 100 %"]);
  expect(klassen()).toEqual(["Krieger 1", "Priester 1"]);

  // Andere Säule wechselt die Wahl, zweiter Klick auf dieselbe hebt sie auf
  fireEvent.click(saeule("Level 10 bis 19: 2 Mitglieder"));
  expect(saeule("Level 60: 2 Mitglieder").getAttribute("aria-pressed")).toBe("false");
  expect(klassen()).toEqual(["Krieger 2"]);
  fireEvent.click(saeule("Level 10 bis 19: 2 Mitglieder"));
  expect(saeulen().every((b) => b.getAttribute("aria-pressed") === "false")).toBe(true);
  expect(legende()).toEqual(["Orc | 2 | 50 %", "Troll | 1 | 25 %", "Zwerg | 1 | 25 %"]);

  // Mit gewählter Klasse zeigen die Säulen deren Level, die Levelwahl bleibt bestehen
  fireEvent.click(saeule("Level 60: 2 Mitglieder"));
  fireEvent.click(klassenKnopf("Krieger"));
  expect(saeule("Level 60: 1 Mitglied").getAttribute("aria-pressed")).toBe("true");
  expect(saeule("Level 10 bis 19: 2 Mitglieder").getAttribute("aria-pressed")).toBe("false");
  expect(legende()).toEqual(["Orc | 1 | 100 %"]);
  expect(screen.getByText("Die meisten tummeln sich bei Level 10 bis 19. Weiterleveln, die Sechzig wartet!")).toBeTruthy();
});

test("Allgemein: Auswahlzeile zeigt Volk, Klasse und Level, einzeln entfernbar, Alles zurücksetzen", async () => {
  mockFetch({ "/api/guild": voelker });
  renderAt("/statistik");
  await screen.findByRole("heading", { name: "Völkerverteilung" });
  expect(screen.getByText("Alle Mitglieder. Ein Klick in ein Diagramm filtert die anderen.")).toBeTruthy();

  fireEvent.click(volkKnopf("Orc"));
  fireEvent.click(klassenKnopf("Krieger"));
  fireEvent.click(saeule("Level 60: 1 Mitglied"));
  const auswahl = () => within(screen.getByRole("list", { name: "Auswahl" })).getAllByRole("button").map((b) => b.getAttribute("aria-label") ?? b.textContent);
  expect(auswahl()).toEqual(["Orc entfernen", "Krieger entfernen", "Level 60 entfernen", "Alles zurücksetzen"]);
  expect(within(screen.getByRole("list", { name: "Auswahl" })).getByRole("button", { name: "Orc entfernen" }).textContent).toBe("Orc");

  // Einzelnes Teil entfernen: nur diese Achse fällt weg
  fireEvent.click(screen.getByRole("button", { name: "Krieger entfernen" }));
  expect(auswahl()).toEqual(["Orc entfernen", "Level 60 entfernen", "Alles zurücksetzen"]);
  expect(klassenKnopf("Krieger").getAttribute("aria-pressed")).toBe("false");
  expect(klassen()).toEqual(["Krieger 1", "Priester 1"]);

  // Alles zurücksetzen
  fireEvent.click(screen.getByRole("button", { name: "Alles zurücksetzen" }));
  expect(screen.queryByRole("list", { name: "Auswahl" })).toBeNull();
  expect(volkKnopf("Orc").getAttribute("aria-pressed")).toBe("false");
  expect(saeule("Level 60: 2 Mitglieder").getAttribute("aria-pressed")).toBe("false");
  expect(klassen()).toEqual(["Krieger 3", "Priester 1"]);
});

test("Allgemein: Kennzahl-Kachel zeigt die Auswahl, Mitgliederliste gefiltert", async () => {
  mockFetch({ "/api/guild": voelker });
  renderAt("/statistik");
  await screen.findByRole("heading", { name: "Völkerverteilung" });
  const zahl = (label: string) => within(kachel()).getByText(label.replace("Durchschnittslevel", "Durchschnitts\u00adlevel")).closest(".figure")!.querySelector(".figure-value")!.textContent;
  expect(kachel().getAttribute("aria-label")).toBe("Kennzahlen");
  expect(kachel().hasAttribute("data-filtered")).toBe(false);
  expect([zahl("Mitglieder"), zahl("Durchschnittslevel"), zahl("Auf Level 60"), zahl("Klassen")]).toEqual(["4", "36,8", "2", "2"]);

  fireEvent.click(volkKnopf("Orc"));
  expect(kachel().getAttribute("aria-label")).toBe("Kennzahlen der Auswahl");
  expect(kachel().hasAttribute("data-filtered")).toBe(true);
  expect([zahl("Mitglieder"), zahl("Durchschnittslevel"), zahl("Auf Level 60"), zahl("Klassen")]).toEqual(["2", "60", "2", "2"]);

  fireEvent.click(klassenKnopf("Krieger"));
  expect([zahl("Mitglieder"), zahl("Klassen")]).toEqual(["1", "1"]);

  // Die Liste hinter "Mitglieder" zeigt die gefilterte Menge
  fireEvent.click(within(kachel()).getByRole("button", { name: /^Mitglieder/ }));
  const dialog = screen.getByRole("dialog", { name: "Mitglieder: Orc · Krieger" });
  expect(within(dialog).getAllByRole("row").slice(1).map((r) => r.textContent)).toEqual([expect.stringContaining("Grom")]);
  fireEvent.keyDown(dialog, { key: "Escape" });

  // Krieger auf 10 bis 19 über alle Gilden: Zul (Horde) und Bodo (Allianz); der Umschalter im Dialog filtert weiter
  fireEvent.click(screen.getByRole("button", { name: "Alles zurücksetzen" }));
  fireEvent.click(klassenKnopf("Krieger"));
  fireEvent.click(saeule("Level 10 bis 19: 2 Mitglieder"));
  expect(within(kachel()).queryByRole("button", { name: /Auf Level 60/ })).toBeNull();
  fireEvent.click(within(kachel()).getByRole("button", { name: /^Mitglieder/ }));
  const liste = screen.getByRole("dialog", { name: "Mitglieder: Krieger · 10 bis 19" });
  expect(within(liste).getAllByRole("row").slice(1).map((r) => r.textContent)).toEqual([expect.stringContaining("Bodo"), expect.stringContaining("Zul")]);
});

test("Allgemein: Levelsäulen sind Schalter, per Tastatur erreichbar", async () => {
  mockFetch({ "/api/guild": voelker });
  renderAt("/statistik");
  const sechzig = await screen.findByRole("button", { name: "Level 60: 2 Mitglieder" });
  expect(sechzig.tagName).toBe("BUTTON");
  expect(sechzig.getAttribute("type")).toBe("button");
  sechzig.focus();
  expect(document.activeElement).toBe(sechzig);
});

test("Levelverteilung auf Schwäbisch und Bayrisch", async () => {
  mockFetch({ "/api/guild": voelker });
  renderIn("schwaebisch", "/statistik");
  expect(await screen.findByText("Vom Frischling bis zur Sechzge. Klick auf a Säule, no siehsch d'Klasse ond Völker drzua.")).toBeTruthy();
  expect(screen.getByText("D'meischte send scho auf Sechzge. Respekt vor so viel Sitzfleisch.")).toBeTruthy();
  cleanup();
  renderIn("bayrisch", "/statistik");
  expect(await screen.findByText("Vom Frischling bis zur Sechzg. Klick auf a Säuln, nacha siagst de Klassn und Völker dazua.")).toBeTruthy();
  expect(screen.getByText("De meistn san scho auf Sechzg. Respekt vor so vui Sitzfleisch.")).toBeTruthy();
});

test("Völkertorte auf Schwäbisch und Bayrisch", async () => {
  mockFetch({ "/api/guild": voelker });
  renderIn("schwaebisch", "/statistik");
  expect(await screen.findByText("D'Orcs vorne. Lok'tar, ond butzet d'Hauer.")).toBeTruthy();
  expect(screen.getByText("Wer steckt in welchere Haut? Klick auf a Volk, no siehsch seine Klasse ond Level.")).toBeTruthy();
  fireEvent.click(volkKnopf("Orc"));
  expect(screen.getAllByText("Bloß Orc.")).toHaveLength(2);
  cleanup();
  renderIn("bayrisch", "/statistik");
  expect(await screen.findByText("De Orcs vorn. Lok'tar, und d'Hauer putzn, bittschön.")).toBeTruthy();
  expect(screen.getByText("Wer steckt in wos für a Haut? Klick auf a Volk, nacha siagst seine Klassn und Level.")).toBeTruthy();
});
