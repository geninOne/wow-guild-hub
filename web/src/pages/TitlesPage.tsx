import { useEffect, useState, type MouseEvent } from "react";
import { Link } from "react-router";
import type { TitleAwardView, TitleRankingView, TitlesView, TitleWeekView } from "../../../src/api/types";
import { CharacterLink } from "../components/CharacterLink";
import { DataState } from "../components/DataState";
import { FactionCrest } from "../components/FactionCrest";
import { MemberListDialog, MemberListTrigger, PeopleIcon, type MemberSet } from "../components/MemberList";
import { TitleBadge } from "../components/TitleBadge";
import { TestdatenHinweis } from "../components/TestdatenHinweis";
import { useApi } from "../lib/api";
import { ERSCHEINT_FASSUNGEN, formatPlainDayMonth, weekRangeLabel, newspaperName } from "../lib/fun";
import { useSprache, type Fassungen } from "../lib/sprache";
import { zahlLocale } from "../lib/format";

const T = {
  niemand: { de: "Diese Woche niemand", en: "Nobody this week", schwaebisch: "Die Woch koiner", bayrisch: "De Woch koana" },
  regelFuer: { de: "Regel für", en: "Rule for", schwaebisch: "Regel für", bayrisch: "Regel fia" },
  ehrentafel: { de: "Ehrentafel der Vorwochen", en: "Hall of Fame: Previous Weeks", schwaebisch: "Ehretafel vo de Vorwoche", bayrisch: "Ehrntafel vo de Vorwochn" },
  neuere: { de: "‹ neuere Wochen", en: "‹ newer weeks", schwaebisch: "‹ neuere Woche", bayrisch: "‹ neiere Wochn" },
  aeltere: { de: "ältere Wochen ›", en: "older weeks ›", schwaebisch: "ältere Woche ›", bayrisch: "ältere Wochn ›" },
  titel: { de: "Titel", en: "Title", schwaebisch: "Titel", bayrisch: "Titel" },
  bis: { de: "bis", en: "to", schwaebisch: "bis", bayrisch: "bis" },
  nichtVergeben: { de: "nicht vergeben", en: "not awarded", schwaebisch: "net vergebe", bayrisch: "ned vergebn" },
  ersteWoche: {
    de: (wann: string) => `Die erste Woche ist noch nicht ausgewertet. Neue Titel gibt es ${wann} für die Woche bis Samstag.`,
    en: (wann: string) => `The first week has not been scored yet. New titles arrive ${wann} for the week ending Saturday.`,
    schwaebisch: (wann: string) => `Die erscht Woch isch no net ausgwertet. Neie Titel gibt's ${wann} für d'Woch bis Samschdig.`,
    bayrisch: (wann: string) => `De erste Woch is no ned ausgwertet. Neie Titel gibt's ${wann} für de Woch bis Samstag.`,
  },
  zurZeitung: {
    de: (zeitung: string) => `${zeitung} dieser Woche lesen`,
    en: (zeitung: string) => `Read this week's ${zeitung}`,
    schwaebisch: (zeitung: string) => `zum ${zeitung} vo dere Woch`,
    bayrisch: (zeitung: string) => `zum ${zeitung} vo dera Woch`,
  },
  regeln: {
    de: "Die Titel werden einmal pro Woche nach festen Regeln vergeben, gewertet wird Sonntag bis Samstag. Bei Gleichstand teilen sich alle den Titel. Auf der Karte steht, wer ihn am längsten nicht hatte, sonst entscheidet ein fester Zufall. Wer keine Titel möchte, sagt der Gildenleitung Bescheid. Die Regel eines Titels zeigt das Fragezeichen an seiner Kachel.",
    en: "Titles are awarded once a week by fixed rules, counting Sunday to Saturday. On a tie, everyone shares the title. The card shows whoever has gone longest without it, otherwise a fixed random draw decides. If you would rather not receive titles, let the guild officers know. The question mark on each tile shows that title's rule.",
    schwaebisch:
      "D'Titel gibt's oimol in dr Woch nach feschte Regle, gwertet wird Sonndig bis Samschdig. Bei Gleichstand teilet sich älle dr Titel. Auf dr Kachel stoht, wer'n am längschte net ghabt hot, sonscht entscheidet a feschter Zufall. Wer koine Titel will, sagt dr Gildeleitung Bscheid. D'Regel vo me Titel zeigt s'Frogezeiche an seiner Kachel.",
    bayrisch:
      "De Titel gibt's oamoi in da Woch nach festn Regln, gwertet werd Sonntag bis Samstag. Bei Gleichstand teilen se se olle an Titel. Auf da Kachl steht, wer'n am längstn ned ghabt hod, sonst entscheidt a fester Zufall. Wer koane Titel mog, sogt's da Gildnleitung. De Regel vo am Titel zeigt des Fragezeichn an seiner Kachl.",
  },
  geteilt: {
    de: (n: number) => (n === 1 ? "teilt sich den Titel mit einem weiteren" : `teilt sich den Titel mit ${n} weiteren`),
    en: (n: number) => (n === 1 ? "shares the title with one other" : `shares the title with ${n} others`),
    schwaebisch: (n: number) => (n === 1 ? "teilt sich dr Titel mit oim andre" : `teilt sich dr Titel mit ${n} andre`),
    bayrisch: (n: number) => (n === 1 ? "teilt se an Titel mit oam andan" : `teilt se an Titel mit ${n} andane`),
  },
  gleichstand: {
    de: "Gleichstand: Alle mit dem Höchstwert teilen sich den Titel. Hier steht, wer ihn am längsten nicht hatte, sonst entscheidet ein fester Zufall.",
    en: "Tie: everyone with the top value shares the title. Shown here is whoever has gone longest without it, otherwise a fixed random draw decides.",
    schwaebisch: "Gleichstand: Älle mit em Höchschtwert teilet sich dr Titel. Do stoht, wer'n am längschte net ghabt hot, sonscht entscheidet a feschter Zufall.",
    bayrisch: "Gleichstand: Olle mit am Höchstwert teilen se an Titel. Do steht, wer'n am längstn ned ghabt hod, sonst entscheidt a fester Zufall.",
  },
  rangliste: { de: "Rangliste ansehen", en: "View ranking", schwaebisch: "Ranglischt aagucke", bayrisch: "Ranglistn oschaun" },
  ranglisteVon: {
    de: (titel: string, woche: string) => `Rangliste ${titel}, ${woche}`,
    en: (titel: string, woche: string) => `Ranking ${titel}, ${woche}`,
    schwaebisch: (titel: string, woche: string) => `Ranglischt ${titel}, ${woche}`,
    bayrisch: (titel: string, woche: string) => `Ranglistn ${titel}, ${woche}`,
  },
  wert: { de: "Wert", en: "Value", schwaebisch: "Wert", bayrisch: "Wert" },
  gewinner: { de: "Gewinner", en: "Winner", schwaebisch: "Gwinner", bayrisch: "Gwinner" },
  nurGewinner: {
    de: "Für diese Woche ist nur der Gewinner gespeichert, die ganze Rangliste gibt es erst für neuere Wochen.",
    en: "Only the winner is stored for this week; full rankings exist only for more recent weeks.",
    schwaebisch: "Für die Woch isch bloß dr Gwinner gspeichert, d'ganze Ranglischt gibt's erscht für neiere Woche.",
    bayrisch: "Für de Woch is bloß da Gwinner gspeichert, de ganze Ranglistn gibt's erst für neiere Wochn.",
  },
  seitentitel: { de: "Titel der Woche", en: "Titles of the Week", schwaebisch: "Titel vo dr Woch", bayrisch: "Titel vo da Woch" },
  erscheintVor: {
    de: (zeitung: string) => `Neue Titel und eine neue Ausgabe von ${zeitung} gibt es `,
    en: (zeitung: string) => `New titles and a new issue of ${zeitung} arrive `,
    schwaebisch: (zeitung: string) => `Neie Titel ond a neis ${zeitung} gibt's `,
    bayrisch: (zeitung: string) => `Neie Titel und a neis ${zeitung} gibt's `,
  },
  erscheintNach: {
    de: ", gewertet wird Sonntag bis Samstag.",
    en: ", counting Sunday to Saturday.",
    schwaebisch: ", gwertet wird Sonndig bis Samschdig.",
    bayrisch: ", gwertet werd Sonntag bis Samstag.",
  },
} satisfies Record<string, Fassungen<unknown>>;

