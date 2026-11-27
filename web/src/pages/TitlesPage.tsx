import { useEffect, useState, type MouseEvent } from "react";
import { Link } from "react-router";
import type { TitleAwardView, TitleRankingView, TitlesView, TitleWeekView } from "../../../src/api/types";
import { CharacterLink } from "../components/CharacterLink";
import { DataState } from "../components/DataState";
import { FactionCrest } from "../components/FactionCrest";
import { MemberListDialog, MemberListTrigger, PeopleIcon, type MemberSet } from "../components/MemberList";
import { TitleBadge } from "../components/TitleBadge";
import { SampleDataNotice } from "../components/SampleDataNotice";
import { useApi } from "../lib/api";
import { PUBLISHED_WHEN, formatPlainDayMonth, weekRangeLabel, newspaperName } from "../lib/fun";
import { useLanguage, type Translations } from "../lib/language";
import { numberLocale } from "../lib/format";

const T = {
  nobody: { de: "Diese Woche niemand", en: "Nobody this week", schwaebisch: "Die Woch koiner", bayrisch: "De Woch koana" },
  ruleFor: { de: "Regel für", en: "Rule for", schwaebisch: "Regel für", bayrisch: "Regel fia" },
  hallOfFame: { de: "Ehrentafel der Vorwochen", en: "Hall of Fame: Previous Weeks", schwaebisch: "Ehretafel vo de Vorwoche", bayrisch: "Ehrntafel vo de Vorwochn" },
  newer: { de: "‹ neuere Wochen", en: "‹ newer weeks", schwaebisch: "‹ neuere Woche", bayrisch: "‹ neiere Wochn" },
  older: { de: "ältere Wochen ›", en: "older weeks ›", schwaebisch: "ältere Woche ›", bayrisch: "ältere Wochn ›" },
  title: { de: "Titel", en: "Title", schwaebisch: "Titel", bayrisch: "Titel" },
  to: { de: "bis", en: "to", schwaebisch: "bis", bayrisch: "bis" },
  notAwarded: { de: "nicht vergeben", en: "not awarded", schwaebisch: "net vergebe", bayrisch: "ned vergebn" },
  firstWeek: {
    de: (when: string) => `Die erste Woche ist noch nicht ausgewertet. Neue Titel gibt es ${when} für die Woche bis Samstag.`,
    en: (when: string) => `The first week has not been scored yet. New titles arrive ${when} for the week ending Saturday.`,
    schwaebisch: (when: string) => `Die erscht Woch isch no net ausgwertet. Neie Titel gibt's ${when} für d'Woch bis Samschdig.`,
    bayrisch: (when: string) => `De erste Woch is no ned ausgwertet. Neie Titel gibt's ${when} für de Woch bis Samstag.`,
  },
  toNewspaper: {
    de: (paper: string) => `${paper} dieser Woche lesen`,
    en: (paper: string) => `Read this week's ${paper}`,
    schwaebisch: (paper: string) => `zum ${paper} vo dere Woch`,
    bayrisch: (paper: string) => `zum ${paper} vo dera Woch`,
  },
  rules: {
    de: "Die Titel werden einmal pro Woche nach festen Regeln vergeben, gewertet wird Sonntag bis Samstag. Bei Gleichstand teilen sich alle den Titel. Auf der Karte steht, wer ihn am längsten nicht hatte, sonst entscheidet ein fester Zufall. Wer keine Titel möchte, sagt der Gildenleitung Bescheid. Die Regel eines Titels zeigt das Fragezeichen an seiner Kachel.",
    en: "Titles are awarded once a week by fixed rules, counting Sunday to Saturday. On a tie, everyone shares the title. The card shows whoever has gone longest without it, otherwise a fixed random draw decides. If you would rather not receive titles, let the guild officers know. The question mark on each tile shows that title's rule.",
    schwaebisch:
      "D'Titel gibt's oimol in dr Woch nach feschte Regle, gwertet wird Sonndig bis Samschdig. Bei Gleichstand teilet sich älle dr Titel. Auf dr Kachel stoht, wer'n am längschte net ghabt hot, sonscht entscheidet a feschter Zufall. Wer koine Titel will, sagt dr Gildeleitung Bscheid. D'Regel vo me Titel zeigt s'Frogezeiche an seiner Kachel.",
    bayrisch:
      "De Titel gibt's oamoi in da Woch nach festn Regln, gwertet werd Sonntag bis Samstag. Bei Gleichstand teilen se se olle an Titel. Auf da Kachl steht, wer'n am längstn ned ghabt hod, sonst entscheidt a fester Zufall. Wer koane Titel mog, sogt's da Gildnleitung. De Regel vo am Titel zeigt des Fragezeichn an seiner Kachl.",
  },
  shared: {
    de: (n: number) => (n === 1 ? "teilt sich den Titel mit einem weiteren" : `teilt sich den Titel mit ${n} weiteren`),
    en: (n: number) => (n === 1 ? "shares the title with one other" : `shares the title with ${n} others`),
    schwaebisch: (n: number) => (n === 1 ? "teilt sich dr Titel mit oim andre" : `teilt sich dr Titel mit ${n} andre`),
    bayrisch: (n: number) => (n === 1 ? "teilt se an Titel mit oam andan" : `teilt se an Titel mit ${n} andane`),
  },
  tie: {
    de: "Gleichstand: Alle mit dem Höchstwert teilen sich den Titel. Hier steht, wer ihn am längsten nicht hatte, sonst entscheidet ein fester Zufall.",
    en: "Tie: everyone with the top value shares the title. Shown here is whoever has gone longest without it, otherwise a fixed random draw decides.",
    schwaebisch: "Gleichstand: Älle mit em Höchschtwert teilet sich dr Titel. Do stoht, wer'n am längschte net ghabt hot, sonscht entscheidet a feschter Zufall.",
    bayrisch: "Gleichstand: Olle mit am Höchstwert teilen se an Titel. Do steht, wer'n am längstn ned ghabt hod, sonst entscheidt a fester Zufall.",
  },
  ranking: { de: "Rangliste ansehen", en: "View ranking", schwaebisch: "Ranglischt aagucke", bayrisch: "Ranglistn oschaun" },
  rankingOf: {
    de: (title: string, week: string) => `Rangliste ${title}, ${week}`,
    en: (title: string, week: string) => `Ranking ${title}, ${week}`,
    schwaebisch: (title: string, week: string) => `Ranglischt ${title}, ${week}`,
    bayrisch: (title: string, week: string) => `Ranglistn ${title}, ${week}`,
  },
  value: { de: "Wert", en: "Value", schwaebisch: "Wert", bayrisch: "Wert" },
  winner: { de: "Gewinner", en: "Winner", schwaebisch: "Gwinner", bayrisch: "Gwinner" },
  winnerOnly: {
    de: "Für diese Woche ist nur der Gewinner gespeichert, die ganze Rangliste gibt es erst für neuere Wochen.",
    en: "Only the winner is stored for this week; full rankings exist only for more recent weeks.",
    schwaebisch: "Für die Woch isch bloß dr Gwinner gspeichert, d'ganze Ranglischt gibt's erscht für neiere Woche.",
    bayrisch: "Für de Woch is bloß da Gwinner gspeichert, de ganze Ranglistn gibt's erst für neiere Wochn.",
  },
  pageTitle: { de: "Titel der Woche", en: "Titles of the Week", schwaebisch: "Titel vo dr Woch", bayrisch: "Titel vo da Woch" },
  publishedBefore: {
    de: (paper: string) => `Neue Titel und eine neue Ausgabe von ${paper} gibt es `,
    en: (paper: string) => `New titles and a new issue of ${paper} arrive `,
    schwaebisch: (paper: string) => `Neie Titel ond a neis ${paper} gibt's `,
    bayrisch: (paper: string) => `Neie Titel und a neis ${paper} gibt's `,
  },
  publishedAfter: {
    de: ", gewertet wird Sonntag bis Samstag.",
    en: ", counting Sunday to Saturday.",
    schwaebisch: ", gwertet wird Sonndig bis Samschdig.",
    bayrisch: ", gwertet werd Sonntag bis Samstag.",
  },
} satisfies Record<string, Translations<unknown>>;

