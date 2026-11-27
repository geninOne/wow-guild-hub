// Interfaces for interface modules (extensions). A module registers in `index.ts`; the core's pages then show its
// tabs, badges, routes and privacy sections. Guide: docs/extensions.md.
import type { ComponentType } from "react";
import type { CharacterView } from "../../../src/api/types";
import type { Translations } from "../lib/language";

/** A tab of the stats page at `/statistik/<id>`, after the core's tabs. */
export interface StatsTab {
  id: string;
  label: Translations;
  /** Content; `guild` is the selected guild from `?gilde=`, `onGuild` changes it. */
  Component: ComponentType<{ guild: string | null; onGuild: (guild: string | null) => void }>;
}

export interface CharacterDataProps {
  /** Extra data from the server in `view.extensions[id]`; undefined if it provided none. */
  data: unknown;
  view: CharacterView;
}

/** A tab of the character page (`?reiter=<id>`), after the core's tabs. */
export interface CharacterTab {
  id: string;
  label: Translations;
  /**
   * Content of the tab, also without extra data (then best a notice). Characters without a profile have no tabs;
   * there the component appears below the notice, but only with extra data.
   */
  Component: ComponentType<CharacterDataProps>;
}

/** An own page. On Netlify the path needs a redirect to `/index.html` in netlify.toml. */
export interface ExtensionRoute {
  /** Path as for react-router, such as `/polls` or `/polls/:id`. */
  path: string;
  Component: ComponentType;
}

export interface UiExtension {
  /** The same id as on the server; key of the extra data in `CharacterView.extensions`. */
  id: string;
  statsTabs?: StatsTab[];
  characterTabs?: CharacterTab[];
  /** Badge in the header of the character page, only with extra data (`data` is set then). */
  characterHeader?: ComponentType<CharacterDataProps>;
  routes?: ExtensionRoute[];
  /** Section of the privacy policy (with its own `h2` heading), before the links to other sites. */
  privacy?: ComponentType;
  /**
   * Own imprint instead of the core's placeholder template. The first registered module that has one wins.
   * Like the template, the page appears only with `WEBSITE_IMPRINT_NAME`.
   */
  imprintPage?: ComponentType;
  /** Own privacy policy instead of the template, otherwise like `imprintPage`. */
  privacyPage?: ComponentType;
}
