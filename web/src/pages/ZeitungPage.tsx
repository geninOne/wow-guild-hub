import { Link, useParams, useSearchParams } from "react-router";
import type { NewspaperArchiveView, NewspaperArticleView, NewspaperView, NewspaperNumbersView, NewspaperNumberView, CharacterRef } from "../../../src/api/types";
import type { WeeklyNumberKind } from "../../../src/model";
import { CharacterLink } from "../components/CharacterLink";
import { DataState } from "../components/DataState";
import { FactionCrest } from "../components/FactionCrest";
import { GuildFilter } from "../components/GuildFilter";
import { TitleBadge } from "../components/TitleBadge";
import { TestdatenHinweis } from "../components/TestdatenHinweis";
import { useApi } from "../lib/api";
import { ERSCHEINT_FASSUNGEN, splitByNames, weekRangeLabel } from "../lib/fun";
import { useSprache, type Fassungen, type Sprache, fassungIn } from "../lib/sprache";
import { newspaperName } from "../../../src/weekly/phrases-extras";
import { zahlLocale } from "../lib/format";

/** Name der Zeitung: WEBSITE_NEWSPAPER oder der Standardname der Sprache. */
function zeitung(sprache: Sprache): string {
  return newspaperName(sprache, import.meta.env.WEBSITE_NEWSPAPER);
}

const UND: Record<Sprache, string> = { de: "und", en: "and", schwaebisch: "ond", bayrisch: "und" };

/** Namen als Aufzählung: "A, B und C". */
function aufzaehlung(namen: string[], sprache: Sprache): string {
  if (namen.length <= 1) return namen.join("");
  return `${namen.slice(0, -1).join(", ")} ${UND[sprache]} ${namen[namen.length - 1]}`;
}

