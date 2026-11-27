import { useState } from "react";
import type { WrappedView } from "../../../src/api/types";
import { useApi } from "../lib/api";
import { formatPlainDate, formatPlainDayMonth, hourRange, monthLabel, weekLabel, weekdayNames } from "../lib/fun";
import { site } from "../lib/site";
import { useSprache, type Fassungen } from "../lib/sprache";
import { DataState } from "./DataState";
import { TitleBadge } from "./TitleBadge";
import { TestdatenHinweis } from "./TestdatenHinweis";

const T = {
  keineDaten: { de: "noch keine Daten", en: "no data yet", schwaebisch: "no koine Date", bayrisch: "no koane Datn" },
  monat: { de: "Monat", en: "Month", schwaebisch: "Monat", bayrisch: "Monat" },
  fuer: { de: "für", en: "for", schwaebisch: "für", bayrisch: "fia" },
  zwischenstand: { de: "Zwischenstand", en: "Interim result", schwaebisch: "Zwischestand", bayrisch: "Zwischnstand" },
  gewonnen: {
    de: (von: number, auf: number) => `Level gewonnen, von ${von} auf ${auf}`,
    en: (von: number, auf: number) => `Levels gained, from ${von} to ${auf}`,
    schwaebisch: (von: number, auf: number) => `Level gwonne, vo ${von} auf ${auf}`,
    bayrisch: (von: number, auf: number) => `Level gwonna, vo ${von} auf ${auf}`,
  },
  platz: {
    de: (platz: number, von: number) => `Platz ${platz} von ${von} in der Gemeinschaft`,
    en: (platz: number, von: number) => `Rank ${platz} of ${von} in the community`,
    schwaebisch: (platz: number, von: number) => `Platz ${platz} vo ${von} in dr Gmoinschaft`,
    bayrisch: (platz: number, von: number) => `Platz ${platz} vo ${von} in da Gmoaschaft`,
  },
  seitServerstart: {
    de: (datum: string) => `gezählt seit dem Serverstart am ${datum}`,
    en: (datum: string) => `counted since the server launch on ${datum}`,
    schwaebisch: (datum: string) => `zählt seit em Serverstart am ${datum}`,
    bayrisch: (datum: string) => `zählt seit'm Serverstart am ${datum}`,
  },
  seitBeitritt: {
    de: (datum: string) => `gezählt seit dem Beitritt am ${datum}`,
    en: (datum: string) => `counted since joining on ${datum}`,
    schwaebisch: (datum: string) => `zählt seit em Beitritt am ${datum}`,
    bayrisch: (datum: string) => `zählt seit'm Beitritt am ${datum}`,
  },
  keinVerlauf: {
    de: "Für diesen Monat gibt es noch keinen Verlauf.",
    en: "No history for this month yet.",
    schwaebisch: "Für den Monat gibt's no koin Verlauf.",
    bayrisch: "Für den Monat gibt's no koan Verlauf.",
  },
  dungeons: { de: "Dungeons betreten", en: "Dungeons entered", schwaebisch: "Dungeons betrete", bayrisch: "Dungeons betretn" },
  rezepte: { de: "Neue Rezepte", en: "New recipes", schwaebisch: "Neie Rezept", bayrisch: "Neie Rezepte" },
  berufspunkte: { de: "Berufspunkte", en: "Profession points", schwaebisch: "Berufspunkte", bayrisch: "Berufspunkte" },
  gegenstandsstufe: { de: "Gegenstandsstufe", en: "Item level", schwaebisch: "Gegenstandsstufe", bayrisch: "Gegenstandsstufe" },
  aktuell: { de: "aktueller Stand", en: "current value", schwaebisch: "aktueller Stand", bayrisch: "aktueller Stand" },
  tode: { de: "Tode", en: "Deaths", schwaebisch: "Tode", bayrisch: "Tode" },
  unsterblich: { de: "unsterblich!", en: "immortal!", schwaebisch: "net kaputt z'kriege!", bayrisch: "ned umzbringa!" },
  aktiveTage: { de: "Aktive Tage", en: "Active days", schwaebisch: "Aktive Täg", bayrisch: "Aktive Tag" },
  anmeldungen: {
    de: (n: number) => `${n} ${n === 1 ? "Anmeldung" : "Anmeldungen"}`,
    en: (n: number) => `${n} ${n === 1 ? "login" : "logins"}`,
    schwaebisch: (n: number) => `${n} ${n === 1 ? "Anmeldung" : "Anmeldunge"}`,
    bayrisch: (n: number) => `${n} ${n === 1 ? "Anmeldung" : "Anmeldungen"}`,
  },
  lieblingszeit: { de: "Lieblingszeit", en: "Favorite time", schwaebisch: "Lieblingszeit", bayrisch: "Lieblingszeit" },
  titelDesMonats: { de: "Titel des Monats", en: "Titles of the month", schwaebisch: "Titel vom Monat", bayrisch: "Titel vom Monat" },
  keinTitel: {
    de: "Diesmal kein Titel. Nächster Monat, nächste Chance.",
    en: "No title this time. Next month, next chance.",
    schwaebisch: "Desmol koi Titel. Nächschter Monat, nächschte Chance.",
    bayrisch: "Dasmoi koa Titel. Nächsta Monat, nächste Chance.",
  },
  fussServerstart: {
    de: (start: string, stand: string) => `Seit dem Serverstart am ${start}, Stand vom ${stand}`,
    en: (start: string, stand: string) => `Since the server launch on ${start}, as of ${stand}`,
    schwaebisch: (start: string, stand: string) => `Seit em Serverstart am ${start}, Stand vom ${stand}`,
    bayrisch: (start: string, stand: string) => `Seit'm Serverstart am ${start}, Stand vom ${stand}`,
  },
  verglichen: {
    de: (von: string, bis: string) => `Verglichen: ${von} und ${bis}`,
    en: (von: string, bis: string) => `Compared: ${von} and ${bis}`,
    schwaebisch: (von: string, bis: string) => `Vergliche: ${von} ond ${bis}`,
    bayrisch: (von: string, bis: string) => `Vaglicha: ${von} und ${bis}`,
  },
  keinTagesstand: {
    de: "Noch kein Tagesstand in diesem Monat",
    en: "No daily snapshot this month yet",
    schwaebisch: "No koi Tagesstand in dem Monat",
    bayrisch: "No koa Tagesstand in dem Monat",
  },
  rueckblick: {
    de: (name: string) => `${name}-Rückblick`,
    en: (name: string) => `${name} Wrapped`,
  },
} satisfies Record<string, Fassungen<unknown>>;