/** Seitengröße der Ehrentafel: 5 Wochen, auf schmalen Bildschirmen 3. */
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

/** Lässt sich die Rangliste eines Titels in der Woche zeigen? Mit Gewinner immer, sonst nur mit gespeicherter Rangliste. */
const hasRanking = (week: TitleWeekView, award: TitleAwardView | undefined) => award !== undefined || week.ranked;

/** Klick irgendwo auf die Kachel öffnet die Rangliste, außer auf Links und Knöpfen darin (wie bei den Statistikkarten). */
function onTileClick(open: () => void) {
  return (event: MouseEvent<HTMLElement>) => {
    if (event.target instanceof Element && event.target.closest("a, button")) return;
    if (window.getSelection?.()?.toString()) return;
    open();
  };
}

/** Pfad für die Rangliste eines Titels in einer Woche. */
export function titleRankingPath(titleId: string, week: string): string {
  return `/api/titles?titel=${encodeURIComponent(titleId)}&woche=${encodeURIComponent(week)}`;
}

/** Menge für die Mitgliederliste: Wert als Text wie auf der Kachel, alle Inhaber gleich hervorgehoben. */
export function titleRankingSet(title: Title, data: TitleRankingView, t: <V>(f: Fassungen<V>) => V): MemberSet {
  return {
    key: title.id,
    label: t(title.name),
    valueLabel: t(T.wert),
    entries: data.entries,
    textValue: true,
    formatValue: (v) => {
      const text = data.valueTexts[String(v)];
      return text ? t(text) : v.toLocaleString(zahlLocale());
    },
    ...(data.winnerIds.length > 0 ? { highlight: { ids: data.winnerIds, label: t(T.gewinner) } } : {}),
  };
}

