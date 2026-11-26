// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "../../web/src/App";
import { angeboteneSprachen, gemerkteSprache, SPRACH_SCHLUESSEL, spracheMerken } from "../../web/src/lib/sprache";
import { ausKonfig, istSprache } from "../../src/sprache";

/** Sprache des Browsers; jsdom meldet sonst "en-US". */
function browserSprache(sprache: string) {
  vi.spyOn(navigator, "language", "get").mockReturnValue(sprache);
}

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  browserSprache("de-DE");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  window.localStorage.clear();
});

/** Alle vier Sprachen angeboten, wie auf einer Installation mit Dialekten. */
function mitDialekten() {
  vi.stubEnv("WEBSITE_LANGUAGES", "de,schwaebisch,bayrisch,en");
}

function seite() {
  return render(
    <MemoryRouter initialEntries={["/impressum"]}>
      <App />
    </MemoryRouter>,
  );
}

const umschalter = (name = "Sprache") => screen.getByRole("combobox", { name }) as HTMLSelectElement;

test("Standard ist Deutsch, der Umschalter bietet ohne Angabe Deutsch und Englisch", () => {
  seite();
  expect(umschalter().value).toBe("de");
  expect([...umschalter().options].map((o) => o.textContent)).toEqual(["Deutsch", "English"]);
  expect(umschalter().closest("header")).toBeTruthy();
  expect(screen.getByText(/^Daten aus der Blizzard-API, stündlich aktualisiert/)).toBeTruthy();
});

test("Mit WEBSITE_LANGUAGES bietet der Umschalter auch die Dialekte, Deutsch vorn", () => {
  mitDialekten();
  seite();
  expect(umschalter().value).toBe("de");
  expect([...umschalter().options].map((o) => o.textContent)).toEqual(["Deutsch", "Schwäbisch", "Bayrisch", "English"]);
});

test("Nur Deutsch angeboten: kein Umschalter", () => {
  vi.stubEnv("WEBSITE_LANGUAGES", "de");
  seite();
  expect(screen.queryByRole("combobox", { name: "Sprache" })).toBeNull();
  expect(angeboteneSprachen()).toEqual(["de"]);
});

test("Umschalten ändert die Texte sofort und merkt die Wahl im Browser", () => {
  mitDialekten();
  seite();
  fireEvent.change(umschalter(), { target: { value: "schwaebisch" } });
  expect(screen.getByText(/^Daten aus dr Blizzard-API, jede Stond frisch/)).toBeTruthy();
  expect(window.localStorage.getItem(SPRACH_SCHLUESSEL)).toBe("schwaebisch");
  expect(document.documentElement.dataset.sprache).toBe("schwaebisch");

  fireEvent.change(umschalter("Sproch"), { target: { value: "bayrisch" } });
  expect(screen.getByText(/^Daten aus da Blizzard-API, jede Stund frisch/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Wochnblatt" })).toBeTruthy();
  expect(window.localStorage.getItem(SPRACH_SCHLUESSEL)).toBe("bayrisch");

  fireEvent.change(umschalter("Sprach"), { target: { value: "en" } });
  expect(screen.getByText(/^Data from the Blizzard API, updated hourly/)).toBeTruthy();
  expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeTruthy();
  expect(document.documentElement.lang).toBe("en");
  expect(window.localStorage.getItem(SPRACH_SCHLUESSEL)).toBe("en");
});

test("Eine gemerkte Wahl gilt beim nächsten Besuch", () => {
  mitDialekten();
  window.localStorage.setItem(SPRACH_SCHLUESSEL, "bayrisch");
  seite();
  expect(umschalter("Sprach").value).toBe("bayrisch");
  expect(screen.getByText(/^Daten aus da Blizzard-API, jede Stund frisch/)).toBeTruthy();
});

test("Browser auf Englisch ohne gemerkte Wahl ergibt Englisch", () => {
  browserSprache("en-US");
  expect(gemerkteSprache()).toBe("en");
  seite();
  expect(umschalter("Language").value).toBe("en");
  const nav = screen.getByRole("navigation", { name: "Main navigation" });
  expect([...nav.querySelectorAll("a")].map((a) => a.textContent)).toEqual(["Guild", "Professions", "Statistics", "Titles", "Weekly"]);
});

test("Browser auf Englisch, aber Englisch nicht angeboten: Deutsch", () => {
  browserSprache("en-US");
  vi.stubEnv("WEBSITE_LANGUAGES", "de,bayrisch");
  expect(gemerkteSprache()).toBe("de");
});

test("Eine gemerkte, nicht mehr angebotene Sprache zählt nicht", () => {
  window.localStorage.setItem(SPRACH_SCHLUESSEL, "bayrisch");
  expect(gemerkteSprache()).toBe("de");
  browserSprache("en-GB");
  expect(gemerkteSprache()).toBe("en");
});

test("Unbrauchbare gemerkte Werte führen zu Deutsch", () => {
  window.localStorage.setItem(SPRACH_SCHLUESSEL, "klingonisch");
  expect(gemerkteSprache()).toBe("de");
});

test("Gesperrter Speicher: Browsersprache gilt, Umschalten klappt trotzdem ohne Fehler", () => {
  mitDialekten();
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("gesperrt");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("gesperrt");
  });
  expect(gemerkteSprache()).toBe("de");
  expect(() => spracheMerken("schwaebisch")).not.toThrow();
  seite();
  fireEvent.change(umschalter(), { target: { value: "schwaebisch" } });
  expect(umschalter("Sproch").value).toBe("schwaebisch");
});

test("Konfigurationstexte: String gilt überall, fehlendes Englisch fällt auf Deutsch zurück", () => {
  expect(ausKonfig("Petri Heil!")).toEqual({ de: "Petri Heil!", en: "Petri Heil!", schwaebisch: "Petri Heil!", bayrisch: "Petri Heil!" });
  expect(ausKonfig({ de: "Gut", bayrisch: "Guad" })).toEqual({ de: "Gut", en: "Gut", bayrisch: "Guad" });
  expect(ausKonfig({ de: "Gut", en: "Good" })).toEqual({ de: "Gut", en: "Good" });
  expect(ausKonfig(undefined)).toBeNull();
  expect(istSprache("de")).toBe(true);
  expect(istSprache("en")).toBe(true);
  expect(istSprache("klingonisch")).toBe(false);
});

test("Alte API-Antworten aus dem Browser-Cache: einfache Werte kommen unverändert durch", async () => {
  const { fassungIn } = await import("../../web/src/lib/sprache");
  expect(fassungIn({ de: "Tode", en: "Deaths", bayrisch: "Dode" }, "bayrisch")).toBe("Dode");
  expect(fassungIn({ de: "Tode", en: "Deaths" }, "schwaebisch")).toBe("Tode");
  expect(fassungIn({ de: "Tode" } as never, "en")).toBe("Tode");
  expect(fassungIn("Tode" as never, "bayrisch")).toBe("Tode");
  expect(fassungIn(["Fass", "Fässer"] as never, "schwaebisch")).toEqual(["Fass", "Fässer"]);
});
