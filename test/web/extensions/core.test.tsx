// @vitest-environment jsdom
// Extension points of the interface: without modules no foreign tabs and pages, with a test extension at every point.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { CharacterView } from "../../../src/api/types";
import type { CharacterRecord } from "../../../src/model";
import App from "../../../web/src/App";
import type { CharakterDatenProps, OberflaechenErweiterung } from "../../../web/src/erweiterungen/typen";
import type { CharacterDataProps, UiExtension } from "../../../web/src/extensions/types";
import { LANGUAGE_STORAGE_KEY, LanguageProvider, useLanguage } from "../../../web/src/lib/language";
import { CharacterPage } from "../../../web/src/pages/CharacterPage";
import { PrivacyPage } from "../../../web/src/pages/PrivacyPage";

const registry = vi.hoisted(() => ({ list: [] as UiExtension[], legacy: [] as OberflaechenErweiterung[] }));
vi.mock("../../../web/src/extensions", () => ({
  get UI_EXTENSIONS() {
    return registry.list;
  },
}));
vi.mock("../../../web/src/erweiterungen", () => ({
  get OBERFLAECHEN_ERWEITERUNGEN() {
    return registry.legacy;
  },
}));

const votes = (d: unknown) => (d as { stimmen: number } | undefined)?.stimmen;

const testExtension: UiExtension = {
  id: "umfragen",
  statsTabs: [
    {
      id: "umfragen",
      label: { de: "Umfragen", en: "Polls" },
      Component: ({ guild, onGuild }) => (
        <button type="button" onClick={() => onGuild("andere")}>
          Umfragen für {guild ?? "alle"}
        </button>
      ),
    },
  ],
  characterTabs: [
    {
      id: "umfragen",
      label: { de: "Abstimmungen", en: "Votes" },
      Component: ({ data }: CharacterDataProps) => <p>{data === undefined ? "Noch nichts abgestimmt" : `${votes(data)} Stimmen`}</p>,
    },
  ],
  characterHeader: ({ data }: CharacterDataProps) => <span className="badge">Wähler {votes(data)}</span>,
  routes: [{ path: "/umfragen", Component: () => <h1>Alle Umfragen</h1> }],
  privacy: () => <h2>Umfragen der Gilde</h2>,
};

const gelmar = JSON.parse(readFileSync(resolve(process.cwd(), "test/fixtures/records/character-1647409.json"), "utf8")) as CharacterRecord;

function view(over: Partial<CharacterView> = {}, character: Partial<CharacterRecord> = {}): CharacterView {
  return {
    character: { ...gelmar, ...character },
    className: "Priester", raceName: "Untoter", guildName: "Gilde", guildFaction: "HORDE", rank: 3, rankName: "Rang 3", former: false,
    itemIcons: {}, instances: { available: false, dungeonTiers: [], raids: [], otherKills: [] }, reputation: { available: false, groups: [] },
    recipes: {}, ...over,
  };
}

function mockFetch(body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })));
}

function renderApp(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <App />
    </MemoryRouter>,
  );
}

function characterTree(url: string) {
  return (
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/charakter/:key" element={<CharacterPage />} />
      </Routes>
    </MemoryRouter>
  );
}

function renderCharacter(url: string) {
  return render(characterTree(url));
}

beforeEach(() => {
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "de");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  registry.list = [];
  registry.legacy = [];
});

describe("without extensions", () => {
  test("stats only with the core's tabs, foreign tabs and pages do not exist", async () => {
    mockFetch({});
    renderApp("/statistik/umfragen");
    expect(await screen.findByRole("heading", { name: "Seite nicht gefunden" })).toBeTruthy();
    cleanup();
    renderApp("/statistik/erfolge");
    expect(await screen.findByRole("heading", { name: "Seite nicht gefunden" })).toBeTruthy();
    cleanup();
    renderApp("/erfolge/upload");
    expect(await screen.findByRole("heading", { name: "Seite nicht gefunden" })).toBeTruthy();
  });

  test("character page only with the core's tabs, without badge; unknown tabs show the equipment", async () => {
    mockFetch(view({ extensions: { umfragen: { stimmen: 3 } } }));
    renderCharacter("/charakter/gelmar-soulvenn?reiter=umfragen");
    await screen.findByRole("heading", { level: 1, name: "Gelmar Soulvenn" });
    const tabs = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(tabs.at(-1)).toBe("Rückblick");
    expect(screen.getByRole("tab", { name: "Ausrüstung" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByText(/Wähler/)).toBeNull();
  });

  test("privacy policy without extra sections", () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    );
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toContain("Links zu anderen Seiten");
    expect(headings.some((t) => /Erfolge|Umfragen/.test(t ?? ""))).toBe(false);
  });
});

