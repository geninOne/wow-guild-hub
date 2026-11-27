// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "../../web/src/App";
import { DataState } from "../../web/src/components/DataState";
import { ApiError } from "../../web/src/lib/api";

beforeEach(() => {
  // jsdom reports "en-US"; without a remembered choice English would apply.
  vi.spyOn(navigator, "language", "get").mockReturnValue("de-DE");
});

// The core is tested without registered modules, so private repos with their own modules pass the same tests.
vi.mock("../../web/src/erweiterungen", () => ({ OBERFLAECHEN_ERWEITERUNGEN: [] }));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const imprint = { name: "Erika Muster", address: ["Musterweg 1", "12345 Musterstadt"], email: "gilde@example.org" };
const DISCORD = "https://discord.gg/beispiel";

/** Complete site details as on a real installation. */
function withSite() {
  vi.stubEnv("WEBSITE_NAME", "Musterzunft");
  vi.stubEnv("WEBSITE_LOGO", "/musterzunft.png");
  vi.stubEnv("WEBSITE_TAGLINE", "Eine Gemeinschaft");
  vi.stubEnv("WEBSITE_DISCORD", DISCORD);
  vi.stubEnv("WEBSITE_IMPRINT_NAME", imprint.name);
  vi.stubEnv("WEBSITE_IMPRINT_ADDRESS", imprint.address.join(" | "));
  vi.stubEnv("WEBSITE_IMPRINT_EMAIL", imprint.email);
  vi.stubEnv("WEBSITE_UMAMI_ID", "5e709613-0000-0000-0000-000000000000");
}

test("DataState shows the empty state on 503", () => {
  render(<DataState loading={false} error={new ApiError(503, "x")}>Content</DataState>);
  expect(
    screen.getByText("Noch keine Daten gesammelt. Der erste Lauf des Sammlers steht noch aus."),
  ).toBeTruthy();
  expect(screen.queryByText("Content")).toBeNull();
});

test("DataState shows loading, 404, other errors and otherwise the children", () => {
  const { rerender } = render(<DataState loading={true} error={null}>Content</DataState>);
  expect(screen.getByText("Lade Daten")).toBeTruthy();
  rerender(<DataState loading={false} error={new ApiError(404, "x")}>Content</DataState>);
  expect(screen.getByText("Nicht gefunden.")).toBeTruthy();
  rerender(<DataState loading={false} error={new ApiError(500, "x")}>Content</DataState>);
  expect(screen.getByText("Die Daten konnten nicht geladen werden.")).toBeTruthy();
  rerender(<DataState loading={false} error={null}>Content</DataState>);
  expect(screen.getByText("Content")).toBeTruthy();
});

test("navigation contains guild, professions, stats, titles and weekly and no third-party logo", () => {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
  const nav = screen.getByRole("navigation", { name: "Hauptnavigation" });
  expect([...nav.querySelectorAll("a")].map((a) => a.textContent)).toEqual(["Gilde", "Berufe", "Statistik", "Titel", "Wochenblatt"]);
  const images = Array.from(document.querySelectorAll("img")).map((i) => i.getAttribute("src"));
  expect(images).toContain("/logo.svg");
  expect(images.some((s) => /blizzard|horde|battle\.net/i.test(s ?? ""))).toBe(false);
});

test("header shows the guild logo with alt text as a link to the overview", () => {
  withSite();
  render(
    <MemoryRouter initialEntries={["/berufe"]}>
      <App />
    </MemoryRouter>,
  );
  const homeLink = screen.getByRole("link", { name: "Musterzunft, zur Gildenübersicht" });
  expect(homeLink.getAttribute("href")).toBe("/");
  expect(homeLink.closest("header")).toBeTruthy();
  const logo = screen.getByRole("img", { name: "Wappen der Gilde Musterzunft" });
  expect(homeLink.contains(logo)).toBe(true);
  expect(logo.getAttribute("src")).toBe("/musterzunft.png");
  expect(Number(logo.getAttribute("width"))).toBeGreaterThan(0);
  expect(Number(logo.getAttribute("height"))).toBe(Number(logo.getAttribute("width")));
});

