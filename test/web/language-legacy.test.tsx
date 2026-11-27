// @vitest-environment jsdom
// The deprecated 2.x names of the language module (`src/sprache.ts`, `web/src/lib/sprache.tsx`) keep working for
// extension modules written for 2.x, and a component on the old hook follows the same language switch.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import * as current from "../../src/language";
import * as legacy from "../../src/sprache";
import { LanguageProvider, useLanguage } from "../../web/src/lib/language";
import * as legacyWeb from "../../web/src/lib/sprache";

afterEach(cleanup);

test("legacy server names are the same values as the new ones", () => {
  expect(legacy.SPRACHEN).toBe(current.LANGUAGES);
  expect(legacy.DIALEKTE).toBe(current.DIALECTS);
  expect(legacy.STANDARD_SPRACHE).toBe(current.DEFAULT_LANGUAGE);
  expect(legacy.fassungIn).toBe(current.translationIn);
  expect(legacy.mitDialekten).toBe(current.withDialects);
  expect(legacy.ueberall).toBe(current.sameInAll);
  expect(legacy.ausKonfig).toBe(current.fromConfig);
  const text: legacy.Fassungen = { de: "Hallo", en: "Hello" };
  expect(legacy.fassungIn(text, "schwaebisch")).toBe("Hallo");
});

const TEXT: legacy.Fassungen = { de: "Gilde", en: "Guild", schwaebisch: "Gild", bayrisch: "Gildn" };

function LegacyModule() {
  const { t, sprache, setSprache } = legacyWeb.useSprache();
  return (
    <button type="button" onClick={() => setSprache("en")}>
      {t(TEXT)} ({sprache})
    </button>
  );
}

function CurrentCore() {
  const { t, language } = useLanguage();
  return <p>{`${t(TEXT)} / ${language}`}</p>;
}

test("a component on the legacy hook shares the language with the core, in both directions", () => {
  render(
    <LanguageProvider start="bayrisch">
      <LegacyModule />
      <CurrentCore />
    </LanguageProvider>,
  );
  expect(screen.getByRole("button").textContent).toBe("Gildn (bayrisch)");
  fireEvent.click(screen.getByRole("button"));
  expect(screen.getByRole("button").textContent).toBe("Guild (en)");
  expect(screen.getByText("Guild / en")).toBeTruthy();
});

test("the legacy provider is the new provider", () => {
  expect(legacyWeb.SpracheProvider).toBe(LanguageProvider);
  expect(legacyWeb.SPRACH_SCHLUESSEL).toBe("wow-guild-hub-sprache");
});