/** Lädt die Rangliste erst beim Öffnen und zeigt sie in der Mitgliederliste. */
function TitleRankingDialog({ title, week, onClose }: { title: Title; week: TitleWeekView; onClose(): void }) {
  const { t, sprache } = useSprache();
  const { data, error } = useApi<TitleRankingView>(titleRankingPath(title.id, week.week));
  const range = weekRangeLabel(week.from, week.to, sprache);
  return (
    <MemberListDialog
      title={t(title.name)}
      subtitle={data && !data.complete ? `${range}. ${t(T.nurGewinner)}` : range}
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
  const { t } = useSprache();
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
              {t(T.geteilt)(award.sharedWith)}
            </button>
          )}
        </>
      ) : (
        <span className="title-tile-value muted">{t(T.niemand)}</span>
      )}
      <button
        type="button"
        className="title-tile-info"
        aria-expanded={open}
        aria-controls={ruleId}
        aria-label={`${t(T.regelFuer)} ${t(title.name)}`}
        onClick={() => setOpen((o) => !o)}
      >
        ?
      </button>
      {clickable && (
        <MemberListTrigger className="title-tile-trigger" label={`${t(T.rangliste)}: ${t(title.name)}`} onClick={onOpen}>
          {t(T.rangliste)}
        </MemberListTrigger>
      )}
      <span id={ruleId} className={open ? "title-tile-rule title-tile-rule-open" : "title-tile-rule"}>
        {t(title.description)}
        {award && award.sharedWith > 0 && <span className="title-tile-rule-tie">{t(T.gleichstand)}</span>}
      </span>
    </li>
  );
}

/** Ehrentafel: eine Zeile je Titel, eine Spalte je Woche, neueste links; geblättert wird in Wochen. */
function HonorTable({ view, onOpen }: { view: TitlesView; onOpen(title: Title, week: TitleWeekView): void }) {
  const { t, sprache } = useSprache();
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
        <h2 className="panel-title">{t(T.ehrentafel)}</h2>
        {(older || newer) && (
          <span className="honor-nav">
            <button type="button" className="honor-nav-button" disabled={!newer} onClick={() => setStart(Math.max(0, first - perPage))}>
              {t(T.neuere)}
            </button>
            <button type="button" className="honor-nav-button" disabled={!older} onClick={() => setStart(first + perPage)}>
              {t(T.aeltere)}
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
            <th scope="col">{t(T.titel)}</th>
            {shown.map((w) => (
              <th key={w.week} scope="col" className="honor-week">
                <Link to={`/zeitung/${w.week}`} aria-label={weekRangeLabel(w.from, w.to, sprache)}>
                  {formatPlainDayMonth(w.from)}
                </Link>
                <span className="honor-week-date">
                  {t(T.bis)} {formatPlainDayMonth(w.to)}
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
                          title={a.sharedWith > 0 ? `${t(a.valueText)}, ${t(T.geteilt)(a.sharedWith)}` : t(a.valueText)}
                        >
                          <CharacterLink character={a.character} />
                        </span>
                      ) : (
                        <span className="honor-none" role="img" aria-label={t(T.nichtVergeben)} />
                      )}
                      {hasRanking(w, a) && (
                        <button
                          type="button"
                          className="honor-ranking"
                          aria-haspopup="dialog"
                          aria-label={t(T.ranglisteVon)(t(title.name), weekRangeLabel(w.from, w.to, sprache))}
                          title={t(T.rangliste)}
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
  const { t, sprache } = useSprache();
  const [ranking, setRanking] = useState<{ title: Title; week: TitleWeekView } | null>(null);
  const current = view.current;
  if (!current) {
    return (
      <div className="state state-empty" role="status">
        <p>{t(T.ersteWoche)(t(ERSCHEINT_FASSUNGEN))}</p>
      </div>
    );
  }
  return (
    <>
      <p className="page-subtitle muted">
        {weekRangeLabel(current.from, current.to, sprache)} ·{" "}
        <Link to={`/zeitung/${current.week}`}>{t(T.zurZeitung)(newspaperName(sprache))}</Link>
      </p>
      <TestdatenHinweis show={view.testdaten} />
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
      <p className="muted small">{t(T.regeln)}</p>
    </>
  );
}

export function TitlesPage() {
  const { t, sprache } = useSprache();
  const { data, error, loading } = useApi<TitlesView>("/api/titles");
  return (
    <section className="page">
      <header className="page-header">
        <h1 className="page-title">{t(T.seitentitel)}</h1>
        <p className="erscheint-hint">
          {t(T.erscheintVor)(newspaperName(sprache))}
          <strong>{t(ERSCHEINT_FASSUNGEN)}</strong>
          {t(T.erscheintNach)}
        </p>
      </header>
      <DataState loading={loading} error={error}>
        {data && <TitlesContent view={data} />}
      </DataState>
    </section>
  );
}