test.each(["/gibt-es-nicht", "/levelrennen", "/raids"])("%s shows the not found page", (path) => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { name: "Seite nicht gefunden" })).toBeTruthy();
});

test("Discord link in header and footer, from the config, in a new tab", () => {
  withSite();
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

test("without details: neutral logo, no Discord, no tagline, no legal pages", () => {
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

test("Discord only with an https address", () => {
  vi.stubEnv("WEBSITE_DISCORD", "javascript:alert(1)");
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
  expect(screen.queryByRole("link", { name: /Discord/ })).toBeNull();
});

test("/berufe/bergbau belongs to the professions page, navigation marks professions", () => {
  render(
    <MemoryRouter initialEntries={["/berufe/bergbau"]}>
      <App />
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { name: "Berufe", level: 1 })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Berufe" }).className).toContain("active");
});

test("footer links imprint and privacy policy", () => {
  withSite();
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

test("footer shows version and date inserted at build time", () => {
  vi.stubEnv("VITE_VERSION", "1.0.0");
  vi.stubEnv("VITE_VERSION_DATE", "2026-11-06");
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
  expect(screen.getByText("Version 1.0.0 vom 06.11.2026").closest("footer")).toBeTruthy();
});

test("without an inserted version the footer shows no version line", () => {
  vi.stubEnv("VITE_VERSION", "");
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
  expect(screen.queryByText(/^Version /)).toBeNull();
});

test("imprint shows the details from WEBSITE_IMPRINT_… and the Blizzard notice", () => {
  withSite();
  render(
    <MemoryRouter initialEntries={["/impressum"]}>
      <App />
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { name: "Impressum", level: 1 })).toBeTruthy();
  const main = document.querySelector("main")!;
  expect(main.textContent).toContain(imprint.name);
  for (const line of imprint.address) expect(main.textContent).toContain(line);
  expect(screen.getByRole("link", { name: imprint.email }).getAttribute("href")).toBe(`mailto:${imprint.email}`);
  expect(screen.getByRole("heading", { name: "Angaben nach § 5 DDG" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV" })).toBeTruthy();
  expect(main.textContent).toMatch(/inoffizielle Fanseite/);
  expect(main.textContent).toMatch(/Marken von Blizzard Entertainment, Inc\./);
  expect(main.textContent).toContain("[Platzhalter");
  expect(main.textContent).not.toMatch(/Bärenklaue|—/);
});

test("privacy policy is a template with placeholders per section and contact from the config", () => {
  withSite();
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
  expect(main.textContent).toContain(imprint.name);
  expect(screen.getByRole("link", { name: imprint.email })).toBeTruthy();
  expect(main.textContent).not.toMatch(/Turnstile|Bewertung|Adminbereich|—/);
});

test("privacy policy without Umami does not mention Umami", () => {
  withSite();
  vi.stubEnv("WEBSITE_UMAMI_ID", "");
  render(
    <MemoryRouter initialEntries={["/datenschutz"]}>
      <App />
    </MemoryRouter>,
  );
  expect(document.querySelector("main")!.textContent).not.toMatch(/Umami/);
});

test("a module replaces imprint and privacy policy with its own pages", async () => {
  vi.resetModules();
  vi.doMock("../../web/src/erweiterungen", () => ({
    OBERFLAECHEN_ERWEITERUNGEN: [
      { id: "recht", impressumSeite: () => <h1>Eigenes Impressum</h1>, datenschutzSeite: () => <h1>Eigener Datenschutz</h1> },
    ],
  }));
  const { default: AppWithModule } = await import("../../web/src/App");
  withSite();
  render(
    <MemoryRouter initialEntries={["/impressum"]}>
      <AppWithModule />
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { name: "Eigenes Impressum" })).toBeTruthy();
  cleanup();
  render(
    <MemoryRouter initialEntries={["/datenschutz"]}>
      <AppWithModule />
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { name: "Eigener Datenschutz" })).toBeTruthy();
  vi.doUnmock("../../web/src/erweiterungen");
  vi.resetModules();
});
