import { Link, useParams, useSearchParams } from "react-router";
import type { NewspaperArchiveView, NewspaperArticleView, NewspaperView, NewspaperNumbersView, NewspaperNumberView, CharacterRef } from "../../../src/api/types";
import type { WeeklyNumberKind } from "../../../src/model";
import { CharacterLink } from "../components/CharacterLink";
import { DataState } from "../components/DataState";
import { FactionCrest } from "../components/FactionCrest";
import { GuildFilter } from "../components/GuildFilter";
import { TitleBadge } from "../components/TitleBadge";
import { SampleDataNotice } from "../components/SampleDataNotice";
import { useApi } from "../lib/api";
import { PUBLISHED_WHEN, splitByNames, weekRangeLabel } from "../lib/fun";
import { useLanguage, type Translations, type Language, translationIn } from "../lib/language";
import { newspaperName } from "../../../src/weekly/phrases-extras";
import { numberLocale } from "../lib/format";

/** Name of the newspaper: WEBSITE_NEWSPAPER or the default name for the language. */
function paperName(language: Language): string {
  return newspaperName(language, import.meta.env.WEBSITE_NEWSPAPER);
}

const AND: Record<Language, string> = { de: "und", en: "and", schwaebisch: "ond", bayrisch: "und" };

/** Names as a list: "A, B and C". */
function joinNames(names: string[], language: Language): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} ${AND[language]} ${names[names.length - 1]}`;
}

const T = {
  issues: { de: "Ausgaben", en: "Issues", schwaebisch: "Ausgabe", bayrisch: "Ausgabn" },
  previous: { de: "‹ Vorherige Ausgabe", en: "‹ Previous issue", schwaebisch: "‹ Vorherige Ausgab", bayrisch: "‹ Vorige Ausgab" },
  archive: { de: "Alle Ausgaben im Archiv", en: "All issues in the archive", schwaebisch: "Älle Ausgabe im Archiv", bayrisch: "Olle Ausgabn im Archiv" },
  next: { de: "Nächste Ausgabe ›", en: "Next issue ›", schwaebisch: "Nächschte Ausgab ›", bayrisch: "Nächste Ausgab ›" },
  titleOfWeek: { de: "Titel der Woche", en: "Title of the week", schwaebisch: "Titel vo dr Woch", bayrisch: "Titel vo da Woch" },
  /** Subline in the masthead with the guild names from the issue; neutral without names. */
  kicker: {
    de: (g: string) => (g ? `Wochenzeitung von ${g}` : "Die Wochenzeitung der Gilde"),
    en: (g: string) => (g ? `The weekly paper of ${g}` : "The guild's weekly paper"),
    schwaebisch: (g: string) => (g ? `Wocheblatt vo ${g}` : "S'Wocheblatt vo dr Gilde"),
    bayrisch: (g: string) => (g ? `Wochnzeitung vo ${g}` : "De Wochnzeitung vo da Gilde"),
  },
  issue: { de: "Ausgabe", en: "Issue", schwaebisch: "Ausgab", bayrisch: "Ausgab" },
  out: { de: "Erscheint", en: "Out", schwaebisch: "Kommt", bayrisch: "Kimmt" },
  price: { de: "Preis: ein Heiltrank", en: "Price: one healing potion", schwaebisch: "Preis: a Portion Maultascha", bayrisch: "Preis: a Brezn und a Hoibe" },
  numberOfWeek: { de: "Zahl der Woche", en: "Number of the week", schwaebisch: "Zahl vo dr Woch", bayrisch: "Zahl vo da Woch" },
  saying: { de: "Spruch der Woche", en: "Saying of the week", schwaebisch: "Spruch vo dr Woch", bayrisch: "Spruch vo da Woch" },
  notFound: { de: "Diese Ausgabe gibt es nicht.", en: "This issue does not exist.", schwaebisch: "Die Ausgab gibt's net.", bayrisch: "De Ausgab gibt's ned." },
  publishedBefore: {
    de: () => "Neue Ausgaben erscheinen ",
    en: () => "New issues come out ",
    schwaebisch: (n: string) => `S'${n} kommt `,
    bayrisch: (n: string) => `As ${n} kimmt `,
  },
  publishedAfter: {
    de: " mit der Woche von Sonntag bis Samstag. Die erste Ausgabe kommt am Sonntag nach der ersten ausgewerteten Woche.",
    en: ", covering the week from Sunday to Saturday. The first issue comes out on the Sunday after the first full week.",
    schwaebisch: " mit dr Woch vo Sonndig bis Samschdig. Die erscht Ausgab kommt am Sonndig nach dr erschte ausgwertete Woch.",
    bayrisch: " mit da Woch vo Sonntag bis Samstag. De erste Ausgab kimmt am Sonntag nach da erstn ausgwertn Woch.",
  },
  toLatest: { de: "Zur neuesten Ausgabe", en: "Go to the latest issue", schwaebisch: "Zur neieschte Ausgab", bayrisch: "Zur neiestn Ausgab" },
  archiveTitle: {
    de: (n: string) => `Archiv: ${n}`,
    en: (n: string) => `${n} Archive`,
    schwaebisch: (n: string) => `${n}-Archiv`,
    bayrisch: (n: string) => `${n}-Archiv`,
  },
  archiveSubtitle: {
    de: (_n: string, when: string) => `Alle Ausgaben, die neueste zuerst. Neue Ausgaben erscheinen ${when}.`,
    en: (_n: string, when: string) => `Every issue, newest first. New issues come out ${when}.`,
    schwaebisch: (n: string, when: string) => `Älle Ausgabe vom ${n}, die neischt zerscht. Neie Ausgabe kommet ${when}.`,
    bayrisch: (n: string, when: string) => `Olle Ausgabn vom ${n}, de neieste zerst. Neie Ausgabn kemman ${when}.`,
  },
  emptyBefore: {
    de: () => "Noch keine Ausgabe erschienen. Neue Ausgaben erscheinen ",
    en: () => "No issue published yet. New issues come out ",
    schwaebisch: (n: string) => `No koi Ausgab rauskomme. S'${n} kommt `,
    bayrisch: (n: string) => `No koa Ausgab rauskemma. As ${n} kimmt `,
  },
  emptyAfter: {
    de: ", die erste Ausgabe am Sonntag nach der ersten ausgewerteten Woche.",
    en: ", the first one on the Sunday after the first full week.",
    schwaebisch: ", die erscht Ausgab am Sonndig nach dr erschte ausgwertete Woch.",
    bayrisch: ", de erste Ausgab am Sonntag nach da erstn ausgwertn Woch.",
  },
  issueNo: { de: "Nr.", en: "No.", schwaebisch: "Nr.", bayrisch: "Nr." },
  inNumbers: { de: "Woche in Zahlen", en: "The week in numbers", schwaebisch: "D'Woch in Zahla", bayrisch: "De Woch in Zahln" },
  vsLastWeek: { de: "zur Vorwoche", en: "compared with last week", schwaebisch: "zur Vorwoch", bayrisch: "zur Vorwoch" },
  same: { de: "wie in der Vorwoche", en: "same as last week", schwaebisch: "wie in dr Vorwoch", bayrisch: "wia in da Vorwoch" },
  weather: { de: "Wetterbericht", en: "Weather forecast", schwaebisch: "Wetterbericht", bayrisch: "Wetterbericht" },
  weatherNote: {
    de: "Frei gedichtet aus den Zahlen der Woche, kein echtes Spielwetter.",
    en: "Made up from the week's numbers, not actual in-game weather.",
    schwaebisch: "Frei erfunda aus de Zahla vo dr Woch, koi echts Spielwetter.",
    bayrisch: "Frei dicht aus de Zahln vo da Woch, koa echts Spuiwetter.",
  },
  lookBack: {
    de: () => "Vor 4 Wochen",
    en: () => "4 weeks ago",
    schwaebisch: (n: string) => `Vor 4 Woche im ${n}`,
    bayrisch: (n: string) => `Vor 4 Wochn im ${n}`,
  },
} satisfies Record<string, Record<Language, unknown>>;

