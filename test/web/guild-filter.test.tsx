// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { FactionCrest } from "../../web/src/components/FactionCrest";
import { GuildFilter } from "../../web/src/components/GuildFilter";

afterEach(cleanup);

const guilds = [
  { slug: "bärenklaue", name: "Bärenklaue", faction: "HORDE", memberCount: 76, main: true },
  { slug: "goldene-bärenklaue", name: "Goldene Bärenklaue", faction: "ALLIANCE", memberCount: 19, main: false },
];

test("GuildFilter is a radio group and reports the selection, All yields null", () => {
  const onChange = vi.fn();
  render(<GuildFilter guilds={guilds} value="bärenklaue" onChange={onChange} />);
  expect(screen.getByRole("radiogroup", { name: "Gilde" })).toBeTruthy();
  expect(screen.getAllByRole("radio").map((r) => r.textContent)).toEqual(["Alle", "Bärenklaue", "Goldene Bärenklaue"]);
  expect(screen.getByRole("radio", { name: "Bärenklaue" }).getAttribute("aria-checked")).toBe("true");
  expect(screen.getByRole("radio", { name: "Alle" }).getAttribute("aria-checked")).toBe("false");
  fireEvent.click(screen.getByRole("radio", { name: "Alle" }));
  fireEvent.click(screen.getByRole("radio", { name: "Goldene Bärenklaue" }));
  expect(onChange.mock.calls).toEqual([[null], ["goldene-bärenklaue"]]);
});

test("keyboard: only the selected segment is in the tab order, arrows, Home and End change the selection", () => {
  function Controlled() {
    const [value, setValue] = useState<string | null>(null);
    return <GuildFilter guilds={guilds} value={value} onChange={setValue} />;
  }
  render(<Controlled />);
  const radio = (name: string) => screen.getByRole("radio", { name });
  expect([radio("Alle").tabIndex, radio("Bärenklaue").tabIndex, radio("Goldene Bärenklaue").tabIndex]).toEqual([0, -1, -1]);
  radio("Alle").focus();
  fireEvent.keyDown(radio("Alle"), { key: "ArrowRight" });
  expect(radio("Bärenklaue").getAttribute("aria-checked")).toBe("true");
  expect(document.activeElement).toBe(radio("Bärenklaue"));
  fireEvent.keyDown(radio("Bärenklaue"), { key: "End" });
  expect(radio("Goldene Bärenklaue").getAttribute("aria-checked")).toBe("true");
  fireEvent.keyDown(radio("Goldene Bärenklaue"), { key: "ArrowRight" });
  expect(radio("Alle").getAttribute("aria-checked")).toBe("true");
  fireEvent.keyDown(radio("Alle"), { key: "ArrowLeft" });
  expect(radio("Goldene Bärenklaue").getAttribute("aria-checked")).toBe("true");
  fireEvent.keyDown(radio("Goldene Bärenklaue"), { key: "Home" });
  expect(radio("Alle").getAttribute("aria-checked")).toBe("true");
  expect(radio("Alle").tabIndex).toBe(0);
});

test("GuildFilter with only one guild shows nothing", () => {
  const { container } = render(<GuildFilter guilds={guilds.slice(0, 1)} value={null} onChange={() => {}} />);
  expect(container.textContent).toBe("");
});

test("FactionCrest names the faction, an unknown faction stays neutral", () => {
  render(
    <>
      <FactionCrest faction="HORDE" />
      <FactionCrest faction="ALLIANCE" />
      <FactionCrest faction="" />
    </>,
  );
  const imgs = screen.getAllByRole("img");
  expect(imgs.map((i) => i.getAttribute("alt") ?? i.getAttribute("aria-label"))).toEqual(["Horde", "Allianz", "Fraktion unbekannt"]);
  // Official icons from Blizzard's image server, not from the repo
  expect(imgs[0].getAttribute("src")).toBe("https://render.worldofwarcraft.com/eu/icons/56/pvpcurrency-honor-horde.jpg");
  expect(imgs[1].getAttribute("src")).toBe("https://render.worldofwarcraft.com/eu/icons/56/pvpcurrency-honor-alliance.jpg");
});

