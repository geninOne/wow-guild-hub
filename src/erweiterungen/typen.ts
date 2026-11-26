// Schnittstellen für Module (Erweiterungen) auf dem Server. Ein Modul meldet sich in `index.ts` an und hängt sich
// an feste Stellen: eigene API-Routen, Zusatzdaten für die Charakterseite und Meldungen für die Wochenzeitung.
// Anleitung: docs/erweiterungen.md.
import type { GuildRecord, MemberSummary } from "../model";
import type { Fassungen } from "../sprache";
import type { JsonStore } from "../store";
import type { ErweiterungsFakt } from "../weekly/zeitung-facts";

/** Was der Server einer Erweiterung von außen durchreicht (auf Netlify aus der Function `api.mts`). */
export interface ErweiterungsUmgebung {
  /** Umgebungsvariablen; auf Netlify `process.env`. Jede Erweiterung liest nur ihre eigenen. */
  env: Readonly<Record<string, string | undefined>>;
  /** IP des Aufrufers (auf Netlify `context.ip`), null, wenn unbekannt. */
  clientIp: string | null;
  /** Leert den CDN-Cache für diese Cache-Tags (auf Netlify `purgeCache`); fehlt lokal und in Tests. */
  purgeCache?: (tags: string[]) => Promise<void>;
}

export interface ApiKontext extends ErweiterungsUmgebung {
  store: JsonStore;
  now: () => Date;
}

export interface CharakterKontext {
  store: JsonStore;
  guild: GuildRecord;
  member: MemberSummary;
}

export interface WochenKontext {
  store: JsonStore;
  guild: GuildRecord;
  /** Erster und letzter Tag der gewerteten Woche (Berliner Datum, `YYYY-MM-DD`). */
  from: string;
  to: string;
  /** Charaktere, die zählen: aktive Mitglieder ohne die von der Titel-Abmeldeliste. */
  ids: ReadonlySet<number>;
}

export interface ServerErweiterung {
  /** Eindeutige Kennung, etwa `"umfragen"`; Schlüssel der Zusatzdaten in `CharacterView.erweiterungen`. */
  id: string;
  /**
   * Eigene Routen unter `/api`. Kommt vor den Routen des Kerns dran, für jede Methode (auch POST). `pfad` ist ohne
   * Schrägstrich am Ende, etwa `/api/umfragen`. Liefert eine Antwort oder null, wenn die Erweiterung nicht zuständig ist.
   */
  api?(req: Request, pfad: string, kontext: ApiKontext): Promise<Response | null>;
  /** Zusatzdaten für die Charakter-API, landen unter `view.erweiterungen[id]`; null oder undefined lässt das Feld weg. */
  charakter?(kontext: CharakterKontext): Promise<unknown>;
  /** Cache-Tags, die jede Charakterantwort trägt, damit die Erweiterung sie über `purgeCache` erneuern kann. */
  charakterCacheTags?: string[];
  /** Meldungen für die Wochenzeitung; sie konkurrieren mit den eigenen um die Plätze. */
  wochenArtikel?(kontext: WochenKontext): Promise<ErweiterungsFakt[]>;
  /** Namen eigener Rubriken je Sprache, Schlüssel ist der deutsche Name aus `ErweiterungsFakt.rubrik`. */
  rubriken?: Record<string, Fassungen>;
}
