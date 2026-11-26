// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "../../web/src/App";
import { DataState } from "../../web/src/components/DataState";
import { ApiError } from "../../web/src/lib/api";

beforeEach(() => {
  // jsdom meldet "en-US"; ohne gemerkte Wahl gilt sonst Englisch.
  vi.spyOn(navigator, "language", "get").mockReturnValue("de-DE");
});

// Der Kern wird ohne angemeldete Module geprüft, damit private Repos mit eigenen Modulen dieselben Tests bestehen.
vi.mock("../../web/src/erweiterungen", () => ({ OBERFLAECHEN_ERWEITERUNGEN: [] }));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const impressum = { name: "Erika Muster", anschrift: ["Musterweg 1", "12345 Musterstadt"], email: "gilde@example.org" };
const DISCORD = "https://discord.gg/beispiel";

/** Vollständige Seitenangaben wie auf einer echten Installation. */
function mitSeite() {
  vi.stubEnv("SITE_NAME", "Musterzunft");
  vi.stubEnv("SITE_LOGO", "/musterzunft.png");
  vi.stubEnv("SITE_TAGLINE", "Eine Gemeinschaft");
  vi.stubEnv("SITE_DISCORD", DISCORD);
  vi.stubEnv("SITE_IMPRINT_NAME", impressum.name);
  vi.stubEnv("SITE_IMPRINT_ADDRESS", impressum.anschrift.join(" | "));
  vi.stubEnv("SITE_IMPRINT_EMAIL", impressum.email);
  vi.stubEnv("SITE_UMAMI_ID", "5e709613-0000-0000-0000-000000000000");
}

test("DataState zeigt den Leerzustand bei 503", () => {
  render(<DataState loading={false} error={new ApiError(503, "x")}>Inhalt</DataState>);
  expect(
    screen.getByText("Noch keine Daten gesammelt. Der erste Lauf des Sammlers steht noch aus."),
  ).toBeTruthy();
  expect(screen.queryByText("Inhalt")).toBeNull();
});

test("DataState zeigt Laden, 404, sonstige Fehler und sonst die Kinder", () => {
  const { rerender } = render(<DataState loading={true} error={null}>Inhalt</DataState>);
  expect(screen.getByText("Lade Daten")).toBeTruthy();
  rerender(<DataState loading={false} error={new ApiError(404, "x")}>Inhalt</DataState>);
  expect(screen.getByText("Nicht gefunden.")).toBeTruthy();
  rerender(<DataState loading={false} error={new ApiError(500, "x")}>Inhalt</DataState>);
  expect(screen.getByText("Die Daten konnten nicht geladen werden.")).toBeTruthy();
  rerender(<DataState loading={false} error={null}>Inhalt</DataState>);
  expect(screen.getByText("Inhalt")).toBeTruthy();
});

test("Navigation enthält Gilde, Berufe, Statistik, Titel und Wochenblatt und kein fremdes Logo", () => {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
  const nav = screen.getByRole("navigation", { name: "Hauptnavigation" });
  expect([...nav.querySelectorAll("a")].map((a) => a.textContent)).toEqual(["Gilde", "Berufe", "Statistik", "Titel", "Wochenblatt"]);
  const bilder = Array.from(document.querySelectorAll("img")).map((i) => i.getAttribute("src"));
  expect(bilder).toContain("/logo.svg");
  expect(bilder.some((s) => /blizzard|horde|battle\.net/i.test(s ?? ""))).toBe(false);
});

test("Kopf zeigt das Gildenlogo mit Alternativtext als Link zur Übersicht", () => {
  mitSeite();
  render(
    <MemoryRouter initialEntries={["/berufe"]}>
      <App />
    </MemoryRouter>,
  );
  const startseite = screen.getByRole("link", { name: "Musterzunft, zur Gildenübersicht" });
  expect(startseite.getAttribute("href")).toBe("/");
  expect(startseite.closest("header")).toBeTruthy();
  const logo = screen.getByRole("img", { name: "Wappen der Gilde Musterzunft" });
  expect(startseite.contains(logo)).toBe(true);
  expect(logo.getAttribute("src")).toBe("/musterzunft.png");
  expect(Number(logo.getAttribute("width"))).toBeGreaterThan(0);
  expect(Number(logo.getAttribute("height"))).toBe(Number(logo.getAttribute("width")));
});

test.each(["/gibt-es-nicht", "/levelrennen", "/raids"])("%s zeigt die Seite Nicht gefunden", (pfad) => {
  render(
    <MemoryRouter initialEntries={[pfad]}>
      <App />
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { name: "Seite nicht gefunden" })).toBeTruthy();
});

test("Discord-Link im Kopf und im Fuß, aus der Konfiguration, in neuem Tab", () => {
  mitSeite();
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
  const discord = screen.getAllByRole("link", { name: /Discord/ });
  expect(discord).toHaveLength(2);
  for (const a of discord) {
    expect(a.getAttribute("href")).toBe(DISCORD);
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toBe("noopener noreferrer");
  }
  expect(discord[0].closest("header")).toBeTruthy();
  expect(discord[1].closest("footer")).toBeTruthy();
  expect(document.querySelectorAll("img[src*='discord' i]")).toHaveLength(0);
});

