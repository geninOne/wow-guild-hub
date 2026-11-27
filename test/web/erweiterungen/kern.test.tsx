// @vitest-environment jsdom
// Erweiterungspunkte der Oberfläche: ohne Module keine fremden Reiter und Seiten, mit einer Test-Erweiterung an allen Stellen.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { CharacterView } from "../../../src/api/types";
import type { CharacterRecord } from "../../../src/model";
import App from "../../../web/src/App";
import type { CharakterDatenProps, OberflaechenErweiterung } from "../../../web/src/erweiterungen/typen";
import { SPRACH_SCHLUESSEL } from "../../../web/src/lib/sprache";
import { CharacterPage } from "../../../web/src/pages/CharacterPage";
import { PrivacyPage } from "../../../web/src/pages/PrivacyPage";

const registry = vi.hoisted(() => ({ liste: [] as OberflaechenErweiterung[] }));
vi.mock("../../../web/src/erweiterungen", () => ({
  get OBERFLAECHEN_ERWEITERUNGEN() {
    return registry.liste;
  },
}));

const stimmen = (d: unknown) => (d as { stimmen: number } | undefined)?.stimmen;

const testErweiterung: OberflaechenErweiterung = {
  id: "umfragen",
  statistikReiter: [
    {
      id: "umfragen",
      label: { de: "Umfragen", en: "Polls" },
      Komponente: ({ guild, onGuild }) => (
        <button type="button" onClick={() => onGuild("andere")}>
          Umfragen für {guild ?? "alle"}
        </button>
      ),
    },
  ],
  charakterReiter: [
    {
      id: "umfragen",
      label: { de: "Abstimmungen", en: "Votes" },
      Komponente: ({ daten }: CharakterDatenProps) => <p>{daten === undefined ? "Noch nichts abgestimmt" : `${stimmen(daten)} Stimmen`}</p>,
    },
  ],
  charakterKopf: ({ daten }: CharakterDatenProps) => <span className="badge">Wähler {stimmen(daten)}</span>,
  routen: [{ pfad: "/umfragen", Komponente: () => <h1>Alle Umfragen</h1> }],
  datenschutz: () => <h2>Umfragen der Gilde</h2>,
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

function renderCharakter(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/charakter/:key" element={<CharacterPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  window.localStorage.setItem(SPRACH_SCHLUESSEL, "de");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  registry.liste = [];
});

describe("ohne Erweiterungen", () => {
  test("Statistik nur mit den eigenen Reitern, fremde Reiter und Seiten gibt es nicht", async () => {
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

  test("Charakterseite nur mit den eigenen Reitern, ohne Abzeichen; unbekannte Reiter zeigen die Ausrüstung", async () => {
    mockFetch(view({ erweiterungen: { umfragen: { stimmen: 3 } } }));
    renderCharakter("/charakter/gelmar-soulvenn?reiter=umfragen");
    await screen.findByRole("heading", { level: 1, name: "Gelmar Soulvenn" });
    const tabs = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(tabs.at(-1)).toBe("Rückblick");
    expect(screen.getByRole("tab", { name: "Ausrüstung" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByText(/Wähler/)).toBeNull();
  });

  test("Datenschutz ohne zusätzliche Abschnitte", () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    );
    const titel = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(titel).toContain("Links zu anderen Seiten");
    expect(titel.some((t) => /Erfolge|Umfragen/.test(t ?? ""))).toBe(false);
  });
});

describe("mit Test-Erweiterung", () => {
  beforeEach(() => {
    registry.liste = [testErweiterung];
  });

  test("Statistik-Reiter hinter den eigenen, bekommt die Gilde und kann sie ändern", async () => {
    mockFetch({});
    renderApp("/statistik/umfragen?gilde=eine");
    const knopf = await screen.findByRole("button", { name: "Umfragen für eine" });
    const tabs = screen.getAllByRole("tab");
    expect(tabs.at(-1)!.textContent).toBe("Umfragen");
    expect(tabs.at(-1)!.getAttribute("aria-selected")).toBe("true");
    fireEvent.click(knopf);
    expect(await screen.findByRole("button", { name: "Umfragen für andere" })).toBeTruthy();
  });

  test("eigene Route", async () => {
    mockFetch({});
    renderApp("/umfragen");
    expect(await screen.findByRole("heading", { name: "Alle Umfragen" })).toBeTruthy();
  });

  test("Charakter: Reiter ganz rechts mit den Zusatzdaten, Abzeichen in der Kopfzeile", async () => {
    mockFetch(view({ erweiterungen: { umfragen: { stimmen: 3 } } }));
    renderCharakter("/charakter/gelmar-soulvenn");
    await screen.findByRole("heading", { level: 1, name: "Gelmar Soulvenn" });
    expect(screen.getByText("Wähler 3")).toBeTruthy();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.at(-1)!.textContent).toBe("Abstimmungen");
    fireEvent.click(tabs.at(-1)!);
    expect(await screen.findByText("3 Stimmen")).toBeTruthy();
  });

  test("Charakter ohne Zusatzdaten: Reiter mit Hinweis, kein Abzeichen", async () => {
    mockFetch(view());
    renderCharakter("/charakter/gelmar-soulvenn?reiter=umfragen");
    expect(await screen.findByText("Noch nichts abgestimmt")).toBeTruthy();
    expect(screen.queryByText(/Wähler/)).toBeNull();
  });

  test("Charakter ohne Profil: keine Reiter, der Inhalt steht unter dem Hinweis, aber nur mit Daten", async () => {
    mockFetch(view({ erweiterungen: { umfragen: { stimmen: 5 } } }, { hasProfile: false }));
    renderCharakter("/charakter/gelmar-soulvenn");
    expect(await screen.findByText("5 Stimmen")).toBeTruthy();
    expect(screen.queryByRole("tablist")).toBeNull();
    cleanup();
    mockFetch(view({}, { hasProfile: false }));
    renderCharakter("/charakter/gelmar-soulvenn");
    await screen.findByRole("heading", { level: 1, name: "Gelmar Soulvenn" });
    expect(screen.queryByText("Noch nichts abgestimmt")).toBeNull();
  });

  test("Datenschutz-Abschnitt vor den Links zu anderen Seiten", () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    );
    const titel = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(titel.indexOf("Umfragen der Gilde")).toBe(titel.indexOf("Links zu anderen Seiten") - 1);
  });
});