const T = {
  ausgaben: { de: "Ausgaben", en: "Issues", schwaebisch: "Ausgabe", bayrisch: "Ausgabn" },
  vorherige: { de: "‹ Vorherige Ausgabe", en: "‹ Previous issue", schwaebisch: "‹ Vorherige Ausgab", bayrisch: "‹ Vorige Ausgab" },
  archiv: { de: "Alle Ausgaben im Archiv", en: "All issues in the archive", schwaebisch: "Älle Ausgabe im Archiv", bayrisch: "Olle Ausgabn im Archiv" },
  naechste: { de: "Nächste Ausgabe ›", en: "Next issue ›", schwaebisch: "Nächschte Ausgab ›", bayrisch: "Nächste Ausgab ›" },
  titelDerWoche: { de: "Titel der Woche", en: "Title of the week", schwaebisch: "Titel vo dr Woch", bayrisch: "Titel vo da Woch" },
  /** Unterzeile im Kopf mit den Gildennamen aus der Ausgabe; ohne Namen neutral. */
  kicker: {
    de: (g: string) => (g ? `Wochenzeitung von ${g}` : "Die Wochenzeitung der Gilde"),
    en: (g: string) => (g ? `The weekly paper of ${g}` : "The guild's weekly paper"),
    schwaebisch: (g: string) => (g ? `Wocheblatt vo ${g}` : "S'Wocheblatt vo dr Gilde"),
    bayrisch: (g: string) => (g ? `Wochnzeitung vo ${g}` : "De Wochnzeitung vo da Gilde"),
  },
  ausgabe: { de: "Ausgabe", en: "Issue", schwaebisch: "Ausgab", bayrisch: "Ausgab" },
  erscheint: { de: "Erscheint", en: "Out", schwaebisch: "Kommt", bayrisch: "Kimmt" },
  preis: { de: "Preis: ein Heiltrank", en: "Price: one healing potion", schwaebisch: "Preis: a Portion Maultascha", bayrisch: "Preis: a Brezn und a Hoibe" },
  zahl: { de: "Zahl der Woche", en: "Number of the week", schwaebisch: "Zahl vo dr Woch", bayrisch: "Zahl vo da Woch" },
  spruch: { de: "Spruch der Woche", en: "Saying of the week", schwaebisch: "Spruch vo dr Woch", bayrisch: "Spruch vo da Woch" },
  gibtEsNicht: { de: "Diese Ausgabe gibt es nicht.", en: "This issue does not exist.", schwaebisch: "Die Ausgab gibt's net.", bayrisch: "De Ausgab gibt's ned." },
  erscheintVor: {
    de: () => "Neue Ausgaben erscheinen ",
    en: () => "New issues come out ",
    schwaebisch: (n: string) => `S'${n} kommt `,
    bayrisch: (n: string) => `As ${n} kimmt `,
  },
  erscheintNach: {
    de: " mit der Woche von Sonntag bis Samstag. Die erste Ausgabe kommt am Sonntag nach der ersten ausgewerteten Woche.",
    en: ", covering the week from Sunday to Saturday. The first issue comes out on the Sunday after the first full week.",
    schwaebisch: " mit dr Woch vo Sonndig bis Samschdig. Die erscht Ausgab kommt am Sonndig nach dr erschte ausgwertete Woch.",
    bayrisch: " mit da Woch vo Sonntag bis Samstag. De erste Ausgab kimmt am Sonntag nach da erstn ausgwertn Woch.",
  },
  zurNeuesten: { de: "Zur neuesten Ausgabe", en: "Go to the latest issue", schwaebisch: "Zur neieschte Ausgab", bayrisch: "Zur neiestn Ausgab" },
  archivTitel: {
    de: (n: string) => `Archiv: ${n}`,
    en: (n: string) => `${n} Archive`,
    schwaebisch: (n: string) => `${n}-Archiv`,
    bayrisch: (n: string) => `${n}-Archiv`,
  },
  archivUnter: {
    de: (_n: string, wann: string) => `Alle Ausgaben, die neueste zuerst. Neue Ausgaben erscheinen ${wann}.`,
    en: (_n: string, wann: string) => `Every issue, newest first. New issues come out ${wann}.`,
    schwaebisch: (n: string, wann: string) => `Älle Ausgabe vom ${n}, die neischt zerscht. Neie Ausgabe kommet ${wann}.`,
    bayrisch: (n: string, wann: string) => `Olle Ausgabn vom ${n}, de neieste zerst. Neie Ausgabn kemman ${wann}.`,
  },
  leerVor: {
    de: () => "Noch keine Ausgabe erschienen. Neue Ausgaben erscheinen ",
    en: () => "No issue published yet. New issues come out ",
    schwaebisch: (n: string) => `No koi Ausgab rauskomme. S'${n} kommt `,
    bayrisch: (n: string) => `No koa Ausgab rauskemma. As ${n} kimmt `,
  },
  leerNach: {
    de: ", die erste Ausgabe am Sonntag nach der ersten ausgewerteten Woche.",
    en: ", the first one on the Sunday after the first full week.",
    schwaebisch: ", die erscht Ausgab am Sonndig nach dr erschte ausgwertete Woch.",
    bayrisch: ", de erste Ausgab am Sonntag nach da erstn ausgwertn Woch.",
  },
  nr: { de: "Nr.", en: "No.", schwaebisch: "Nr.", bayrisch: "Nr." },
  inZahlen: { de: "Woche in Zahlen", en: "The week in numbers", schwaebisch: "D'Woch in Zahla", bayrisch: "De Woch in Zahln" },
  vorwoche: { de: "zur Vorwoche", en: "compared with last week", schwaebisch: "zur Vorwoch", bayrisch: "zur Vorwoch" },
  gleich: { de: "wie in der Vorwoche", en: "same as last week", schwaebisch: "wie in dr Vorwoch", bayrisch: "wia in da Vorwoch" },
  wetter: { de: "Wetterbericht", en: "Weather forecast", schwaebisch: "Wetterbericht", bayrisch: "Wetterbericht" },
  wetterHinweis: {
    de: "Frei gedichtet aus den Zahlen der Woche, kein echtes Spielwetter.",
    en: "Made up from the week's numbers, not actual in-game weather.",
    schwaebisch: "Frei erfunda aus de Zahla vo dr Woch, koi echts Spielwetter.",
    bayrisch: "Frei dicht aus de Zahln vo da Woch, koa echts Spuiwetter.",
  },
  rueckblick: {
    de: () => "Vor 4 Wochen",
    en: () => "4 weeks ago",
    schwaebisch: (n: string) => `Vor 4 Woche im ${n}`,
    bayrisch: (n: string) => `Vor 4 Wochn im ${n}`,
  },
} satisfies Record<string, Record<Sprache, unknown>>;