const NUMBER_NAMES: Record<WeeklyNumberKind, Translations> = {
  anmeldungen: { de: "Anmeldungen", en: "Logins", schwaebisch: "Aameldunga", bayrisch: "Anmeldungen" },
  level: { de: "Level", en: "Levels", schwaebisch: "Level", bayrisch: "Level" },
  tode: { de: "Tode", en: "Deaths", schwaebisch: "Tode", bayrisch: "Tode" },
  dungeons: { de: "Dungeons", en: "Dungeons", schwaebisch: "Dungeons", bayrisch: "Dungeons" },
  rezepte: { de: "Rezepte", en: "Recipes", schwaebisch: "Rezept", bayrisch: "Rezepte" },
  erfolge: { de: "Erfolge", en: "Achievements", schwaebisch: "Erfolg", bayrisch: "Erfolge" },
  ruf: { de: "Rufstufen", en: "Reputation levels", schwaebisch: "Rufstufa", bayrisch: "Rufstufn" },
  gegenstandsstufe: { de: "Gegenstandsstufe", en: "Item level", schwaebisch: "Gegenstandsstuf", bayrisch: "Gegenstandsstufn" },
};

const formatNumber = (n: number) => n.toLocaleString(numberLocale());

/** Arrow with the difference to last week; nothing without last week. */
function Trend({ row }: { row: NewspaperNumberView }) {
  const { t } = useLanguage();
  if (row.vorwoche === null) return null;
  const diff = row.wert - row.vorwoche;
  if (diff === 0) {
    return (
      <span className="zeitung-trend" data-richtung="gleich" title={t(T.same)}>
        <span aria-hidden="true">=</span>
        <span className="sr-only">{t(T.same)}</span>
      </span>
    );
  }
  const text = `${diff > 0 ? "+" : "−"}${formatNumber(Math.abs(diff))}`;
  return (
    <span className="zeitung-trend" data-richtung={diff > 0 ? "hoch" : "runter"} title={`${text} ${t(T.vsLastWeek)}`}>
      <span aria-hidden="true">{diff > 0 ? "▲" : "▼"}</span> {text}
      <span className="sr-only"> {t(T.vsLastWeek)}</span>
    </span>
  );
}