describe("with test extension", () => {
  beforeEach(() => {
    registry.list = [testExtension];
  });

  test("stats tab after the core's own, gets the guild and can change it", async () => {
    mockFetch({});
    renderApp("/statistik/umfragen?gilde=eine");
    const button = await screen.findByRole("button", { name: "Umfragen für eine" });
    const tabs = screen.getAllByRole("tab");
    expect(tabs.at(-1)!.textContent).toBe("Umfragen");
    expect(tabs.at(-1)!.getAttribute("aria-selected")).toBe("true");
    fireEvent.click(button);
    expect(await screen.findByRole("button", { name: "Umfragen für andere" })).toBeTruthy();
  });

  test("own route", async () => {
    mockFetch({});
    renderApp("/umfragen");
    expect(await screen.findByRole("heading", { name: "Alle Umfragen" })).toBeTruthy();
  });

  test("character: tab on the far right with the extra data, badge in the header", async () => {
    mockFetch(view({ extensions: { umfragen: { stimmen: 3 } } }));
    renderCharacter("/charakter/gelmar-soulvenn");
    await screen.findByRole("heading", { level: 1, name: "Gelmar Soulvenn" });
    expect(screen.getByText("Wähler 3")).toBeTruthy();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.at(-1)!.textContent).toBe("Abstimmungen");
    fireEvent.click(tabs.at(-1)!);
    expect(await screen.findByText("3 Stimmen")).toBeTruthy();
  });

  test("character without extra data: tab with a notice, no badge", async () => {
    mockFetch(view());
    renderCharacter("/charakter/gelmar-soulvenn?reiter=umfragen");
    expect(await screen.findByText("Noch nichts abgestimmt")).toBeTruthy();
    expect(screen.queryByText(/Wähler/)).toBeNull();
  });

  test("character without profile: no tabs, the content is below the notice, but only with data", async () => {
    mockFetch(view({ extensions: { umfragen: { stimmen: 5 } } }, { hasProfile: false }));
    renderCharacter("/charakter/gelmar-soulvenn");
    expect(await screen.findByText("5 Stimmen")).toBeTruthy();
    expect(screen.queryByRole("tablist")).toBeNull();
    cleanup();
    mockFetch(view({}, { hasProfile: false }));
    renderCharacter("/charakter/gelmar-soulvenn");
    await screen.findByRole("heading", { level: 1, name: "Gelmar Soulvenn" });
    expect(screen.queryByText("Noch nichts abgestimmt")).toBeNull();
  });

  test("privacy section before the links to other sites", () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    );
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings.indexOf("Umfragen der Gilde")).toBe(headings.indexOf("Links zu anderen Seiten") - 1);
  });
});

/** A module in the 2.x shape (German member names, `daten` prop), as registered in web/src/erweiterungen/index.ts. */
const legacyExtension: OberflaechenErweiterung = {
  id: "raetsel",
  charakterReiter: [
    {
      id: "raetsel",
      label: { de: "Rätsel", en: "Puzzles" },
      Komponente: ({ daten }: CharakterDatenProps) => <p>{`${(daten as { geloest: number } | undefined)?.geloest ?? 0} gelöst`}</p>,
    },
  ],
};

/** A stateful 2.x tab: its counter survives only if the core wraps the component once, not on every render. */
function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button type="button" onClick={() => setCount((c) => c + 1)}>
      Zähler {count}
    </button>
  );
}

const statefulLegacyExtension: OberflaechenErweiterung = {
  id: "zaehler",
  charakterReiter: [{ id: "zaehler", label: { de: "Zähler", en: "Counter" }, Komponente: Counter }],
};

function LanguageSwitch() {
  const { setLanguage } = useLanguage();
  return (
    <button type="button" onClick={() => setLanguage("en")}>
      English
    </button>
  );
}

describe("registry mix of 3.0 and 2.x modules", () => {
  test("a 2.x module and a 3.0 module both show their character tabs", async () => {
    registry.list = [testExtension];
    registry.legacy = [legacyExtension];
    mockFetch(view({ extensions: { umfragen: { stimmen: 3 }, raetsel: { geloest: 7 } } }));
    renderCharacter("/charakter/gelmar-soulvenn");
    await screen.findByRole("heading", { level: 1, name: "Gelmar Soulvenn" });
    const tabs = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(tabs.slice(-2)).toEqual(["Abstimmungen", "Rätsel"]);
    fireEvent.click(screen.getByRole("tab", { name: "Abstimmungen" }));
    expect(await screen.findByText("3 Stimmen")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Rätsel" }));
    expect(await screen.findByText("7 gelöst")).toBeTruthy();
  });

  test("a stateful 2.x tab keeps its state when the page re-renders", async () => {
    registry.legacy = [statefulLegacyExtension];
    mockFetch(view());
    const url = "/charakter/gelmar-soulvenn?reiter=zaehler";
    const tree = () => (
      <LanguageProvider start="de">
        <LanguageSwitch />
        {characterTree(url)}
      </LanguageProvider>
    );
    const { rerender } = render(tree());
    fireEvent.click(await screen.findByRole("button", { name: "Zähler 0" }));
    fireEvent.click(screen.getByRole("button", { name: "Zähler 1" }));
    expect(screen.getByRole("button", { name: "Zähler 2" })).toBeTruthy();
    // Re-render with the same props.
    rerender(tree());
    expect(screen.getByRole("button", { name: "Zähler 2" })).toBeTruthy();
    // Language switch: every page component renders again.
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(await screen.findByRole("tab", { name: "Counter" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Zähler 2" })).toBeTruthy();
  });
});