test("ohne Angaben: neutrales Logo, kein Discord, kein Untertitel, keine Rechtsseiten", () => {
  render(
    <MemoryRouter initialEntries={["/impressum"]}>
      <App />
    </MemoryRouter>,
  );
  expect(screen.getByRole("img", { name: "Wappen der Gilde Gildenseite" }).getAttribute("src")).toBe("/logo.svg");
  expect(screen.queryByRole("link", { name: /Discord/ })).toBeNull();
  expect(screen.queryByRole("navigation", { name: "Rechtliches" })).toBeNull();
  expect(screen.getByRole("heading", { name: "Seite nicht gefunden" })).toBeTruthy();
});

test("Discord nur mit https-Adresse", () => {
  vi.stubEnv("SITE_DISCORD", "javascript:alert(1)");
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
  expect(screen.queryByRole("link", { name: /Discord/ })).toBeNull();
});

test("/berufe/bergbau gehört zur Berufe-Seite, Navigation markiert Berufe", () => {
  render(
    <MemoryRouter initialEntries={["/berufe/bergbau"]}>
      <App />
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { name: "Berufe", level: 1 })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Berufe" }).className).toContain("active");
});

test("Fuß verlinkt Impressum und Datenschutz", () => {
  mitSeite();
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
  const legal = screen.getByRole("navigation", { name: "Rechtliches" });
  expect(legal.closest("footer")).toBeTruthy();
  expect([...legal.querySelectorAll("a")].map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
    ["Impressum", "/impressum"],
    ["Datenschutz", "/datenschutz"],
  ]);
});

test("Fuß zeigt Version und Datum, die beim Bauen eingesetzt werden", () => {
  vi.stubEnv("VITE_VERSION", "1.0.0");
  vi.stubEnv("VITE_VERSION_DATUM", "2026-11-06");
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
  expect(screen.getByText("Version 1.0.0 vom 06.11.2026").closest("footer")).toBeTruthy();
});

test("ohne eingesetzte Version zeigt der Fuß keine Versionszeile", () => {
  vi.stubEnv("VITE_VERSION", "");
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
  expect(screen.queryByText(/^Version /)).toBeNull();
});

test("Impressum zeigt die Angaben aus SITE_IMPRINT_… und den Hinweis zu Blizzard", () => {
  mitSeite();
  render(
    <MemoryRouter initialEntries={["/impressum"]}>
      <App />
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { name: "Impressum", level: 1 })).toBeTruthy();
  const main = document.querySelector("main")!;
  expect(main.textContent).toContain(impressum.name);
  for (const zeile of impressum.anschrift) expect(main.textContent).toContain(zeile);
  expect(screen.getByRole("link", { name: impressum.email }).getAttribute("href")).toBe(`mailto:${impressum.email}`);
  expect(screen.getByRole("heading", { name: "Angaben nach § 5 DDG" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV" })).toBeTruthy();
  expect(main.textContent).toMatch(/inoffizielle Fanseite/);
  expect(main.textContent).toMatch(/Marken von Blizzard Entertainment, Inc\./);
  expect(main.textContent).toContain("[Platzhalter");
  expect(main.textContent).not.toMatch(/Bärenklaue|—/);
});

test("Datenschutz ist eine Vorlage mit Platzhaltern je Abschnitt und Kontakt aus der Konfiguration", () => {
  mitSeite();
  render(
    <MemoryRouter initialEntries={["/datenschutz"]}>
      <App />
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { name: "Datenschutzerklärung", level: 1 })).toBeTruthy();
  const main = document.querySelector("main")!;
  expect(main.textContent).toContain("[Platzhalter: Diese Datenschutzerklärung ist eine Vorlage");
  expect(main.textContent).toContain("render.worldofwarcraft.com");
  expect(screen.getByRole("heading", { name: "Hosting" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Besucherstatistik mit Umami" })).toBeTruthy();
  expect(main.textContent).not.toMatch(/Bärenklaue|Ich |mein/);
  expect(main.textContent).toContain(impressum.name);
  expect(screen.getByRole("link", { name: impressum.email })).toBeTruthy();
  expect(main.textContent).not.toMatch(/Turnstile|Bewertung|Adminbereich|—/);
});

test("Datenschutz ohne Umami erwähnt Umami nicht", () => {
  mitSeite();
  vi.stubEnv("SITE_UMAMI_ID", "");
  render(
    <MemoryRouter initialEntries={["/datenschutz"]}>
      <App />
    </MemoryRouter>,
  );
  expect(document.querySelector("main")!.textContent).not.toMatch(/Umami/);
});

test("ein Modul ersetzt Impressum und Datenschutz durch eigene Seiten", async () => {
  vi.resetModules();
  vi.doMock("../../web/src/erweiterungen", () => ({
    OBERFLAECHEN_ERWEITERUNGEN: [
      { id: "recht", impressumSeite: () => <h1>Eigenes Impressum</h1>, datenschutzSeite: () => <h1>Eigener Datenschutz</h1> },
    ],
  }));
  const { default: AppMitModul } = await import("../../web/src/App");
  mitSeite();
  render(
    <MemoryRouter initialEntries={["/impressum"]}>
      <AppMitModul />
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { name: "Eigenes Impressum" })).toBeTruthy();
  cleanup();
  render(
    <MemoryRouter initialEntries={["/datenschutz"]}>
      <AppMitModul />
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { name: "Eigener Datenschutz" })).toBeTruthy();
  vi.doUnmock("../../web/src/erweiterungen");
  vi.resetModules();
});