const ZAHL_NAMEN: Record<WeeklyNumberKind, Fassungen> = {
  anmeldungen: { de: "Anmeldungen", en: "Logins", schwaebisch: "Aameldunga", bayrisch: "Anmeldungen" },
  level: { de: "Level", en: "Levels", schwaebisch: "Level", bayrisch: "Level" },
  tode: { de: "Tode", en: "Deaths", schwaebisch: "Tode", bayrisch: "Tode" },
  dungeons: { de: "Dungeons", en: "Dungeons", schwaebisch: "Dungeons", bayrisch: "Dungeons" },
  rezepte: { de: "Rezepte", en: "Recipes", schwaebisch: "Rezept", bayrisch: "Rezepte" },
  erfolge: { de: "Erfolge", en: "Achievements", schwaebisch: "Erfolg", bayrisch: "Erfolge" },
  ruf: { de: "Rufstufen", en: "Reputation levels", schwaebisch: "Rufstufa", bayrisch: "Rufstufn" },
  gegenstandsstufe: { de: "Gegenstandsstufe", en: "Item level", schwaebisch: "Gegenstandsstuf", bayrisch: "Gegenstandsstufn" },
};

const zahlFormat = (n: number) => n.toLocaleString(zahlLocale());

/** Pfeil mit Differenz zur Vorwoche; ohne Vorwoche nichts. */
function Trend({ zeile }: { zeile: NewspaperNumberView }) {
  const { t } = useSprache();
  if (zeile.vorwoche === null) return null;
  const diff = zeile.wert - zeile.vorwoche;
  if (diff === 0) {
    return (
      <span className="zeitung-trend" data-richtung="gleich" title={t(T.gleich)}>
        <span aria-hidden="true">=</span>
        <span className="sr-only">{t(T.gleich)}</span>
      </span>
    );
  }
  const text = `${diff > 0 ? "+" : "−"}${zahlFormat(Math.abs(diff))}`;
  return (
    <span className="zeitung-trend" data-richtung={diff > 0 ? "hoch" : "runter"} title={`${text} ${t(T.vorwoche)}`}>
      <span aria-hidden="true">{diff > 0 ? "▲" : "▼"}</span> {text}
      <span className="sr-only"> {t(T.vorwoche)}</span>
    </span>
  );
}

