// Converts interface modules written for 2.x (`OberflaechenErweiterung`, German member names, `daten` prop) into
// `UiExtension`, so they keep working without changes until 4.0. Components are wrapped once here, when the
// registry is built, never during rendering, so their state survives re-renders.
import type { ComponentType } from "react";
import type { CharakterDatenProps, OberflaechenErweiterung } from "../erweiterungen/typen";
import type { CharacterDataProps, UiExtension } from "./types";

/** A registered module in either shape. */
export type AnyUiExtension = UiExtension | OberflaechenErweiterung;

const LEGACY_KEYS = [
  "statistikReiter", "charakterReiter", "charakterKopf", "routen", "datenschutz", "impressumSeite", "datenschutzSeite",
] as const;

function isLegacy(e: AnyUiExtension): e is OberflaechenErweiterung {
  return LEGACY_KEYS.some((key) => Object.hasOwn(e, key));
}

/** A 2.x component with the props `daten` and `view` as a component with `data` and `view`. */
function withDataProp(Legacy: ComponentType<CharakterDatenProps>): ComponentType<CharacterDataProps> {
  const Wrapped = ({ data, view }: CharacterDataProps) => <Legacy daten={data} view={view} />;
  Wrapped.displayName = Legacy.displayName ?? Legacy.name ?? "LegacyExtensionComponent";
  return Wrapped;
}

/**
 * A module in the 3.0 shape, converted if it still has 2.x member names. A module halfway through its upgrade may
 * have both; then the 3.0 member wins and the 2.x one fills the gaps.
 */
export function toUiExtension(e: AnyUiExtension): UiExtension {
  if (!isLegacy(e)) return e;
  const current = e as Partial<UiExtension>;
  return {
    id: e.id,
    statsTabs:
      current.statsTabs ?? e.statistikReiter?.map((tab) => ({ id: tab.id, label: tab.label, Component: tab.Komponente })),
    characterTabs:
      current.characterTabs ??
      e.charakterReiter?.map((tab) => ({ id: tab.id, label: tab.label, Component: withDataProp(tab.Komponente) })),
    characterHeader: current.characterHeader ?? (e.charakterKopf && withDataProp(e.charakterKopf)),
    routes: current.routes ?? e.routen?.map((route) => ({ path: route.pfad, Component: route.Komponente })),
    privacy: current.privacy ?? e.datenschutz,
    imprintPage: current.imprintPage ?? e.impressumSeite,
    privacyPage: current.privacyPage ?? e.datenschutzSeite,
  };
}