/** Info box with the guild totals of the week, switchable like the guild filter on the other pages. */
function WeekInNumbers({ zahlen }: { zahlen: NewspaperNumbersView }) {
  const { t } = useLanguage();
  const [params, setParams] = useSearchParams();
  const selected = params.get("gilde");
  const slug = selected !== null && zahlen.gilden[selected] ? selected : null;
  const rows = slug === null ? zahlen.gesamt : zahlen.gilden[slug];
  const select = (next: string | null) => {
    const q = new URLSearchParams(params);
    if (next === null) q.delete("gilde");
    else q.set("gilde", next);
    setParams(q, { replace: true });
  };
  if (zahlen.gesamt.length === 0) return null;
  return (
    <section className="zeitung-zahlen" aria-label={t(T.inNumbers)}>
      <h2 className="zeitung-section-title">
        <span>{t(T.inNumbers)}</span>
      </h2>
      <GuildFilter guilds={zahlen.guilds} value={slug} onChange={select} />
      <dl className="zeitung-zahlen-liste">
        {rows.map((z) => (
          <div key={z.art} className="zeitung-zahlen-zeile">
            <dt>{t(NUMBER_NAMES[z.art])}</dt>
            <dd>
              <strong>{formatNumber(z.wert)}</strong>
              <Trend row={z} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Articles by section (grouped by the Standard German version), in the order delivered. */
function bySection(articles: NewspaperArticleView[]): [Translations, NewspaperArticleView[]][] {
  const groups = new Map<string, [Translations, NewspaperArticleView[]]>();
  for (const a of articles) {
    const group = groups.get(translationIn(a.section, "de"));
    if (group) group[1].push(a);
    else groups.set(translationIn(a.section, "de"), [a.section, [a]]);
  }
  return [...groups.values()];
}

function IssueNav({ view }: { view: NewspaperView }) {
  const { t } = useLanguage();
  return (
    <nav className="zeitung-nav" aria-label={t(T.issues)}>
      {view.previous ? (
        <Link to={`/zeitung/${view.previous}`} rel="prev">
          {t(T.previous)}
        </Link>
      ) : (
        <span className="muted">{t(T.previous)}</span>
      )}
      <Link to="/zeitung/archiv">{t(T.archive)}</Link>
      {view.next ? (
        <Link to={`/zeitung/${view.next}`} rel="next">
          {t(T.next)}
        </Link>
      ) : (
        <span className="muted">{t(T.next)}</span>
      )}
    </nav>
  );
}

/** Text with linked character names. */
function Linked({ text, article }: { text: string; article: NewspaperArticleView }) {
  return (
    <>
      {splitByNames(text, article.characters.filter((c) => c.classId !== 0)).map((part, i) =>
        typeof part === "string" ? part : <CharacterLink key={i} character={part} />,
      )}
    </>
  );
}

/** Section color from the crest palette: Klatsch (gossip) in Alliance blue, Friedhof (graveyard) in Horde red, else gold. */
const SECTION_COLOR: Record<string, string> = { Klatsch: "allianz", Friedhof: "horde" };

function Avatar({ view, character, className }: { view: NewspaperView; character: CharacterRef; className: string }) {
  const src = view.avatars?.[String(character.id)];
  if (!src) return null;
  return <img className={className} src={src} alt="" width="84" height="84" loading="lazy" />;
}

function Card({ article, view }: { article: NewspaperArticleView; view: NewspaperView }) {
  const { t } = useLanguage();
  const faces = article.characters.length > 1 ? article.characters.filter((c) => view.avatars?.[String(c.id)]).slice(0, 8) : [];
  return (
    <article className="zeitung-card" data-kind={article.kind}>
      {article.title && (
        <TitleBadge
          titleId={article.title.id}
          name={article.title.name}
          size={64}
          tooltip={`${t(T.titleOfWeek)}: ${t(article.title.name)}`}
        />
      )}
      <h3 className="zeitung-headline">
        <Linked text={t(article.headline)} article={article} />
      </h3>
      <p className="zeitung-text">
        <Linked text={t(article.text)} article={article} />
      </p>
      {faces.length > 0 && (
        <div className="zeitung-faces" aria-hidden="true">
          {faces.map((c) => (
            <Avatar key={c.id} view={view} character={c} className="zeitung-face" />
          ))}
        </div>
      )}
    </article>
  );
}

function Issue({ view }: { view: NewspaperView }) {
  const { t, language } = useLanguage();
  const numberArticle = view.articles.find((a) => a.kind === "zahl");
  const sections = bySection(view.articles.filter((a) => a !== numberArticle));
  const leadCharacter = view.lead.characters[0];
  return (
    <>
      <SampleDataNotice show={view.testdaten} />
      <div className="zeitung">
        <header className="zeitung-masthead">
          <p className="zeitung-kicker">
            <FactionCrest faction="HORDE" size={20} />
            <span>{t(T.kicker)(joinNames(view.zahlen?.guilds.map((g) => g.name) ?? [], language))}</span>
            <FactionCrest faction="ALLIANCE" size={20} />
          </p>
          <h1 className="zeitung-title">{paperName(language)}</h1>
          <p className="zeitung-meta">
            <span>
              {t(T.issue)} {view.issue}
            </span>
            <span>{weekRangeLabel(view.from, view.to, language)}</span>
            <span>
              {t(T.out)} {t(PUBLISHED_WHEN)}
            </span>
            <span>{t(T.price)}</span>
          </p>
        </header>
        <article className={leadCharacter && view.avatars?.[String(leadCharacter.id)] ? "zeitung-lead" : "zeitung-lead zeitung-lead-ohne-bild"} data-kind={view.lead.kind}>
          {leadCharacter && (
            <div className="zeitung-lead-figur">
              <Avatar view={view} character={leadCharacter} className="zeitung-lead-bild" />
              {view.lead.title && (
                <TitleBadge
                  titleId={view.lead.title.id}
                  name={view.lead.title.name}
                  size={56}
                  tooltip={`${t(T.titleOfWeek)}: ${t(view.lead.title.name)}`}
                />
              )}
            </div>
          )}
          <div>
            <h2 className="zeitung-headline">
              <Linked text={t(view.lead.headline)} article={view.lead} />
            </h2>
            <p className="zeitung-text">
              <Linked text={t(view.lead.text)} article={view.lead} />
            </p>
          </div>
        </article>
        {view.zahlen && <WeekInNumbers zahlen={view.zahlen} />}
        {sections.map(([section, articles]) => (
          <section key={translationIn(section, "de")} className="zeitung-section" data-farbe={SECTION_COLOR[translationIn(section, "de")] ?? "gold"} aria-label={t(section)}>
            <h2 className="zeitung-section-title">
              <span>{t(section)}</span>
            </h2>
            <div className="zeitung-cards">
              {articles.map((a, i) => (
                <Card key={i} article={a} view={view} />
              ))}
            </div>
          </section>
        ))}
        <div className={numberArticle ? "zeitung-bottom" : "zeitung-bottom zeitung-bottom-ohne-zahl"}>
          {numberArticle && (
            <section className="zeitung-zahl" aria-label={t(T.numberOfWeek)}>
              <h2 className="zeitung-section-title">
                <span>{t(T.numberOfWeek)}</span>
              </h2>
              <strong className="zeitung-zahl-wert">{t(numberArticle.headline)}</strong>
              <p className="zeitung-text">{t(numberArticle.text)}</p>
            </section>
          )}
          <aside className="zeitung-motto">
            <span className="zeitung-motto-label">{t(T.saying)}</span>
            <q>{t(view.motto)}</q>
          </aside>
        </div>
        {(view.wetter || view.rueckblick) && (
          <div className={view.wetter && view.rueckblick ? "zeitung-bottom" : "zeitung-bottom zeitung-bottom-ohne-zahl"}>
            {view.wetter && (
              <section className="zeitung-wetter" aria-label={t(T.weather)}>
                <h2 className="zeitung-section-title">
                  <span>{t(T.weather)}</span>
                </h2>
                <p className="zeitung-text">{t(view.wetter)}</p>
                <p className="zeitung-wetter-hinweis muted">{t(T.weatherNote)}</p>
              </section>
            )}
            {view.rueckblick && (
              <section className="zeitung-rueckblick" aria-label={t(T.lookBack)(paperName(language))}>
                <h2 className="zeitung-section-title">
                  <span>{t(T.lookBack)(paperName(language))}</span>
                </h2>
                <p className="zeitung-rueckblick-meta muted">
                  <Link to={`/zeitung/${view.rueckblick.week}`}>
                    {view.rueckblick.issue !== null ? `${t(T.issue)} ${view.rueckblick.issue}, ` : ""}
                    {weekRangeLabel(view.rueckblick.from, view.rueckblick.to, language)}
                  </Link>
                </p>
                <q className="zeitung-rueckblick-zitat">{t(view.rueckblick.headline)}</q>
              </section>
            )}
          </div>
        )}
      </div>
      <IssueNav view={view} />
    </>
  );
}

export function NewspaperPage() {
  const { t, language } = useLanguage();
  const { woche: week } = useParams();
  const { data, error, loading } = useApi<NewspaperView>(week ? `/api/newspaper/${encodeURIComponent(week)}` : "/api/newspaper");
  return (
    <section className="page">
      {error?.status === 404 ? (
        <>
          <header className="page-header">
            <h1 className="page-title">{paperName(language)}</h1>
          </header>
          <div className="state state-empty" role="status">
            {week ? (
              <p>{t(T.notFound)}</p>
            ) : (
              <p className="erscheint-hint">
                {t(T.publishedBefore)(paperName(language))}
                <strong>{t(PUBLISHED_WHEN)}</strong>
                {t(T.publishedAfter)}
              </p>
            )}
            {week && (
              <p>
                <Link to="/zeitung">{t(T.toLatest)}</Link>
              </p>
            )}
          </div>
        </>
      ) : (
        <DataState loading={loading} error={error}>
          {data && <Issue view={data} />}
        </DataState>
      )}
    </section>
  );
}

/** Archive: every issue with number, scored week and lead headline, newest first. */
export function NewspaperArchivePage() {
  const { t, language } = useLanguage();
  const { data, error, loading } = useApi<NewspaperArchiveView>("/api/newspaper/archive");
  return (
    <section className="page">
      <header className="page-header">
        <h1 className="page-title">{t(T.archiveTitle)(paperName(language))}</h1>
        <p className="page-subtitle muted">{t(T.archiveSubtitle)(paperName(language), t(PUBLISHED_WHEN))}</p>
      </header>
      <DataState loading={loading} error={error}>
        {data &&
          (data.issues.length === 0 ? (
            <div className="state state-empty" role="status">
              <p className="erscheint-hint">
                {t(T.emptyBefore)(paperName(language))}
                <strong>{t(PUBLISHED_WHEN)}</strong>
                {t(T.emptyAfter)}
              </p>
            </div>
          ) : (
            <>
              <SampleDataNotice show={data.issues.some((i) => i.testdaten)} />
              <ol className="zeitung-archive">
                {data.issues.map((i) => (
                  <li key={i.week} className="zeitung-archive-item">
                    <Link to={`/zeitung/${i.week}`} className="zeitung-archive-link">
                      <span className="zeitung-archive-issue">
                        {t(T.issueNo)} {i.issue}
                      </span>
                      <span className="zeitung-archive-week">{weekRangeLabel(i.from, i.to, language)}</span>
                      <span className="zeitung-archive-headline">{t(i.headline)}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </>
          ))}
      </DataState>
    </section>
  );
}