function Stat({ label, value, note }: { label: string; value: string | null; note?: string }) {
  const { t } = useSprache();
  return (
    <li className="wrapped-stat">
      <span className="wrapped-stat-label">{label}</span>
      <strong className={value === null ? "wrapped-stat-value wrapped-stat-none" : "wrapped-stat-value"}>
        {value ?? t(T.keineDaten)}
      </strong>
      {note && <span className="wrapped-stat-note">{note}</span>}
    </li>
  );
}

/** Zähler mit Vorzeichen; null ohne Daten. */
const count = (n: number | null, plus = true) => (n === null ? null : `${plus && n > 0 ? "+" : ""}${n}`);

function Card({ view, onMonth }: { view: WrappedView; onMonth(month: string): void }) {
  const { t, sprache } = useSprache();
  const c = view.character;
  const marke = t(T.rueckblick)(site().name);
  return (
    <>
      <div className="wrapped-toolbar">
        <label className="wrapped-month">
          <span className="muted small">{t(T.monat)}</span>
          <select className="filter-input" value={view.month} onChange={(e) => onMonth(e.target.value)} aria-label={t(T.monat)}>
            {view.months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m, sprache)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <TestdatenHinweis show={view.testdaten} />
      <article className="wrapped-card" aria-label={`${marke} ${monthLabel(view.month, sprache)} ${t(T.fuer)} ${c.name}`}>
        <header className="wrapped-head">
          <span className="wrapped-brand">{marke}</span>
          <h2 className="wrapped-name">{c.name}</h2>
          <p className="wrapped-month-label">
            {monthLabel(view.month, sprache)}
            {view.running && ` · ${t(T.zwischenstand)}`}
          </p>
        </header>

        <div className="wrapped-hero">
          <span className="wrapped-hero-value">{view.levels ? `+${view.levels.gained}` : "?"}</span>
          <span className="wrapped-hero-label">
            {view.levels ? (
              <>
                {t(T.gewonnen)(view.levels.start, view.levels.end)}
                {view.rank && (
                  <>
                    <br />
                    {t(T.platz)(view.rank.place, view.rank.of)}
                  </>
                )}
                {view.serverStart ? (
                  <>
                    <br />
                    {t(T.seitServerstart)(formatPlainDayMonth(view.serverStart))}
                  </>
                ) : (
                  view.since && (
                    <>
                      <br />
                      {t(T.seitBeitritt)(formatPlainDayMonth(view.since))}
                    </>
                  )
                )}
              </>
            ) : (
              t(T.keinVerlauf)
            )}
          </span>
        </div>

        <ul className="wrapped-stats">
          <Stat label={t(T.dungeons)} value={count(view.dungeons, false)} />
          <Stat label={t(T.rezepte)} value={count(view.recipes, false)} />
          <Stat label={t(T.berufspunkte)} value={count(view.professionPoints)} />
          <Stat
            label={t(T.gegenstandsstufe)}
            value={count(view.itemLevel, !view.serverStart)}
            note={view.serverStart && view.itemLevel !== null ? t(T.aktuell) : undefined}
          />
          <Stat label={t(T.tode)} value={count(view.deaths, false)} note={view.deaths === 0 ? t(T.unsterblich) : undefined} />
          <Stat
            label={t(T.aktiveTage)}
            value={String(view.activeDays)}
            note={view.logins > 0 ? t(T.anmeldungen)(view.logins) : undefined}
          />
        </ul>

        <div className="wrapped-favorite">
          <span className="wrapped-stat-label">{t(T.lieblingszeit)}</span>
          {view.favoriteHour !== null && view.favoriteWeekday !== null ? (
            <strong>
              {weekdayNames(sprache)[view.favoriteWeekday]}s, {hourRange(view.favoriteHour, sprache)}
            </strong>
          ) : (
            <strong className="wrapped-stat-none">{t(T.keineDaten)}</strong>
          )}
        </div>

        <div className="wrapped-titles">
          <span className="wrapped-stat-label">{t(T.titelDesMonats)}</span>
          {view.titles.length > 0 ? (
            <ul className="wrapped-title-list">
              {view.titles.map((title) => (
                <li key={`${title.week}-${title.titleId}`}>
                  <TitleBadge titleId={title.titleId} name={title.name} size={48} decorative />
                  <span>
                    <span className="badge-gold">{t(title.name)}</span>{" "}
                    <span className="muted small">
                      {weekLabel(title.from, title.to, sprache)}, {t(title.valueText)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">{t(T.keinTitel)}</p>
          )}
        </div>

        <footer className="wrapped-foot muted small">
          {view.serverStart && view.to
            ? t(T.fussServerstart)(formatPlainDate(view.serverStart), formatPlainDate(view.to))
            : view.from && view.to
            ? t(T.verglichen)(formatPlainDate(view.from), formatPlainDate(view.to))
            : t(T.keinTagesstand)}
        </footer>
      </article>
    </>
  );
}

/** Monatsbilanz eines Charakters mit Monatswahl. */
export function WrappedPanel({ slug }: { slug: string }) {
  const [month, setMonth] = useState<string | null>(null);
  const path = `/api/wrapped/${encodeURIComponent(slug)}${month ? `/${month}` : ""}`;
  const { data, error, loading } = useApi<WrappedView>(path);
  return (
    <DataState loading={loading} error={error}>
      {data && <Card view={data} onMonth={setMonth} />}
    </DataState>
  );
}
