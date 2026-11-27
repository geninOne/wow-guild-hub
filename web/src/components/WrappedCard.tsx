import { useState } from "react";
import type { WrappedView } from "../../../src/api/types";
import { useApi } from "../lib/api";
import { formatPlainDate, formatPlainDayMonth, hourRange, monthLabel, weekLabel, weekdayNames } from "../lib/fun";
import { site } from "../lib/site";
import { useSprache, type Fassungen } from "../lib/sprache";
import { DataState } from "./DataState";
import { TitleBadge } from "./TitleBadge";
import { SampleDataNotice } from "./SampleDataNotice";

const T = {
  noData: { de: "noch keine Daten", en: "no data yet", schwaebisch: "no koine Date", bayrisch: "no koane Datn" },
  month: { de: "Monat", en: "Month", schwaebisch: "Monat", bayrisch: "Monat" },
  for: { de: "für", en: "for", schwaebisch: "für", bayrisch: "fia" },
  interim: { de: "Zwischenstand", en: "Interim result", schwaebisch: "Zwischestand", bayrisch: "Zwischnstand" },
  levelsGained: {
    de: (from: number, to: number) => `Level gewonnen, von ${from} auf ${to}`,
    en: (from: number, to: number) => `Levels gained, from ${from} to ${to}`,
    schwaebisch: (from: number, to: number) => `Level gwonne, vo ${from} auf ${to}`,
    bayrisch: (from: number, to: number) => `Level gwonna, vo ${from} auf ${to}`,
  },
  rank: {
    de: (place: number, of: number) => `Platz ${place} von ${of} in der Gemeinschaft`,
    en: (place: number, of: number) => `Rank ${place} of ${of} in the community`,
    schwaebisch: (place: number, of: number) => `Platz ${place} vo ${of} in dr Gmoinschaft`,
    bayrisch: (place: number, of: number) => `Platz ${place} vo ${of} in da Gmoaschaft`,
  },
  sinceServerStart: {
    de: (date: string) => `gezählt seit dem Serverstart am ${date}`,
    en: (date: string) => `counted since the server launch on ${date}`,
    schwaebisch: (date: string) => `zählt seit em Serverstart am ${date}`,
    bayrisch: (date: string) => `zählt seit'm Serverstart am ${date}`,
  },
  sinceJoining: {
    de: (date: string) => `gezählt seit dem Beitritt am ${date}`,
    en: (date: string) => `counted since joining on ${date}`,
    schwaebisch: (date: string) => `zählt seit em Beitritt am ${date}`,
    bayrisch: (date: string) => `zählt seit'm Beitritt am ${date}`,
  },
  noHistory: {
    de: "Für diesen Monat gibt es noch keinen Verlauf.",
    en: "No history for this month yet.",
    schwaebisch: "Für den Monat gibt's no koin Verlauf.",
    bayrisch: "Für den Monat gibt's no koan Verlauf.",
  },
  dungeons: { de: "Dungeons betreten", en: "Dungeons entered", schwaebisch: "Dungeons betrete", bayrisch: "Dungeons betretn" },
  recipes: { de: "Neue Rezepte", en: "New recipes", schwaebisch: "Neie Rezept", bayrisch: "Neie Rezepte" },
  professionPoints: { de: "Berufspunkte", en: "Profession points", schwaebisch: "Berufspunkte", bayrisch: "Berufspunkte" },
  itemLevel: { de: "Gegenstandsstufe", en: "Item level", schwaebisch: "Gegenstandsstufe", bayrisch: "Gegenstandsstufe" },
  current: { de: "aktueller Stand", en: "current value", schwaebisch: "aktueller Stand", bayrisch: "aktueller Stand" },
  deaths: { de: "Tode", en: "Deaths", schwaebisch: "Tode", bayrisch: "Tode" },
  immortal: { de: "unsterblich!", en: "immortal!", schwaebisch: "net kaputt z'kriege!", bayrisch: "ned umzbringa!" },
  activeDays: { de: "Aktive Tage", en: "Active days", schwaebisch: "Aktive Täg", bayrisch: "Aktive Tag" },
  logins: {
    de: (n: number) => `${n} ${n === 1 ? "Anmeldung" : "Anmeldungen"}`,
    en: (n: number) => `${n} ${n === 1 ? "login" : "logins"}`,
    schwaebisch: (n: number) => `${n} ${n === 1 ? "Anmeldung" : "Anmeldunge"}`,
    bayrisch: (n: number) => `${n} ${n === 1 ? "Anmeldung" : "Anmeldungen"}`,
  },
  favoriteTime: { de: "Lieblingszeit", en: "Favorite time", schwaebisch: "Lieblingszeit", bayrisch: "Lieblingszeit" },
  titlesOfMonth: { de: "Titel des Monats", en: "Titles of the month", schwaebisch: "Titel vom Monat", bayrisch: "Titel vom Monat" },
  noTitle: {
    de: "Diesmal kein Titel. Nächster Monat, nächste Chance.",
    en: "No title this time. Next month, next chance.",
    schwaebisch: "Desmol koi Titel. Nächschter Monat, nächschte Chance.",
    bayrisch: "Dasmoi koa Titel. Nächsta Monat, nächste Chance.",
  },
  footServerStart: {
    de: (start: string, asOf: string) => `Seit dem Serverstart am ${start}, Stand vom ${asOf}`,
    en: (start: string, asOf: string) => `Since the server launch on ${start}, as of ${asOf}`,
    schwaebisch: (start: string, asOf: string) => `Seit em Serverstart am ${start}, Stand vom ${asOf}`,
    bayrisch: (start: string, asOf: string) => `Seit'm Serverstart am ${start}, Stand vom ${asOf}`,
  },
  compared: {
    de: (from: string, to: string) => `Verglichen: ${from} und ${to}`,
    en: (from: string, to: string) => `Compared: ${from} and ${to}`,
    schwaebisch: (from: string, to: string) => `Vergliche: ${from} ond ${to}`,
    bayrisch: (from: string, to: string) => `Vaglicha: ${from} und ${to}`,
  },
  noDailySnapshot: {
    de: "Noch kein Tagesstand in diesem Monat",
    en: "No daily snapshot this month yet",
    schwaebisch: "No koi Tagesstand in dem Monat",
    bayrisch: "No koa Tagesstand in dem Monat",
  },
  wrapped: {
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
        {value ?? t(T.noData)}
      </strong>
      {note && <span className="wrapped-stat-note">{note}</span>}
    </li>
  );
}