/** Page size of the hall of fame: 5 weeks, 3 on narrow screens. */
function useWeeksPerPage(): number {
  const query = "(max-width: 640px)";
  const get = () => (typeof window !== "undefined" && window.matchMedia?.(query).matches ? 3 : 5);
  const [perPage, setPerPage] = useState(get);
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return;
    const update = () => setPerPage(media.matches ? 3 : 5);
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);
  return perPage;
}

type Title = TitlesView["titles"][number];

/** Can the ranking of a title for the week be shown? Always with a winner, otherwise only with a stored ranking. */
const hasRanking = (week: TitleWeekView, award: TitleAwardView | undefined) => award !== undefined || week.ranked;

/** A click anywhere on the tile opens the ranking, except on links and buttons inside it (as with the stat cards). */
function onTileClick(open: () => void) {
  return (event: MouseEvent<HTMLElement>) => {
    if (event.target instanceof Element && event.target.closest("a, button")) return;
    if (window.getSelection?.()?.toString()) return;
    open();
  };
}

/** Path for the ranking of a title in a week. */
export function titleRankingPath(titleId: string, week: string): string {
  return `/api/titles?title=${encodeURIComponent(titleId)}&week=${encodeURIComponent(week)}`;
}

/** Set for the member list: value as text like on the tile, all holders highlighted equally. */
export function titleRankingSet(title: Title, data: TitleRankingView, t: <V>(f: Translations<V>) => V): MemberSet {
  return {
    key: title.id,
    label: t(title.name),
    valueLabel: t(T.value),
    entries: data.entries,
    textValue: true,
    formatValue: (v) => {
      const text = data.valueTexts[String(v)];
      return text ? t(text) : v.toLocaleString(numberLocale());
    },
    ...(data.winnerIds.length > 0 ? { highlight: { ids: data.winnerIds, label: t(T.winner) } } : {}),
  };
}

