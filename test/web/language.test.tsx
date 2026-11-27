// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "../../web/src/App";
import { offeredLanguages, storedLanguage, LANGUAGE_STORAGE_KEY, storeLanguage } from "../../web/src/lib/language";
import { fromConfig, isLanguage } from "../../src/language";

/** Browser language; jsdom reports "en-US" otherwise. */
function browserLanguage(language: string) {
  vi.spyOn(navigator, "language", "get").mockReturnValue(language);
}

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  browserLanguage("de-DE");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  window.localStorage.clear();
});

/** All four languages offered, as on an installation with dialects. */
function enableDialects() {
  vi.stubEnv("WEBSITE_LANGUAGES", "de,schwaebisch,bayrisch,en");
}

function site() {
  return render(
    <MemoryRouter initialEntries={["/impressum"]}>
      <App />
    </MemoryRouter>,
  );
}

const switcher = (name = "Sprache") => screen.getByRole("combobox", { name }) as HTMLSelectElement;

test("default is German, without config the switcher offers German and English", () => {
  site();
  expect(switcher().value).toBe("de");
  expect([...switcher().options].map((o) => o.textContent)).toEqual(["Deutsch", "English"]);
  expect(switcher().closest("header")).toBeTruthy();
  expect(screen.getByText(/^Daten aus der Blizzard-API, stündlich aktualisiert/)).toBeTruthy();
});

test("with WEBSITE_LANGUAGES the switcher also offers the dialects, German first", () => {
  enableDialects();
  site();
  expect(switcher().value).toBe("de");
  expect([...switcher().options].map((o) => o.textContent)).toEqual(["Deutsch", "Schwäbisch", "Bayrisch", "English"]);
});

test("only German offered: no switcher", () => {
  vi.stubEnv("WEBSITE_LANGUAGES", "de");
  site();
  expect(screen.queryByRole("combobox", { name: "Sprache" })).toBeNull();
  expect(offeredLanguages()).toEqual(["de"]);
});

test("switching changes the texts at once and remembers the choice in the browser", () => {
  enableDialects();
  site();
  fireEvent.change(switcher(), { target: { value: "schwaebisch" } });
  expect(screen.getByText(/^Daten aus dr Blizzard-API, jede Stond frisch/)).toBeTruthy();
  expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("schwaebisch");
  expect(document.documentElement.dataset.sprache).toBe("schwaebisch");

  fireEvent.change(switcher("Sproch"), { target: { value: "bayrisch" } });
  expect(screen.getByText(/^Daten aus da Blizzard-API, jede Stund frisch/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Wochnblatt" })).toBeTruthy();
  expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("bayrisch");

  fireEvent.change(switcher("Sprach"), { target: { value: "en" } });
  expect(screen.getByText(/^Data from the Blizzard API, updated hourly/)).toBeTruthy();
  expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeTruthy();
  expect(document.documentElement.lang).toBe("en");
  expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en");
});

test("a remembered choice applies on the next visit", () => {
  enableDialects();
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "bayrisch");
  site();
  expect(switcher("Sprach").value).toBe("bayrisch");
  expect(screen.getByText(/^Daten aus da Blizzard-API, jede Stund frisch/)).toBeTruthy();
});

test("browser in English without a remembered choice gives English", () => {
  browserLanguage("en-US");
  expect(storedLanguage()).toBe("en");
  site();
  expect(switcher("Language").value).toBe("en");
  const nav = screen.getByRole("navigation", { name: "Main navigation" });
  expect([...nav.querySelectorAll("a")].map((a) => a.textContent)).toEqual(["Guild", "Professions", "Statistics", "Titles", "Weekly"]);
});

test("browser in English, but English not offered: German", () => {
  browserLanguage("en-US");
  vi.stubEnv("WEBSITE_LANGUAGES", "de,bayrisch");
  expect(storedLanguage()).toBe("de");
});

test("a remembered language that is no longer offered does not count", () => {
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "bayrisch");
  expect(storedLanguage()).toBe("de");
  browserLanguage("en-GB");
  expect(storedLanguage()).toBe("en");
});

test("unusable remembered values lead to German", () => {
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "klingonisch");
  expect(storedLanguage()).toBe("de");
});

test("blocked storage: browser language applies, switching still works without errors", () => {
  enableDialects();
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  expect(storedLanguage()).toBe("de");
  expect(() => storeLanguage("schwaebisch")).not.toThrow();
  site();
  fireEvent.change(switcher(), { target: { value: "schwaebisch" } });
  expect(switcher("Sproch").value).toBe("schwaebisch");
});

test("config texts: a string applies everywhere, missing English falls back to German", () => {
  expect(fromConfig("Petri Heil!")).toEqual({ de: "Petri Heil!", en: "Petri Heil!", schwaebisch: "Petri Heil!", bayrisch: "Petri Heil!" });
  expect(fromConfig({ de: "Gut", bayrisch: "Guad" })).toEqual({ de: "Gut", en: "Gut", bayrisch: "Guad" });
  expect(fromConfig({ de: "Gut", en: "Good" })).toEqual({ de: "Gut", en: "Good" });
  expect(fromConfig(undefined)).toBeNull();
  expect(isLanguage("de")).toBe(true);
  expect(isLanguage("en")).toBe(true);
  expect(isLanguage("klingonisch")).toBe(false);
});

test("old API responses from the browser cache: plain values pass through unchanged", async () => {
  const { translationIn } = await import("../../web/src/lib/language");
  expect(translationIn({ de: "Tode", en: "Deaths", bayrisch: "Dode" }, "bayrisch")).toBe("Dode");
  expect(translationIn({ de: "Tode", en: "Deaths" }, "schwaebisch")).toBe("Tode");
  expect(translationIn({ de: "Tode" } as never, "en")).toBe("Tode");
  expect(translationIn("Tode" as never, "bayrisch")).toBe("Tode");
  expect(translationIn(["Fass", "Fässer"] as never, "schwaebisch")).toEqual(["Fass", "Fässer"]);
});
