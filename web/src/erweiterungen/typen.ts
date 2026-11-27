/**
 * Deprecated 2.x interface for interface modules (`OberflaechenErweiterung`), so modules written for 2.x keep working
 * unchanged. Modules registered in `./index.ts` with this shape are converted by `web/src/extensions/legacy.tsx`.
 * Removed in the major version after 3.0.0. New modules use `UiExtension` from `web/src/extensions/types.ts`.
 */
import type { ComponentType } from "react";
import type { CharacterView } from "../../../src/api/types";
import type { Fassungen } from "../lib/sprache";

/** Ein Reiter der Statistikseite unter `/statistik/<id>`, hinter den Reitern des Kerns. */
export interface StatistikReiter {
  id: string;
  label: Fassungen;
  /** Inhalt; `guild` ist die gewählte Gilde aus `?gilde=`, `onGuild` ändert sie. */
  Komponente: ComponentType<{ guild: string | null; onGuild: (guild: string | null) => void }>;
}

export interface CharakterDatenProps {
  /** Zusatzdaten des Servers aus `view.erweiterungen[id]`; undefined, wenn er keine geliefert hat. */
  daten: unknown;
  view: CharacterView;
}

/** Ein Reiter der Charakterseite (`?reiter=<id>`), hinter den Reitern des Kerns. */
export interface CharakterReiter {
  id: string;
  label: Fassungen;
  /**
   * Inhalt des Reiters, auch ohne Zusatzdaten (dann am besten ein Hinweis). Charaktere ohne Profil haben keine Reiter;
   * dort steht die Komponente unter dem Hinweis, aber nur mit Zusatzdaten.
   */
  Komponente: ComponentType<CharakterDatenProps>;
}

/** Eine eigene Seite. Für Netlify braucht der Pfad eine Weiterleitung auf `/index.html` in netlify.toml. */
export interface ErweiterungsRoute {
  /** Pfad wie bei react-router, etwa `/umfragen` oder `/umfragen/:id`. */
  pfad: string;
  Komponente: ComponentType;
}

export interface OberflaechenErweiterung {
  /** Dieselbe Kennung wie auf dem Server; Schlüssel der Zusatzdaten in `CharacterView.erweiterungen`. */
  id: string;
  statistikReiter?: StatistikReiter[];
  charakterReiter?: CharakterReiter[];
  /** Abzeichen in der Kopfzeile der Charakterseite, nur mit Zusatzdaten (`daten` ist dann gesetzt). */
  charakterKopf?: ComponentType<CharakterDatenProps>;
  routen?: ErweiterungsRoute[];
  /** Abschnitt der Datenschutzerklärung (mit eigener Überschrift `h2`), vor den Links zu anderen Seiten. */
  datenschutz?: ComponentType;
  /**
   * Eigenes Impressum statt der Platzhalter-Vorlage des Kerns. Es gilt das erste angemeldete Modul, das eines hat.
   * Die Seite erscheint wie die Vorlage nur mit `WEBSITE_IMPRINT_NAME`.
   */
  impressumSeite?: ComponentType;
  /** Eigene Datenschutzerklärung statt der Vorlage, sonst wie `impressumSeite`. */
  datenschutzSeite?: ComponentType;
}