/** Infokasten mit den Gildensummen der Woche, umschaltbar wie die Gildenauswahl der übrigen Seiten. */
function WocheInZahlen({ zahlen }: { zahlen: NewspaperNumbersView }) {
  const { t } = useSprache();
  const [params, setParams] = useSearchParams();
  const gewaehlt = params.get("gilde");
  const slug = gewaehlt !== null && zahlen.gilden[gewaehlt] ? gewaehlt : null;
  const zeilen = slug === null ? zahlen.gesamt : zahlen.gilden[slug];
  const waehle = (next: string | null) => {
    const q = new URLSearchParams(params);
    if (next === null) q.delete("gilde");
    else q.set("gilde", next);
    setParams(q, { replace: true });
  };
  if (zahlen.gesamt.length === 0) return null;
  return (
    <section className="zeitung-zahlen" aria-label={t(T.inZahlen)}>
      <h2 className="zeitung-section-title">
        <span>{t(T.inZahlen)}</span>
      </h2>
      <GuildFilter guilds={zahlen.guilds} value={slug} onChange={waehle} />
      <dl className="zeitung-zahlen-liste">
        {zeilen.map((z) => (
          <div key={z.art} className="zeitung-zahlen-zeile">
            <dt>{t(ZAHL_NAMEN[z.art])}</dt>
            <dd>
              <strong>{zahlFormat(z.wert)}</strong>
              <Trend zeile={z} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Artikel nach Rubrik (gruppiert nach der hochdeutschen Fassung), Reihenfolge wie geliefert. */
function bySection(articles: NewspaperArticleView[]): [Fassungen, NewspaperArticleView[]][] {
  const groups = new Map<string, [Fassungen, NewspaperArticleView[]]>();
  for (const a of articles) {
    const group = groups.get(fassungIn(a.section, "de"));
    if (group) group[1].push(a);
    else groups.set(fassungIn(a.section, "de"), [a.section, [a]]);
  }
  return [...groups.values()];
}

function IssueNav({ view }: { view: NewspaperView }) {
  const { t } = useSprache();
  return (
    <nav className="zeitung-nav" aria-label={t(T.ausgaben)}>
      {view.previous ? (
        <Link to={`/zeitung/${view.previous}`} rel="prev">
          {t(T.vorherige)}
        </Link>
      ) : (
        <span className="muted">{t(T.vorherige)}</span>
      )}
      <Link to="/zeitung/archiv">{t(T.archiv)}</Link>
      {view.next ? (
        <Link to={`/zeitung/${view.next}`} rel="next">
          {t(T.naechste)}
        </Link>
      ) : (
        <span className="muted">{t(T.naechste)}</span>
      )}
    </nav>
  );
}

/** Text mit verlinkten Charakternamen. */
function Linked({ text, article }: { text: string; article: NewspaperArticleView }) {
  return (
    <>
      {splitByNames(text, article.characters.filter((c) => c.classId !== 0)).map((part, i) =>
        typeof part === "string" ? part : <CharacterLink key={i} character={part} />,
      )}
    </>
  );
}

/** Rubrikfarbe nach Wappen-Palette: Klatsch in Allianzblau, Friedhof in Hordenrot, sonst Gold. */
const SECTION_COLOR: Record<string, string> = { Klatsch: "allianz", Friedhof: "horde" };

function Avatar({ view, character, className }: { view: NewspaperView; character: CharacterRef; className: string }) {
  const src = view.avatars?.[String(character.id)];
  if (!src) return null;
  return <img className={className} src={src} alt="" width="84" height="84" loading="lazy" />;
}

function Card({ article, view }: { article: NewspaperArticleView; view: NewspaperView }) {
  const { t } = useSprache();
  const faces = article.characters.length > 1 ? article.characters.filter((c) => view.avatars?.[String(c.id)]).slice(0, 8) : [];
  return (
    <article className="zeitung-card" data-kind={article.kind}>
      {article.title && (
        <TitleBadge
          titleId={article.title.id}
          name={article.title.name}
          size={64}
          tooltip={`${t(T.titelDerWoche)}: ${t(article.title.name)}`}
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
  const { t, sprache } = useSprache();
  const zahl = view.articles.find((a) => a.kind === "zahl");
  const sections = bySection(view.articles.filter((a) => a !== zahl));
  const leadCharacter = view.lead.characters[0];
  return (
    <>
      <TestdatenHinweis show={view.testdaten} />
      <div className="zeitung">
        <header className="zeitung-masthead">
          <p className="zeitung-kicker">
            <FactionCrest faction="HORDE" size={20} />
            <span>{t(T.kicker)(aufzaehlung(view.zahlen?.guilds.map((g) => g.name) ?? [], sprache))}</span>
            <FactionCrest faction="ALLIANCE" size={20} />
          </p>
          <h1 className="zeitung-title">{zeitung(sprache)}</h1>
          <p className="zeitung-meta">
            <span>
              {t(T.ausgabe)} {view.issue}
            </span>
            <span>{weekRangeLabel(view.from, view.to, sprache)}</span>
            <span>
              {t(T.erscheint)} {t(ERSCHEINT_FASSUNGEN)}
            </span>
            <span>{t(T.preis)}</span>
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
                  tooltip={`${t(T.titelDerWoche)}: ${t(view.lead.title.name)}`}
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
        {view.zahlen && <WocheInZahlen zahlen={view.zahlen} />}
        {sections.map(([section, articles]) => (
          <section key={fassungIn(section, "de")} className="zeitung-section" data-farbe={SECTION_COLOR[fassungIn(section, "de")] ?? "gold"} aria-label={t(section)}>
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
        <div className={zahl ? "zeitung-bottom" : "zeitung-bottom zeitung-bottom-ohne-zahl"}>
          {zahl && (
            <section className="zeitung-zahl" aria-label={t(T.zahl)}>
              <h2 className="zeitung-section-title">
                <span>{t(T.zahl)}</span>
              </h2>
              <strong className="zeitung-zahl-wert">{t(zahl.headline)}</strong>
              <p className="zeitung-text">{t(zahl.text)}</p>
            </section>
          )}
          <aside className="zeitung-motto">
            <span className="zeitung-motto-label">{t(T.spruch)}</span>
            <q>{t(view.motto)}</q>
          </aside>
        </div>
        {(view.wetter || view.rueckblick) && (
          <div className={view.wetter && view.rueckblick ? "zeitung-bottom" : "zeitung-bottom zeitung-bottom-ohne-zahl"}>
            {view.wetter && (
              <section className="zeitung-wetter" aria-label={t(T.wetter)}>
                <h2 className="zeitung-section-title">
                  <span>{t(T.wetter)}</span>
                </h2>
                <p className="zeitung-text">{t(view.wetter)}</p>
                <p className="zeitung-wetter-hinweis muted">{t(T.wetterHinweis)}</p>
              </section>
            )}
            {view.rueckblick && (
              <section className="zeitung-rueckblick" aria-label={t(T.rueckblick)(zeitung(sprache))}>
                <h2 className="zeitung-section-title">
                  <span>{t(T.rueckblick)(zeitung(sprache))}</span>
                </h2>
                <p className="zeitung-rueckblick-meta muted">
                  <Link to={`/zeitung/${view.rueckblick.week}`}>
                    {view.rueckblick.issue !== null ? `${t(T.ausgabe)} ${view.rueckblick.issue}, ` : ""}
                    {weekRangeLabel(view.rueckblick.from, view.rueckblick.to, sprache)}
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

export function ZeitungPage() {
  const { t, sprache } = useSprache();
  const { woche } = useParams();
  const { data, error, loading } = useApi<NewspaperView>(woche ? `/api/newspaper/${encodeURIComponent(woche)}` : "/api/newspaper");
  return (
    <section className="page">
      {error?.status === 404 ? (
        <>
          <header className="page-header">
            <h1 className="page-title">{zeitung(sprache)}</h1>
          </header>
          <div className="state state-empty" role="status">
            {woche ? (
              <p>{t(T.gibtEsNicht)}</p>
            ) : (
              <p className="erscheint-hint">
                {t(T.erscheintVor)(zeitung(sprache))}
                <strong>{t(ERSCHEINT_FASSUNGEN)}</strong>
                {t(T.erscheintNach)}
              </p>
            )}
            {woche && (
              <p>
                <Link to="/zeitung">{t(T.zurNeuesten)}</Link>
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

/** Archiv: alle Ausgaben mit Nummer, gewerteter Woche und Schlagzeile des Aufmachers, neueste zuerst. */
export function ZeitungArchivePage() {
  const { t, sprache } = useSprache();
  const { data, error, loading } = useApi<NewspaperArchiveView>("/api/newspaper/archive");
  return (
    <section className="page">
      <header className="page-header">
        <h1 className="page-title">{t(T.archivTitel)(zeitung(sprache))}</h1>
        <p className="page-subtitle muted">{t(T.archivUnter)(zeitung(sprache), t(ERSCHEINT_FASSUNGEN))}</p>
      </header>
      <DataState loading={loading} error={error}>
        {data &&
          (data.issues.length === 0 ? (
            <div className="state state-empty" role="status">
              <p className="erscheint-hint">
                {t(T.leerVor)(zeitung(sprache))}
                <strong>{t(ERSCHEINT_FASSUNGEN)}</strong>
                {t(T.leerNach)}
              </p>
            </div>
          ) : (
            <>
              <TestdatenHinweis show={data.issues.some((i) => i.testdaten)} />
              <ol className="zeitung-archive">
                {data.issues.map((i) => (
                  <li key={i.week} className="zeitung-archive-item">
                    <Link to={`/zeitung/${i.week}`} className="zeitung-archive-link">
                      <span className="zeitung-archive-issue">
                        {t(T.nr)} {i.issue}
                      </span>
                      <span className="zeitung-archive-week">{weekRangeLabel(i.from, i.to, sprache)}</span>
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
