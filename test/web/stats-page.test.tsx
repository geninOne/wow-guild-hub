// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { GuildDungeonsView, GuildView, MemberRow, StatsView } from "../../src/api/types";
import { sameInAll, type Translations } from "../../src/language";
import App from "../../web/src/App";
import { LanguageProvider, type Language } from "../../web/src/lib/language";
import { StatsPage } from "../../web/src/pages/StatsPage";

beforeEach(() => {
  // jsdom reports "en-US"; without a remembered choice English would apply.
  vi.spyOn(navigator, "language", "get").mockReturnValue("de-DE");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

const f = (de: string, schwaebisch = de, bayrisch = de, en = de): Translations => ({ de, en, schwaebisch, bayrisch });
const pair = (singular: string, plural: string): Translations<[string, string]> => sameInAll([singular, plural]);

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

const allTime: StatsView = {
  kind: "gesamt", id: null, status: "ok", before: null, after: "2026-11-21", takenAt: "2026-11-21T09:00:00Z",
  serverStart: "2026-11-05", nachgeholt: false, characters: 2, weeks: ["2026-11-21", "2026-11-14"], months: ["2026-11"],
  guilds: guild.guilds, guild: null,
  cards: [
    {
      slug: "tode", form: "grabsteinfeld",
      title: f("Wer hat am häufigsten ins Gras gebissen?", "Wer hat am öftesten ins Gras bissa?", "Wer hod am öftan ins Gras bissn?"),
      blurb: f("Sterben gehört dazu.", "Sterbe ghört dazu.", "Sterbn ghört dazua."), span: 3,
      stats: [
        entry({ id: 60, name: "Tode insgesamt", total: 1234, short: f("Tode"), unit: pair("Tod", "Tode"), honor: f("Goldener Grabstein", "Goldener Grabstoi", "Goldener Grabstoa"), leaders: [{ character: ref(1, "Anna", 5), value: 1000 }, { character: ref(2, "Bodo", 1, "goldene-bärenklaue"), value: 234 }] }),
        entry({ id: 114, name: "Tode durch Stürze", total: 34, short: f("Stürze", "Stürz", "Stürz"), honor: f("Bleierne Feder"), leaders: [{ character: ref(2, "Bodo", 1, "goldene-bärenklaue"), value: 34 }] }),
        entry({ id: 112, name: "Tode durch Ertrinken", total: 200, short: f("Ertrinken", "Versaufa", "Dasaufa") }),
        entry({ id: 113, name: "Tode durch Erschöpfung", total: 0, short: f("Erschöpfung") }),
      ],
    },
    {
      slug: "fische", form: "piktogramm", title: f("Petri Heil!"), blurb: null, span: 1,
      stats: [entry({ id: 1518, name: "Gefangene Fische", total: 17812, unit: pair("Fisch", "Fische"), honor: f("Goldene Angel"), leaders: [{ character: ref(1, "Anna", 5), value: 17812 }] })],
    },
    {
      slug: "duelle", form: "waage", title: f("Mittagsduell vor dem Gasthaus", "Mittagsduell vorm Gasthaus", "Mittagsduell vorm Wirtshaus"), blurb: null, span: 1,
      stats: [entry({ id: 319, name: "Duelle gewonnen", total: 12, short: f("Gewonnen", "Gwonne", "Gwonna") }), entry({ id: 320, name: "Duelle verloren", total: 8, short: f("Verloren", "Verlore", "Valorn") })],
    },
    {
      slug: "vesper", form: "wusstest-du", title: f("Wusstest du?", "Hosch gwusst?", "Hosd des gwusst?"), blurb: null, span: 1,
      stats: [entry({ id: 346, name: "Getränke verbraucht", total: 19572, unit: pair("Getränk", "Getränke"), conversion: { per: 100, unit: { de: ["Fass", "Fässer"], en: ["barrel", "barrels"], schwaebisch: ["Fass", "Fässer"], bayrisch: ["Fassl", "Fassl"] }, text: f("wenn ein Fass hundert Krüge hergibt", "wenn a Fass hundert Krüg hergibt", "wenn a Fassl hundert Maß hergibt") } })],
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

const week: StatsView = { ...allTime, kind: "woche", id: "2026-11-21", status: "zu-wenig", weeks: ["2026-11-21"], cards: [] };

function mockFetch(routes: Record<string, unknown>) {
  const fn = vi.fn(async (path: string) => {
    const body = routes[path];
    return body === undefined
      ? new Response(JSON.stringify({ error: "Not found" }), { status: 404 })
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

test("General: class and level distribution without former members, guild filter", async () => {
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

test("General: clicking a class filters the level distribution, clicking again or removing it in the selection resets", async () => {
  mockFetch({ "/api/guild": guild });
  renderAt("/statistik");
  await screen.findByText("Klassenverteilung");
  const warrior = within(screen.getByRole("list", { name: "Mitglieder je Klasse" })).getByRole("button", { name: /Krieger/ });
  const levels = () => within(screen.getByRole("list", { name: "Mitglieder je Levelstufe" })).getAllByRole("button").map((b) => b.getAttribute("aria-label"));
  expect(levels()).toContain("Level 60: 1 Mitglied");
  fireEvent.click(warrior);
  expect(warrior.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getAllByText("Nur Krieger.")).toHaveLength(2);
  expect(levels()).toContain("Level 60: 0 Mitglieder");
  expect(levels()).toContain("Level 10 bis 19: 1 Mitglied");
  fireEvent.click(screen.getByRole("button", { name: "Krieger entfernen" }));
  expect(warrior.getAttribute("aria-pressed")).toBe("false");
  expect(levels()).toContain("Level 60: 1 Mitglied");
  fireEvent.click(warrior);
  fireEvent.click(warrior);
  expect(warrior.getAttribute("aria-pressed")).toBe("false");
  expect(screen.queryByRole("list", { name: "Auswahl" })).toBeNull();
});

test("old address /aktivitaet lands on the Activity tab", async () => {
  mockFetch({});
  renderAt("/aktivitaet");
  expect(screen.getByTestId("ort").textContent).toBe("/statistik/aktivitaet");
  expect(screen.getByRole("tab", { name: "Aktivität" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("link", { name: "Statistik" }).className).toContain("active");
});

test("guild stats: wall of curiosities with different forms, guild filter and period", async () => {
  const horde: StatsView = { ...allTime, guild: "bärenklaue" };
  const fetch = mockFetch({ "/api/stats": allTime, "/api/stats/week": week, [`/api/stats?guild=${encodeURIComponent("bärenklaue")}`]: horde });
  renderAt("/statistik/gilde");
  expect(await screen.findByRole("heading", { name: "Wer hat am häufigsten ins Gras gebissen?" })).toBeTruthy();
  expect(screen.getByText(/Gesamt seit dem Serverstart am 05\.11\.2026/).textContent).toMatch(/· 2 Charaktere$/);
  // Graveyard: total, one stone per cause, largest first, honor on the stone
  expect(screen.getByText("1.234 Tode")).toBeTruthy();
  const field = screen.getByRole("list", { name: "Tode insgesamt nach Ursache" });
  const stones = within(field).getAllByRole("listitem");
  expect(stones.map((s) => s.querySelector(".fun-gravestone-label")!.textContent)).toEqual(["Ertrinken", "Stürze", "Erschöpfung"]);
  expect(stones[1].textContent).toBe("34StürzeBleierne FederBodo");
  expect(stones[2].className).toContain("fun-gravestone-empty");
  expect(screen.getByText("Goldener Grabstein").closest(".stat-honor")?.textContent).toBe("Goldener Grabstein für Anna");
  // Pictogram: 1 Fisch = 1.000 Fische, 17 full and one half
  expect(screen.getByText("1 Fisch = 1.000 Fische")).toBeTruthy();
  expect(document.querySelectorAll(".fun-pictos .fun-picto")).toHaveLength(18);
  // Scale, did you know, faction duel
  expect(screen.getByRole("img", { name: "Gewonnen 12, Verloren 8" })).toBeTruthy();
  expect(screen.getByText("196 Fässer")).toBeTruthy();
  expect(screen.getByText("19.572 Getränke, wenn ein Fass hundert Krüge hergibt.")).toBeTruthy();
  expect(screen.getByRole("list", { name: "Bärenklaue gegen Goldene Bärenklaue" })).toBeTruthy();
  expect(screen.getByText("Freundlicher war Bärenklaue: 21 gegen 14 Gesten.")).toBeTruthy();
  // An empty card invites
  const emptyCard = screen.getByRole("heading", { name: "Ach, das mache ich morgen" }).closest(".fun-card")!;
  expect(emptyCard.className).toContain("fun-card-empty");
  expect(emptyCard.textContent).toContain("Noch niemand. Wer traut sich?");
  expect(document.querySelector(".fun-card-grabsteinfeld")!.className).toContain("fun-card-span-3");
  // Forms alternate
  expect(new Set([...document.querySelectorAll(".fun-card")].map((c) => c.className.split(" ")[1])).size).toBe(6);

  // Guild filter: address and API with guild, emotes as a chart
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

test("guild stats: a single character is in the singular", async () => {
  mockFetch({ "/api/stats": { ...allTime, characters: 1 } });
  renderAt("/statistik/gilde");
  expect((await screen.findByText(/Gesamt seit dem Serverstart/)).textContent).toMatch(/· 1 Charakter$/);
});

test("guild stats: week from the address, choice of further weeks", async () => {
  const fetch = mockFetch({ "/api/stats/week/2026-11-14": { ...allTime, kind: "woche", id: "2026-11-14", before: "2026-11-07" } });
  renderAt("/statistik/gilde?zeitraum=woche&woche=2026-11-14");
  const selection = (await screen.findByLabelText("Woche")) as HTMLSelectElement;
  expect([...selection.options].map((o) => o.textContent)).toEqual(["Woche vom 15.11. bis 21.11.", "Woche vom 08.11. bis 14.11."]);
  expect(selection.value).toBe("2026-11-14");
  expect(fetch).toHaveBeenCalledWith("/api/stats/week/2026-11-14", expect.anything());
});

test("dungeons and raids: adventure map, highlights, raids and guild filter", async () => {
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

test("dungeons without statistics: no fog, no \"noch niemand\", no guild goal", async () => {
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

test("General: members and level 60 open the list, the page switcher applies, Escape closes", async () => {
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
  // Former members are not in the member list; without anyone at level 60 there is nothing to click
  fireEvent.click(screen.getByRole("radio", { name: "Goldene Bärenklaue" }));
  expect(screen.queryByRole("button", { name: /Auf Level 60/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /^Mitglieder/ }));
  expect(within(screen.getByRole("dialog")).queryByText("Weg")).toBeNull();
});

test("guild stats: a card with values is clickable and loads its members only then", async () => {
  const [deaths, ...rest] = allTime.cards;
  const clickable: StatsView = {
    ...allTime,
    cards: [{ ...deaths, stats: deaths.stats.map((s, i) => ({ ...s, holders: i === 0 ? 2 : 0 })) }, ...rest],
  };
  const fetch = mockFetch({
    "/api/stats": clickable,
    "/api/guild": guild,
    "/api/stats?card=tode": { slug: "tode", stats: [{ id: 60, entries: [[1, 1000], [2, 234]] }, { id: 114, entries: [[2, 34]] }] },
  });
  renderAt("/statistik/gilde");
  await screen.findByText("Wer hat am häufigsten ins Gras gebissen?");
  expect(fetch).not.toHaveBeenCalledWith("/api/stats?card=tode", expect.anything());
  // The empty card and cards without members stay as they are
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

test("activity and dungeons: characters, dungeon stop and raid open the list", async () => {
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
  // The response is already filtered by guild: no switcher of its own
  expect(within(dialog).queryByRole("radiogroup", { name: "Gilde" })).toBeNull();
  fireEvent.keyDown(dialog, { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "Alle 1 ansehen: Bosse besiegt, Onyxia" }));
  dialog = await screen.findByRole("dialog", { name: "Onyxia" });
  expect(await within(dialog).findByRole("columnheader", { name: /Bosse besiegt/ })).toBeTruthy();
});

test("unknown tab shows the error page", () => {
  mockFetch({});
  renderAt("/statistik/quatsch");
  expect(screen.queryByRole("tablist")).toBeNull();
});

function renderIn(language: Language, path: string) {
  render(
    <LanguageProvider start={language}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/statistik" element={<StatsPage />} />
          <Route path="/statistik/:reiter" element={<StatsPage />} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );
}

test("guild stats in Swabian: cards, controls and hints in the Swabian version", async () => {
  mockFetch({ "/api/stats": allTime, "/api/stats/week": week });
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
  const emptyCard = screen.getByRole("heading", { name: "Ach, des mach i morge" }).closest(".fun-card")!;
  expect(emptyCard.textContent).toContain("No koiner. Wer traut sich?");
  // Official statistic names stay unchanged
  expect(screen.getByRole("list", { name: "Tode insgesamt nach Ursache" })).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: "Woch" }));
  expect(await screen.findByText(/Gemach, gemach: Für die Woch fehlt no dr Stand/)).toBeTruthy();
});

test("guild stats in Bavarian: own versions for cards and hints", async () => {
  mockFetch({ "/api/stats": allTime, "/api/stats/week": week });
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

test("General in Swabian and Bavarian: sayings in dialect, official class names", async () => {
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

const newCards: StatsView = {
  ...allTime,
  characters: 10,
  cards: [
    {
      slug: "ausreden", form: "zahl", title: f("Ach, das mache ich morgen", "Ach, des mach i morge", "Ach, des mach i morgn"), blurb: null, span: 1,
      stats: [
        entry({ id: 94, name: "Quests abgebrochen", total: 10, unit: pair("Quest", "Quests") }),
        entry({ id: 98, name: "Quests abgeschlossen", total: 140, unit: pair("Quest", "Quests") }),
      ],
    },
    {
      slug: "stall", form: "stall", title: f("Wer läuft noch zu Fuß?", "Wer lauft no z'Fuß?", "Wer geht no z'Fuaß?"), blurb: null, span: 1,
      stats: [
        entry({ id: 339, name: "Reittiere", art: "stand", total: 4, holders: 4 }),
        entry({ id: 338, name: "Haustiere", art: "stand", total: 3, holders: 2, sum: 5, unit: pair("Haustier", "Haustiere") }),
        entry({ id: 341, name: "Epische Gegenstände", total: 2, sum: 2, unit: pair("lila Teil", "lila Teile"), leaders: [{ character: ref(1, "Anna", 5), value: 2 }] }),
      ],
    },
    {
      slug: "schredder", form: "schredder", title: f("Kaputtgezaubert", "Kaputtgezaubert", "Hinzaubert"), blurb: null, span: 1,
      stats: [
        entry({ id: 181, name: "Entzauberte Gegenstände", total: 10, unit: pair("Gegenstand", "Gegenstände") }),
        entry({ id: 183, name: "Materialien", total: 25, unit: pair("Material", "Materialien") }),
      ],
    },
    {
      slug: "verband", form: "verband", title: f("Verbandsrolle", "Verbandsroll", "Verbandsrolln"), blurb: null, span: 1,
      stats: [
        entry({
          id: 344, name: "Verbände", total: 323, unit: pair("Verband", "Verbände"),
          conversion: { per: 80.75, unit: sameInAll(["Ulmer Münster", "Ulmer Münster"] as [string, string]), text: f("aufgestapelt bis zur Turmspitze", "aufgstapelt bis zur Turmspitz", "aufgstaplt bis zur Turmspitzn") },
        }),
      ],
    },
  ],
};

test("new cards in standard German: trash ratio, stable, shredder and bandage roll without dialect", async () => {
  mockFetch({ "/api/stats": newCards });
  renderIn("de", "/statistik/gilde");
  expect(await screen.findByText("Jede 14. Quest landet im Papierkorb.")).toBeTruthy();
  expect(screen.getByText("laufen zu Fuß")).toBeTruthy();
  expect(screen.getByText("hoch zu Ross")).toBeTruthy();
  // Snapshot count: all pets together (5), not the highest value (3) and not the owners (2)
  const rare = screen.getAllByText(/In der ganzen Gilde gerade einmal/).map((e) => e.textContent);
  expect(rare[0]).toMatch(/^In der ganzen Gilde gerade einmal 5 Haustiere/);
  expect(rare[1]).toMatch(/^In der ganzen Gilde gerade einmal 2 lila Teile/);
  expect(screen.getByText(/hinein/)).toBeTruthy();
  expect(screen.getByText("Im Schnitt 2,5 Materialien pro Teil.")).toBeTruthy();
  expect(screen.getByText(/aufgestapelt bis zur Turmspitze\./)).toBeTruthy();
});

test("new cards in Bavarian", async () => {
  mockFetch({ "/api/stats": newCards });
  renderIn("bayrisch", "/statistik/gilde");
  expect(await screen.findByText("Jede 14. Quest landt im Papierkorb.")).toBeTruthy();
  expect(screen.getByText("genga z'Fuaß")).toBeTruthy();
  expect(screen.getAllByText(/In da ganzn Gilde grad amoi/)).toHaveLength(2);
  expect(screen.getByText(/ausse/)).toBeTruthy();
  expect(screen.getByText("Im Schnitt 2,5 Materialien pro Trumm.")).toBeTruthy();
  expect(screen.getByText(/aufgstaplt bis zur Turmspitzn\./)).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Hinzaubert" })).toBeTruthy();
});

test("dungeons and raids in Swabian and Bavarian, dungeon and boss names stay official", async () => {
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

  const three = { ...dungeons, frontier: { dungeon: "Flammenschlund", characters: [ref(1, "Anna", 5), ref(2, "Bert", 5), ref(3, "Cora", 5)] } };
  mockFetch({ "/api/dungeons": three });
  renderIn("de", "/statistik/dungeons");
  expect((await screen.findByText(/Am weitesten vorn/)).textContent).toBe(
    "Am weitesten vorn: Flammenschlund. Geschafft haben es Anna, Bert und Cora.",
  );
});

const races: GuildView = {
  ...guild,
  members: [
    member({ id: 1, name: "Grom", level: 60, classId: 1, className: "Krieger", raceId: 2, raceName: "Orc" }),
    member({ id: 2, name: "Zul", level: 15, classId: 1, className: "Krieger", raceId: 8, raceName: "Troll" }),
    member({ id: 3, name: "Mora", level: 60, classId: 5, className: "Priester", raceId: 2, raceName: "Orc" }),
    member({ id: 4, name: "Bodo", level: 12, classId: 1, className: "Krieger", raceId: 3, raceName: "Zwerg", guildSlug: "goldene-bärenklaue", guildName: "Goldene Bärenklaue" }),
    member({ id: 5, name: "Weg", level: 30, classId: 5, className: "Priester", raceId: 5, raceName: "Untoter", former: true }),
  ],
};

const legend = () =>
  within(screen.getByRole("table", { name: "Völkerverteilung" }))
    .getAllByRole("row")
    .slice(1)
    .map((r) => [...r.children].map((c) => c.textContent).join(" | "));

const column = (name: string) => within(screen.getByRole("list", { name: "Mitglieder je Levelstufe" })).getByRole("button", { name });
const classButton = (name: string) => within(screen.getByRole("list", { name: "Mitglieder je Klasse" })).getByRole("button", { name: new RegExp(name) });
const classList = () =>
  within(screen.getByRole("list", { name: "Mitglieder je Klasse" }))
    .queryAllByRole("button")
    .map((b) => `${b.querySelector(".class-bar-label")!.textContent} ${b.querySelector(".class-bar-count")!.textContent}`);
const raceButton = (name: string) => within(screen.getByRole("table", { name: "Völkerverteilung" })).getByRole("button", { name });
const tile = () => screen.getByRole("region", { name: /^Kennzahlen/ });

test("General: race pie with count and percent, filtered by class and level, guild filter, empty state", async () => {
  mockFetch({ "/api/guild": races });
  renderAt("/statistik");
  expect(await screen.findByRole("heading", { name: "Völkerverteilung" })).toBeTruthy();
  expect(legend()).toEqual(["Orc | 2 | 50 %", "Troll | 1 | 25 %", "Zwerg | 1 | 25 %"]);
  expect(screen.getByText("Orcs vorne. Lok'tar, und bitte die Hauer putzen.")).toBeTruthy();
  const pieChart = screen.getByRole("img", { name: /^Völker als Torte:/ });
  expect(pieChart.getAttribute("aria-label")).toBe("Völker als Torte: Orc 2 (50 %), Troll 1 (25 %), Zwerg 1 (25 %)");
  expect(pieChart.querySelectorAll("path")).toHaveLength(3);
  // No more select fields on the pie
  expect(within(screen.getByRole("heading", { name: "Völkerverteilung" }).closest(".panel") as HTMLElement).queryByRole("combobox")).toBeNull();

  // Class and level from the other charts combined
  fireEvent.click(classButton("Krieger"));
  expect(legend()).toEqual(["Orc | 1 | 33 %", "Troll | 1 | 33 %", "Zwerg | 1 | 33 %"]);
  expect(screen.getByText(/^Gleichstand an der Spitze: Orc und Troll/)).toBeTruthy();
  fireEvent.click(column("Level 10 bis 19: 2 Mitglieder"));
  expect(legend()).toEqual(["Troll | 1 | 50 %", "Zwerg | 1 | 50 %"]);
  expect(screen.getByText("Nur Krieger · 10 bis 19.")).toBeTruthy();

  // The Horde/Alliance switcher applies here too
  fireEvent.click(screen.getByRole("radio", { name: "Bärenklaue" }));
  expect(legend()).toEqual(["Troll | 1 | 100 %"]);
  expect(screen.getByRole("img", { name: /^Völker als Torte:/ }).querySelectorAll("path")).toHaveLength(1);

  // No matches: level 30 to 39
  fireEvent.click(column("Level 30 bis 39: 0 Mitglieder"));
  expect(screen.getByText("Niemand da. Selbst die Untoten sind heute im Grab geblieben.").getAttribute("role")).toBe("status");
  expect(screen.queryByRole("table", { name: "Völkerverteilung" })).toBeNull();
});

test("General: selecting a race filters classes and levels, highlights the slice, a second click clears the selection", async () => {
  mockFetch({ "/api/guild": races });
  renderAt("/statistik");
  await screen.findByRole("heading", { name: "Völkerverteilung" });
  const orc = raceButton("Orc");
  expect(orc.getAttribute("aria-pressed")).toBe("false");
  expect(classList()).toEqual(["Krieger 3", "Priester 1"]);

  fireEvent.click(orc);
  expect(raceButton("Orc").getAttribute("aria-pressed")).toBe("true");
  // Classes and levels show only Orcs
  expect(classList()).toEqual(["Krieger 1", "Priester 1"]);
  expect(column("Level 60: 2 Mitglieder")).toBeTruthy();
  expect(column("Level 10 bis 19: 0 Mitglieder")).toBeTruthy();
  expect(screen.getAllByText("Nur Orc.")).toHaveLength(2);
  // The pie stays complete, the Orc slice is selected, the others dimmed
  expect(legend()).toEqual(["Orc | 2 | 50 %", "Troll | 1 | 25 %", "Zwerg | 1 | 25 %"]);
  const slices = [...screen.getByRole("img", { name: /^Völker als Torte:/ }).querySelectorAll("path")];
  expect(slices.map((p) => [p.hasAttribute("data-selected"), p.hasAttribute("data-dim")])).toEqual([[true, false], [false, true], [false, true]]);

  // Clicking another pie slice switches, a second click clears the selection
  fireEvent.click(slices[1]);
  expect(raceButton("Troll").getAttribute("aria-pressed")).toBe("true");
  expect(classList()).toEqual(["Krieger 1"]);
  fireEvent.click(screen.getByRole("img", { name: /^Völker als Torte:/ }).querySelectorAll("path")[1]);
  expect(raceButton("Troll").getAttribute("aria-pressed")).toBe("false");
  expect(classList()).toEqual(["Krieger 3", "Priester 1"]);

  // The whole legend row is clickable too
  fireEvent.click(raceButton("Zwerg").closest("tr")!.querySelector("td")!);
  expect(raceButton("Zwerg").getAttribute("aria-pressed")).toBe("true");
  expect(classList()).toEqual(["Krieger 1"]);
});

test("General: selected entries stay visible and deselectable, even when other filters empty them", async () => {
  mockFetch({ "/api/guild": races });
  renderAt("/statistik");
  await screen.findByRole("heading", { name: "Völkerverteilung" });
  // Zwerg and level 60: no matches, Zwerg stays in the legend with 0, the classes get a saying
  fireEvent.click(raceButton("Zwerg"));
  fireEvent.click(column("Level 60: 0 Mitglieder"));
  expect(legend()).toEqual(["Orc | 2 | 100 %", "Zwerg | 0 | 0 %"]);
  expect(raceButton("Zwerg").getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByText("Hier schwingt keiner was. Diese Mischung gibt es noch nicht.").getAttribute("role")).toBe("status");
  expect(classList()).toEqual([]);
  expect(within(tile()).getByText("Mitglieder").closest(".figure")!.querySelector(".figure-value")!.textContent).toBe("0");
  expect(within(tile()).queryByRole("button", { name: /^Mitglieder/ })).toBeNull();

  // Priester selected, then to the Alliance guild without priests: the class stays with 0, levels get a saying
  fireEvent.click(screen.getByRole("button", { name: "Alles zurücksetzen" }));
  fireEvent.click(classButton("Priester"));
  fireEvent.click(screen.getByRole("radio", { name: "Goldene Bärenklaue" }));
  expect(classList()).toEqual(["Krieger 1", "Priester 0"]);
  expect(classButton("Priester").getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByText("Leere Säulen. Für diese Auswahl hat noch niemand gelevelt.")).toBeTruthy();
  fireEvent.click(classButton("Priester"));
  expect(classList()).toEqual(["Krieger 1"]);
});

test("General: level columns are part of the shared selection and filter classes and races", async () => {
  mockFetch({ "/api/guild": races });
  renderAt("/statistik");
  const columns = () => within(screen.getByRole("list", { name: "Mitglieder je Levelstufe" })).getAllByRole("button");
  await screen.findByRole("heading", { name: "Völkerverteilung" });

  // Seven columns, none pressed; the highest column provides the saying (on a tie the higher range)
  expect(columns()).toHaveLength(7);
  expect(columns().every((b) => b.getAttribute("aria-pressed") === "false")).toBe(true);
  expect(screen.getByText("Die meisten stehen schon auf der Sechzig. Respekt vor so viel Sitzfleisch.")).toBeTruthy();

  // Clicking a column filters pie and classes
  fireEvent.click(column("Level 60: 2 Mitglieder"));
  expect(column("Level 60: 2 Mitglieder").getAttribute("aria-pressed")).toBe("true");
  expect(legend()).toEqual(["Orc | 2 | 100 %"]);
  expect(classList()).toEqual(["Krieger 1", "Priester 1"]);

  // Another column switches the selection, a second click on the same one clears it
  fireEvent.click(column("Level 10 bis 19: 2 Mitglieder"));
  expect(column("Level 60: 2 Mitglieder").getAttribute("aria-pressed")).toBe("false");
  expect(classList()).toEqual(["Krieger 2"]);
  fireEvent.click(column("Level 10 bis 19: 2 Mitglieder"));
  expect(columns().every((b) => b.getAttribute("aria-pressed") === "false")).toBe(true);
  expect(legend()).toEqual(["Orc | 2 | 50 %", "Troll | 1 | 25 %", "Zwerg | 1 | 25 %"]);

  // With a class selected the columns show its levels, the level selection persists
  fireEvent.click(column("Level 60: 2 Mitglieder"));
  fireEvent.click(classButton("Krieger"));
  expect(column("Level 60: 1 Mitglied").getAttribute("aria-pressed")).toBe("true");
  expect(column("Level 10 bis 19: 2 Mitglieder").getAttribute("aria-pressed")).toBe("false");
  expect(legend()).toEqual(["Orc | 1 | 100 %"]);
  expect(screen.getByText("Die meisten tummeln sich bei Level 10 bis 19. Weiterleveln, die Sechzig wartet!")).toBeTruthy();
});

test("General: selection row shows race, class and level, removable one by one, reset all", async () => {
  mockFetch({ "/api/guild": races });
  renderAt("/statistik");
  await screen.findByRole("heading", { name: "Völkerverteilung" });
  expect(screen.getByText("Alle Mitglieder. Ein Klick in ein Diagramm filtert die anderen.")).toBeTruthy();

  fireEvent.click(raceButton("Orc"));
  fireEvent.click(classButton("Krieger"));
  fireEvent.click(column("Level 60: 1 Mitglied"));
  const selection = () => within(screen.getByRole("list", { name: "Auswahl" })).getAllByRole("button").map((b) => b.getAttribute("aria-label") ?? b.textContent);
  expect(selection()).toEqual(["Orc entfernen", "Krieger entfernen", "Level 60 entfernen", "Alles zurücksetzen"]);
  expect(within(screen.getByRole("list", { name: "Auswahl" })).getByRole("button", { name: "Orc entfernen" }).textContent).toBe("Orc");

  // Remove a single part: only that axis is dropped
  fireEvent.click(screen.getByRole("button", { name: "Krieger entfernen" }));
  expect(selection()).toEqual(["Orc entfernen", "Level 60 entfernen", "Alles zurücksetzen"]);
  expect(classButton("Krieger").getAttribute("aria-pressed")).toBe("false");
  expect(classList()).toEqual(["Krieger 1", "Priester 1"]);

  // Reset all
  fireEvent.click(screen.getByRole("button", { name: "Alles zurücksetzen" }));
  expect(screen.queryByRole("list", { name: "Auswahl" })).toBeNull();
  expect(raceButton("Orc").getAttribute("aria-pressed")).toBe("false");
  expect(column("Level 60: 2 Mitglieder").getAttribute("aria-pressed")).toBe("false");
  expect(classList()).toEqual(["Krieger 3", "Priester 1"]);
});

test("General: key figure tile shows the selection, member list filtered", async () => {
  mockFetch({ "/api/guild": races });
  renderAt("/statistik");
  await screen.findByRole("heading", { name: "Völkerverteilung" });
  const figure = (label: string) => within(tile()).getByText(label.replace("Durchschnittslevel", "Durchschnitts\u00adlevel")).closest(".figure")!.querySelector(".figure-value")!.textContent;
  expect(tile().getAttribute("aria-label")).toBe("Kennzahlen");
  expect(tile().hasAttribute("data-filtered")).toBe(false);
  expect([figure("Mitglieder"), figure("Durchschnittslevel"), figure("Auf Level 60"), figure("Klassen")]).toEqual(["4", "36,8", "2", "2"]);

  fireEvent.click(raceButton("Orc"));
  expect(tile().getAttribute("aria-label")).toBe("Kennzahlen der Auswahl");
  expect(tile().hasAttribute("data-filtered")).toBe(true);
  expect([figure("Mitglieder"), figure("Durchschnittslevel"), figure("Auf Level 60"), figure("Klassen")]).toEqual(["2", "60", "2", "2"]);

  fireEvent.click(classButton("Krieger"));
  expect([figure("Mitglieder"), figure("Klassen")]).toEqual(["1", "1"]);

  // The list behind "Mitglieder" shows the filtered set
  fireEvent.click(within(tile()).getByRole("button", { name: /^Mitglieder/ }));
  const dialog = screen.getByRole("dialog", { name: "Mitglieder: Orc · Krieger" });
  expect(within(dialog).getAllByRole("row").slice(1).map((r) => r.textContent)).toEqual([expect.stringContaining("Grom")]);
  fireEvent.keyDown(dialog, { key: "Escape" });

  // Krieger at 10 to 19 across all guilds: Zul (Horde) and Bodo (Alliance); the switcher in the dialog filters further
  fireEvent.click(screen.getByRole("button", { name: "Alles zurücksetzen" }));
  fireEvent.click(classButton("Krieger"));
  fireEvent.click(column("Level 10 bis 19: 2 Mitglieder"));
  expect(within(tile()).queryByRole("button", { name: /Auf Level 60/ })).toBeNull();
  fireEvent.click(within(tile()).getByRole("button", { name: /^Mitglieder/ }));
  const list = screen.getByRole("dialog", { name: "Mitglieder: Krieger · 10 bis 19" });
  expect(within(list).getAllByRole("row").slice(1).map((r) => r.textContent)).toEqual([expect.stringContaining("Bodo"), expect.stringContaining("Zul")]);
});

test("General: level columns are buttons, reachable by keyboard", async () => {
  mockFetch({ "/api/guild": races });
  renderAt("/statistik");
  const sixty = await screen.findByRole("button", { name: "Level 60: 2 Mitglieder" });
  expect(sixty.tagName).toBe("BUTTON");
  expect(sixty.getAttribute("type")).toBe("button");
  sixty.focus();
  expect(document.activeElement).toBe(sixty);
});

test("level distribution in Swabian and Bavarian", async () => {
  mockFetch({ "/api/guild": races });
  renderIn("schwaebisch", "/statistik");
  expect(await screen.findByText("Vom Frischling bis zur Sechzge. Klick auf a Säule, no siehsch d'Klasse ond Völker drzua.")).toBeTruthy();
  expect(screen.getByText("D'meischte send scho auf Sechzge. Respekt vor so viel Sitzfleisch.")).toBeTruthy();
  cleanup();
  renderIn("bayrisch", "/statistik");
  expect(await screen.findByText("Vom Frischling bis zur Sechzg. Klick auf a Säuln, nacha siagst de Klassn und Völker dazua.")).toBeTruthy();
  expect(screen.getByText("De meistn san scho auf Sechzg. Respekt vor so vui Sitzfleisch.")).toBeTruthy();
});

test("race pie in Swabian and Bavarian", async () => {
  mockFetch({ "/api/guild": races });
  renderIn("schwaebisch", "/statistik");
  expect(await screen.findByText("D'Orcs vorne. Lok'tar, ond butzet d'Hauer.")).toBeTruthy();
  expect(screen.getByText("Wer steckt in welchere Haut? Klick auf a Volk, no siehsch seine Klasse ond Level.")).toBeTruthy();
  fireEvent.click(raceButton("Orc"));
  expect(screen.getAllByText("Bloß Orc.")).toHaveLength(2);
  cleanup();
  renderIn("bayrisch", "/statistik");
  expect(await screen.findByText("De Orcs vorn. Lok'tar, und d'Hauer putzn, bittschön.")).toBeTruthy();
  expect(screen.getByText("Wer steckt in wos für a Haut? Klick auf a Volk, nacha siagst seine Klassn und Level.")).toBeTruthy();
});