/** Counter with sign; null without data. */
const count = (n: number | null, plus = true) => (n === null ? null : `${plus && n > 0 ? "+" : ""}${n}`);

function Card({ view, onMonth }: { view: WrappedView; onMonth(month: string): void }) {
  const { t, sprache } = useSprache();
  const c = view.character;
  const brand = t(T.wrapped)(site().name);
  return (
    <>
      <div className="wrapped-toolbar">
        <label className="wrapped-month">
          <span className="muted small">{t(T.month)}</span>
          <select className="filter-input" value={view.month} onChange={(e) => onMonth(e.target.value)} aria-label={t(T.month)}>
            {view.months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m, sprache)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <SampleDataNotice show={view.testdaten} />
      <article className="wrapped-card" aria-label={`${brand} ${monthLabel(view.month, sprache)} ${t(T.for)} ${c.name}`}>
        <header className="wrapped-head">
          <span className="wrapped-brand">{brand}</span>
          <h2 className="wrapped-name">{c.name}</h2>
          <p className="wrapped-month-label">
            {monthLabel(view.month, sprache)}
            {view.running && ` · ${t(T.interim)}`}
          </p>
        </header>

        <div className="wrapped-hero">
          <span className="wrapped-hero-value">{view.levels ? `+${view.levels.gained}` : "?"}</span>
          <span className="wrapped-hero-label">
            {view.levels ? (
              <>
                {t(T.levelsGained)(view.levels.start, view.levels.end)}
                {view.rank && (
                  <>
                    <br />
                    {t(T.rank)(view.rank.place, view.rank.of)}
                  </>
                )}
                {view.serverStart ? (
                  <>
                    <br />
                    {t(T.sinceServerStart)(formatPlainDayMonth(view.serverStart))}
                  </>
                ) : (
                  view.since && (
                    <>
                      <br />
                      {t(T.sinceJoining)(formatPlainDayMonth(view.since))}
                    </>
                  )
                )}
              </>
            ) : (
              t(T.noHistory)
            )}
          </span>
        </div>

        <ul className="wrapped-stats">
          <Stat label={t(T.dungeons)} value={count(view.dungeons, false)} />
          <Stat label={t(T.recipes)} value={count(view.recipes, false)} />
          <Stat label={t(T.professionPoints)} value={count(view.professionPoints)} />
          <Stat
            label={t(T.itemLevel)}
            value={count(view.itemLevel, !view.serverStart)}
            note={view.serverStart && view.itemLevel !== null ? t(T.current) : undefined}
          />
          <Stat label={t(T.deaths)} value={count(view.deaths, false)} note={view.deaths === 0 ? t(T.immortal) : undefined} />
          <Stat
            label={t(T.activeDays)}
            value={String(view.activeDays)}
            note={view.logins > 0 ? t(T.logins)(view.logins) : undefined}
          />
        </ul>

        <div className="wrapped-favorite">
          <span className="wrapped-stat-label">{t(T.favoriteTime)}</span>
          {view.favoriteHour !== null && view.favoriteWeekday !== null ? (
            <strong>
              {weekdayNames(sprache)[view.favoriteWeekday]}s, {hourRange(view.favoriteHour, sprache)}
            </strong>
          ) : (
            <strong className="wrapped-stat-none">{t(T.noData)}</strong>
          )}
        </div>

        <div className="wrapped-titles">
          <span className="wrapped-stat-label">{t(T.titlesOfMonth)}</span>
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
            <p className="muted">{t(T.noTitle)}</p>
          )}
        </div>

        <footer className="wrapped-foot muted small">
          {view.serverStart && view.to
            ? t(T.footServerStart)(formatPlainDate(view.serverStart), formatPlainDate(view.to))
            : view.from && view.to
            ? t(T.compared)(formatPlainDate(view.from), formatPlainDate(view.to))
            : t(T.noDailySnapshot)}
        </footer>
      </article>
    </>
  );
}

/** Monthly summary of a character with month selection. */
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