test("FactionCrest: if the icon fails to load, the PvP banners follow and finally the colored pennant", () => {
  render(<FactionCrest faction="HORDE" />);
  const img = () => screen.getByRole("img");
  fireEvent.error(img());
  expect(img().getAttribute("src")).toBe("https://render.worldofwarcraft.com/forever-eu/icons/56/132485.jpg");
  fireEvent.error(img());
  expect(img().getAttribute("src")).toBe("https://render.worldofwarcraft.com/forever-us/icons/56/132485.jpg");
  fireEvent.error(img());
  expect(img().tagName.toLowerCase()).toBe("svg");
  expect(img().getAttribute("aria-label")).toBe("Horde");
});

test("segments show the faction icon only as decoration, the name stays the guild name", () => {
  render(<GuildFilter guilds={guilds} value={null} onChange={() => {}} />);
  expect(screen.getByRole("radio", { name: "Goldene Bärenklaue" }).querySelector("img")?.getAttribute("src")).toContain("pvpcurrency-honor-alliance");
});

test("segments carry the faction so the Alliance guild appears blue when active", () => {
  render(<GuildFilter guilds={guilds} value="goldene-bärenklaue" onChange={() => {}} />);
  expect(screen.getAllByRole("radio").map((r) => r.getAttribute("data-faction"))).toEqual(["", "HORDE", "ALLIANCE"]);
});

test("the active segment carries the guild's faction, not its name", () => {
  const renamed = [
    { slug: "a", name: "Nordwind", faction: "ALLIANCE", memberCount: 3, main: true },
    { slug: "b", name: "Goldene Bärenklaue", faction: "HORDE", memberCount: 4, main: false },
  ];
  const { rerender } = render(<GuildFilter guilds={renamed} value="a" onChange={() => {}} />);
  const active = () => screen.getAllByRole("radio").filter((r) => r.getAttribute("aria-checked") === "true");
  expect(active().map((r) => [r.textContent, r.getAttribute("data-faction")])).toEqual([["Nordwind", "ALLIANCE"]]);
  rerender(<GuildFilter guilds={renamed} value="b" onChange={() => {}} />);
  expect(active().map((r) => [r.textContent, r.getAttribute("data-faction")])).toEqual([["Goldene Bärenklaue", "HORDE"]]);
  rerender(<GuildFilter guilds={renamed} value={null} onChange={() => {}} />);
  expect(active().map((r) => [r.textContent, r.getAttribute("data-faction")])).toEqual([["Alle", ""]]);
});

// The color comes solely from data-faction in the stylesheet: check the rule per faction and the text for AA (4.5:1)
const css = readFileSync(resolve(process.cwd(), "web/src/styles/theme.css"), "utf8");

function rule(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `rule ${selector} missing`).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf("}", start));
}

function variable(name: string): string {
  const m = css.match(new RegExp(`${name}:\\s*([^;]+);`));
  expect(m, `variable ${name} missing`).toBeTruthy();
  return m![1].trim();
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** All hex colors of a gradient, with variables like var(--horde) resolved. */
function stops(fill: string): string[] {
  return [...fill.matchAll(/#[0-9a-f]{6}|var\((--[a-z-]+)\)/gi)].map((m) => (m[1] ? variable(m[1]) : m[0]));
}

test.each([
  ["All", `.segmented-option[aria-checked="true"]`, "--gold-fill", "var(--on-gold)"],
  ["Horde", `.segmented-option[data-faction="HORDE"][aria-checked="true"]`, "--horde-fill", "#fff"],
  ["Alliance", `.segmented-option[data-faction="ALLIANCE"][aria-checked="true"]`, "--alliance-fill", "#fff"],
])("active segment %s: own gradient, text with at least 4.5:1", (_name, selector, fillVar, textColor) => {
  const body = rule(selector);
  expect(body).toContain(`background: var(${fillVar})`);
  const text = textColor.startsWith("var(") ? variable(textColor.slice(4, -1)) : textColor === "#fff" ? "#ffffff" : textColor;
  expect(body).toMatch(new RegExp(`color:\\s*${textColor.replace(/[()]/g, "\\$&")}`));
  for (const stop of stops(variable(fillVar))) expect(contrast(text, stop), `${stop} on ${text}`).toBeGreaterThanOrEqual(4.5);
});

test("the focus ring stays visible for all segments", () => {
  expect(rule(".segmented-option:focus-visible")).toMatch(/outline:\s*2px solid var\(--gold-hi\)/);
});