/** Loads the ranking only when opened and shows it in the member list. */
function TitleRankingDialog({ title, week, onClose }: { title: Title; week: TitleWeekView; onClose(): void }) {
  const { t, language } = useLanguage();
  const { data, error } = useApi<TitleRankingView>(titleRankingPath(title.id, week.week));
  const range = weekRangeLabel(week.from, week.to, language);
  return (
    <MemberListDialog
      title={t(title.name)}
      subtitle={data && !data.complete ? `${range}. ${t(T.winnerOnly)}` : range}
      sets={data ? [titleRankingSet(title, data, t)] : null}
      error={error}
      guild={null}
      onClose={onClose}
    />
  );
}

function Tile({
  title,
  award,
  week,
  view,
  onOpen,
}: {
  title: Title;
  award: TitleAwardView | undefined;
  week: TitleWeekView;
  view: TitlesView;
  onOpen(): void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ruleId = `regel-${title.id}`;
  const clickable = hasRanking(week, award);
  return (
    <li
      className={`title-tile${award ? "" : " title-tile-empty"}${clickable ? " title-tile-clickable" : ""}`}
      title={t(title.description)}
      onClick={clickable ? onTileClick(onOpen) : undefined}
    >
      <TitleBadge titleId={title.id} name={title.name} size={92} muted={!award} decorative />
      <span className="title-tile-name">{t(title.name)}</span>
      {award ? (
        <>
          <strong className="title-tile-winner guild-cell">
            <FactionCrest faction={view.guilds?.find((g) => g.slug === award.character.guildSlug)?.faction ?? ""} size={18} />
            <CharacterLink character={award.character} />
          </strong>
          <span className="title-tile-value">{t(award.valueText)}</span>
          {award.sharedWith > 0 && (
            <button type="button" className="title-tile-shared" aria-haspopup="dialog" onClick={onOpen}>
              {t(T.shared)(award.sharedWith)}
            </button>
          )}
        </>
      ) : (
        <span className="title-tile-value muted">{t(T.nobody)}</span>
      )}
      <button
        type="button"
        className="title-tile-info"
        aria-expanded={open}
        aria-controls={ruleId}
        aria-label={`${t(T.ruleFor)} ${t(title.name)}`}
        onClick={() => setOpen((o) => !o)}
      >
        ?
      </button>
      {clickable && (
        <MemberListTrigger className="title-tile-trigger" label={`${t(T.ranking)}: ${t(title.name)}`} onClick={onOpen}>
          {t(T.ranking)}
        </MemberListTrigger>
      )}
      <span id={ruleId} className={open ? "title-tile-rule title-tile-rule-open" : "title-tile-rule"}>
        {t(title.description)}
        {award && award.sharedWith > 0 && <span className="title-tile-rule-tie">{t(T.tie)}</span>}
      </span>
    </li>
  );
}

/** Hall of fame: one row per title, one column per week, newest on the left; pages through weeks. */
function HonorTable({ view, onOpen }: { view: TitlesView; onOpen(title: Title, week: TitleWeekView): void }) {
  const { t, language } = useLanguage();
  const perPage = useWeeksPerPage();
  const [start, setStart] = useState(0);
  const weeks = view.history;
  const first = Math.min(start, Math.max(0, weeks.length - perPage));
  const shown = weeks.slice(first, first + perPage);
  const older = first + perPage < weeks.length;
  const newer = first > 0;
  return (
    <div className="panel panel-flush honor">
      <header className="panel-header">
        <h2 className="panel-title">{t(T.hallOfFame)}</h2>
        {(older || newer) && (
          <span className="honor-nav">
            <button type="button" className="honor-nav-button" disabled={!newer} onClick={() => setStart(Math.max(0, first - perPage))}>
              {t(T.newer)}
            </button>
            <button type="button" className="honor-nav-button" disabled={!older} onClick={() => setStart(first + perPage)}>
              {t(T.older)}
            </button>
          </span>
        )}
      </header>
      <table className="table honor-table">
        <colgroup>
          <col className="honor-col-title" />
          {shown.map((w) => (
            <col key={w.week} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th scope="col">{t(T.title)}</th>
            {shown.map((w) => (
              <th key={w.week} scope="col" className="honor-week">
                <Link to={`/zeitung/${w.week}`} aria-label={weekRangeLabel(w.from, w.to, language)}>
                  {formatPlainDayMonth(w.from)}
                </Link>
                <span className="honor-week-date">
                  {t(T.to)} {formatPlainDayMonth(w.to)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.titles.map((title) => (
            <tr key={title.id}>
              <th scope="row" className="honor-title">
                <TitleBadge titleId={title.id} name={title.name} size={34} decorative />
                <span className="honor-title-name">{t(title.name)}</span>
              </th>
              {shown.map((w) => {
                const a = w.awards.find((x) => x.titleId === title.id);
                return (
                  <td key={w.week} className="honor-cell">
                    <span className="honor-cell-inner">
                      {a ? (
                        <span
                          className="honor-winner"
                          title={a.sharedWith > 0 ? `${t(a.valueText)}, ${t(T.shared)(a.sharedWith)}` : t(a.valueText)}
                        >
                          <CharacterLink character={a.character} />
                        </span>
                      ) : (
                        <span className="honor-none" role="img" aria-label={t(T.notAwarded)} />
                      )}
                      {hasRanking(w, a) && (
                        <button
                          type="button"
                          className="honor-ranking"
                          aria-haspopup="dialog"
                          aria-label={t(T.rankingOf)(t(title.name), weekRangeLabel(w.from, w.to, language))}
                          title={t(T.ranking)}
                          onClick={() => onOpen(title, w)}
                        >
                          <PeopleIcon />
                        </button>
                      )}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TitlesContent({ view }: { view: TitlesView }) {
  const { t, language } = useLanguage();
  const [ranking, setRanking] = useState<{ title: Title; week: TitleWeekView } | null>(null);
  const current = view.current;
  if (!current) {
    return (
      <div className="state state-empty" role="status">
        <p>{t(T.firstWeek)(t(PUBLISHED_WHEN))}</p>
      </div>
    );
  }
  return (
    <>
      <p className="page-subtitle muted">
        {weekRangeLabel(current.from, current.to, language)} ·{" "}
        <Link to={`/zeitung/${current.week}`}>{t(T.toNewspaper)(newspaperName(language))}</Link>
      </p>
      <SampleDataNotice show={view.testdaten} />
      <ul className="title-tiles">
        {view.titles.map((title) => (
          <Tile
            key={title.id}
            title={title}
            award={current.awards.find((a) => a.titleId === title.id)}
            week={current}
            view={view}
            onOpen={() => setRanking({ title, week: current })}
          />
        ))}
      </ul>
      {view.history.length > 0 && <HonorTable view={view} onOpen={(title, week) => setRanking({ title, week })} />}
      {ranking && <TitleRankingDialog title={ranking.title} week={ranking.week} onClose={() => setRanking(null)} />}
      <p className="muted small">{t(T.rules)}</p>
    </>
  );
}

export function TitlesPage() {
  const { t, language } = useLanguage();
  const { data, error, loading } = useApi<TitlesView>("/api/titles");
  return (
    <section className="page">
      <header className="page-header">
        <h1 className="page-title">{t(T.pageTitle)}</h1>
        <p className="erscheint-hint">
          {t(T.publishedBefore)(newspaperName(language))}
          <strong>{t(PUBLISHED_WHEN)}</strong>
          {t(T.publishedAfter)}
        </p>
      </header>
      <DataState loading={loading} error={error}>
        {data && <TitlesContent view={data} />}
      </DataState>
    </section>
  );
}
