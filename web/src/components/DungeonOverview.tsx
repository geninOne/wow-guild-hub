import type { CSSProperties } from "react";
import type { GuildDungeonsView, GuildDungeonView, GuildRaidView } from "../../../src/api/types";
import { useApi } from "../lib/api";
import { formatPlainDate } from "../lib/fun";
import { fassungIn, useSprache, type Fassungen, type Sprache } from "../lib/sprache";
import { CharacterLink } from "./CharacterLink";
import { DataState } from "./DataState";
import { GuildFilter } from "./GuildFilter";
import { ALLE_ANSEHEN, MemberListTrigger, PeopleIcon, useMemberList, type MemberListRequest } from "./MemberList";
import { zahlLocale } from "../lib/format";

const fmt = (n: number) => n.toLocaleString(zahlLocale());

const T = {
  bis: { de: "bis", en: "to", schwaebisch: "bis", bayrisch: "bis" },
  nachLevel: { de: "Dungeons nach Level", en: "Dungeons by level", schwaebisch: "Dungeons nach Level", bayrisch: "Dungeons nach Level" },
  nochNiemand: { de: "noch niemand", en: "nobody yet", schwaebisch: "no koiner", bayrisch: "no koana" },
  durch: { de: (n: string) => `${n} durch`, en: (n: string) => `${n} cleared`, schwaebisch: (n: string) => `${n} durch`, bayrisch: (n: string) => `${n} durch` },
  geschafft: { de: (n: number) => `${n} geschafft`, en: (n: number) => `${n} cleared`, schwaebisch: (n: number) => `${n} gschafft`, bayrisch: (n: number) => `${n} gschafft` },
  verschlossen: { de: "verschlossen", en: "locked", schwaebisch: "verschlosse", bayrisch: "zuagsperrt" },
  lieblingsdungeon: { de: "Lieblingsdungeon", en: "Favorite dungeon", schwaebisch: "Lieblingsdungeon", bayrisch: "Lieblingsdungeon" },
  charaktereDurch: {
    de: (n: string) => `${n} Charaktere durch`,
    en: (n: string) => `${n} characters cleared it`,
    schwaebisch: (n: string) => `${n} Charakter durch`,
    bayrisch: (n: string) => `${n} Charaktere durch`,
  },
  nirgendsDurch: {
    de: "Bisher war noch niemand irgendwo durch.",
    en: "Nobody has cleared anything yet.",
    schwaebisch: "No koiner nirgends durch.",
    bayrisch: "No koana nirgends durch.",
  },
  naechstesZiel: { de: "Nächstes Gildenziel", en: "Next guild goal", schwaebisch: "Nächschtes Gildeziel", bayrisch: "Nächsts Gildnziel" },
  nochNiemandDrin: {
    de: "Dort war noch niemand drin",
    en: "Nobody has been inside yet",
    schwaebisch: "Do war no koiner drin",
    bayrisch: "Do war no koana drin",
  },
  allesGeschafft: { de: "Alles geschafft. Respekt!", en: "Everything cleared. Respect!", schwaebisch: "Älles gschafft. Respekt!", bayrisch: "Ois gschafft. Respekt!" },
  dauergast: { de: "Dauergast", en: "Regular", schwaebisch: "Dauergascht", bayrisch: "Stammgast" },
  keinStammgast: { de: "Noch kein Stammgast.", en: "No regulars yet.", schwaebisch: "No koi Stammgascht.", bayrisch: "No koa Stammgast." },
  bosse: { de: "Bosse", en: "Bosses", schwaebisch: "Bosse", bayrisch: "Bosse" },
  ganzDurch: {
    de: (n: string, von: string) => `${n} von ${von} Charakteren ganz durch.`,
    en: (n: string, von: string) => `${n} of ${von} characters cleared it fully.`,
    schwaebisch: (n: string, von: string) => `${n} vo ${von} Charakter ganz durch.`,
    bayrisch: (n: string, von: string) => `${n} vo ${von} Charakter ganz durch.`,
  },
  angefangen: {
    de: "Angefangen, aber noch nicht fertig.",
    en: "Started, but not finished yet.",
    schwaebisch: "Agfange, aber no net fertig.",
    bayrisch: "Ogfangt, aber no ned firti.",
  },
  werTrautSich: {
    de: "Noch niemand drin. Wer traut sich?",
    en: "Nobody inside yet. Who dares?",
    schwaebisch: "No koiner drin. Wer traut sich?",
    bayrisch: "No koana drin. Wer traut si?",
  },
  mitProfil: {
    de: (n: string) => `${n} Charaktere mit Profil`,
    en: (n: string) => `${n} characters with a profile`,
    schwaebisch: (n: string) => `${n} Charakter mit Profil`,
    bayrisch: (n: string) => `${n} Charaktere mit Profil`,
  },
  letzterEndboss: {
    de: (d: string) => ` · letzter Endboss am ${d}`,
    en: (d: string) => ` · last final boss on ${d}`,
    schwaebisch: (d: string) => ` · letschter Endboss am ${d}`,
    bayrisch: (d: string) => ` · letzta Endboss am ${d}`,
  },
  listeFehlt: {
    de: "Die Dungeon-Liste von Blizzard fehlt noch. Sie kommt mit dem nächsten Lauf des Sammlers.",
    en: "The dungeon list from Blizzard is still missing. It arrives with the collector's next run.",
    schwaebisch: "D'Dungeon-Lischt vo Blizzard fehlt no. Die kommt mitm nächschte Lauf vom Sammler.",
    bayrisch: "D'Dungeon-Listn vo Blizzard fehlt no. De kimmt mim nächstn Lauf vom Sammler.",
  },
  abenteuerkarte: { de: "Abenteuerkarte", en: "Adventure map", schwaebisch: "Abenteuerkart", bayrisch: "Abenteuerkartn" },
  amWeitesten: {
    de: (d: string) => `Am weitesten vorn: ${d}.`,
    en: (d: string) => `Furthest ahead: ${d}.`,
    schwaebisch: (d: string) => `Am weitschte vorne: ${d}.`,
    bayrisch: (d: string) => `Am weitastn vorn: ${d}.`,
  },
  vomKeller: {
    de: "Vom ersten Keller bis zur Burg: Wo war die Gilde schon?",
    en: "From the first cellar to the castle: where has the guild been?",
    schwaebisch: "Vom erschte Keller bis zur Burg: Wo war d'Gilde scho?",
    bayrisch: "Vom erstn Keller bis zur Burg: Wo war d'Gilde scho?",
  },
  geschafftHaben: {
    de: (n: number): string => (n === 1 ? " Geschafft hat es " : " Geschafft haben es "),
    en: (n: number): string => (n === 1 ? " Cleared by " : " Cleared by "),
    schwaebisch: (n: number): string => (n === 1 ? " Gschafft hot's " : " Gschafft hend's "),
    bayrisch: (n: number): string => (n === 1 ? " Gschafft hod's " : " Gschafft ham's "),
  },
  und: { de: " und ", en: " and ", schwaebisch: " ond ", bayrisch: " und " },
  raidSpruch: {
    de: "Die großen Brocken. Mit vierzig Leuten und guter Laune.",
    en: "The big ones. Forty people and good spirits.",
    schwaebisch: "Die große Brocke. Mit vierzig Leut ond guter Laune.",
    bayrisch: "De großn Brockn. Mit vierzg Leit und guada Laune.",
  },
  herkunft: {
    de: 'Aus den Erfolgen und der Boss-Statistik aller aktiven Mitglieder mit Profil. "Durch" heißt: Erfolg erfüllt oder Endboss besiegt. Gegenstücke beider Fraktionen wie Flammenschlund und Halle der Thanen zählen zusammen.',
    en: 'Based on the achievements and boss statistics of all active members with a profile. "Cleared" means: achievement earned or final boss defeated. Horde and Alliance counterparts of the same dungeon count together.',
    schwaebisch: 'Aus de Erfolg ond dr Boss-Statistik vo älle aktive Mitglieder mit Profil. "Durch" hoißt: Erfolg erfüllt oder Endboss bsiegt. Gegestück vo beide Fraktiona wie Flammenschlund ond Halle der Thanen zählet zamme.',
    bayrisch: 'Aus de Erfolge und da Boss-Statistik vo olle aktivn Mitglieder mit Profil. "Durch" hoaßt: Erfolg erfüllt oder Endboss bsiegt. Gegnstückl vo boade Fraktionen wia Flammenschlund und Halle der Thanen zähln zamm.',
  },
} satisfies Record<string, Fassungen<unknown>>;
const L = {
  endbossSiege: { de: "Endboss-Siege", en: "Final boss kills", schwaebisch: "Endboss-Sieg", bayrisch: "Endboss-Siege" },
  bosseBesiegt: { de: "Bosse besiegt", en: "Bosses defeated", schwaebisch: "Bosse bsiegt", bayrisch: "Bosse bsiegt" },
  werDrin: {
    de: (n: string) => `Alle ${n} ansehen`,
    en: (n: string) => `View all ${n}`,
    schwaebisch: (n: string) => `Älle ${n} aagucke`,
    bayrisch: (n: string) => `Olle ${n} oschaun`,
  },
} satisfies Record<string, Fassungen<unknown>>;

const idx = (i: number) => ({ "--i": i }) as CSSProperties;

function levelText(d: { levels: { min: number; max: number } | null }, sprache: Sprache = "de"): string | null {
  if (!d.levels) return null;
  return d.levels.min === d.levels.max ? `Level ${d.levels.min}` : `Level ${d.levels.min} ${fassungIn(T.bis, sprache)} ${d.levels.max}`;
}

/** Rundes Bild, ohne Bild der Anfangsbuchstabe auf Stein. */
function Medallion({ name, image, className }: { name: string; image: string | null; className: string }) {
  return image ? (
    <img className={className} src={image} alt="" loading="lazy" />
  ) : (
    <span className={`${className} dungeon-noimg`} aria-hidden="true">
      {name.charAt(0)}
    </span>
  );
}

/** Abenteuerkarte: Dungeons als Stationen nach Level, hell je mehr durch sind, unbesuchte im Nebel. */
function AdventureMap({ view, onOpen }: { view: GuildDungeonsView; onOpen(request: MemberListRequest): void }) {
  const { t, sprache } = useSprache();
  const max = Math.max(1, ...view.dungeons.map((d) => d.completed));
  return (
    <ol className="dungeon-map" aria-label={t(T.nachLevel)}>
      {view.dungeons.map((d, i) => {
        const glow = d.completed / max;
        return (
          <li
            key={d.key}
            className={`dungeon-stop${d.completed === 0 ? " dungeon-fog" : ""}`}
            style={{ ...idx(i), "--glow": glow.toFixed(2) } as CSSProperties}
          >
            {d.completed > 0 && (d.who ?? []).length > 0 ? (
              <button
                type="button"
                className="dungeon-stop-button"
                aria-haspopup="dialog"
                onClick={() =>
                  onOpen({
                    title: d.name,
                    subtitle: levelText(d, sprache) ?? undefined,
                    sets: [{ key: d.key, label: d.name, valueLabel: t(L.endbossSiege), entries: d.who }],
                    fixedGuild: true,
                  })
                }
              >
                <Medallion name={d.name} image={d.image} className="dungeon-stop-img" />
                <span className="dungeon-stop-name">{d.name}</span>
                {levelText(d, sprache) && <span className="dungeon-stop-level muted small">{levelText(d, sprache)}</span>}
                <span className="dungeon-stop-count small">
                  <PeopleIcon />
                  {t(T.durch)(fmt(d.completed))}
                </span>
                <span className="sr-only">, {t(ALLE_ANSEHEN)}</span>
              </button>
            ) : (
              <>
                <Medallion name={d.name} image={d.image} className="dungeon-stop-img" />
                <span className="dungeon-stop-name">{d.name}</span>
                {levelText(d, sprache) && <span className="dungeon-stop-level muted small">{levelText(d, sprache)}</span>}
                <span className="dungeon-stop-count small">
                  {d.completed === 0 ? t(T.nochNiemand) : t(T.durch)(fmt(d.completed))}
                </span>
              </>
            )}
          </li>
        );
      })}
      {view.raids.length > 0 && (
        <li className="dungeon-stop dungeon-castle" style={idx(view.dungeons.length)}>
          <a href="#raids" className="dungeon-castle-link">
            <Medallion name="Raids" image={view.raids.find((r) => r.image)?.image ?? null} className="dungeon-castle-img" />
            <span className="dungeon-stop-name">Raids</span>
            <span className="dungeon-stop-count small">
              {view.raids.some((r) => r.completed > 0) ? t(T.geschafft)(view.raids.filter((r) => r.completed > 0).length) : t(T.verschlossen)}
            </span>
          </a>
        </li>
      )}
    </ol>
  );
}

function Highlight({ kicker, dungeon, children }: { kicker: string; dungeon: GuildDungeonView | null; children: React.ReactNode }) {
  return (
    <li className={`dungeon-highlight${dungeon?.completed === 0 ? " dungeon-highlight-fog" : ""}`}>
      {dungeon?.image ? (
        <img className="dungeon-highlight-img" src={dungeon.image} alt="" loading="lazy" />
      ) : (
        <span className="dungeon-highlight-img dungeon-noimg" aria-hidden="true" />
      )}
      <span className="dungeon-highlight-kicker">{kicker}</span>
      {children}
    </li>
  );
}

/** Lieblingsdungeon, nächstes Gildenziel und Dauergast. */
function Highlights({ view }: { view: GuildDungeonsView }) {
  const { t, sprache } = useSprache();
  const favourite = [...view.dungeons].sort((a, b) => b.completed - a.completed)[0] ?? null;
  const next = view.dungeons.find((d) => d.completed === 0) ?? null;
  const regular = [...view.dungeons].filter((d) => d.best).sort((a, b) => b.best!.times - a.best!.times)[0] ?? null;
  return (
    <ul className="dungeon-highlights">
      <Highlight kicker={t(T.lieblingsdungeon)} dungeon={favourite}>
        {favourite && favourite.completed > 0 ? (
          <>
            <strong>{favourite.name}</strong>
            <span className="muted small">{t(T.charaktereDurch)(fmt(favourite.completed))}</span>
          </>
        ) : (
          <span className="muted">{t(T.nirgendsDurch)}</span>
        )}
      </Highlight>
      <Highlight kicker={t(T.naechstesZiel)} dungeon={next}>
        {next ? (
          <>
            <strong>{next.name}</strong>
            <span className="muted small">
              {t(T.nochNiemandDrin)}
              {levelText(next, sprache) ? `, ${levelText(next, sprache)}` : ""}.
            </span>
          </>
        ) : (
          <span className="muted">{t(T.allesGeschafft)}</span>
        )}
      </Highlight>
      <Highlight kicker={t(T.dauergast)} dungeon={regular}>
        {regular?.best ? (
          <>
            <strong>
              <CharacterLink character={regular.best.character} />
            </strong>
            <span className="muted small">
              {regular.best.times}× {regular.name}
            </span>
          </>
        ) : (
          <span className="muted">{t(T.keinStammgast)}</span>
        )}
      </Highlight>
    </ul>
  );
}

function Raid({ raid, characters, onOpen }: { raid: GuildRaidView; characters: number; onOpen(request: MemberListRequest): void }) {
  const { t, sprache } = useSprache();
  const any = raid.bosses.some((b) => b.defeated > 0);
  return (
    <li className={`dungeon-raid${any ? "" : " dungeon-raid-locked"}`}>
      {raid.image ? (
        <img className="dungeon-raid-img" src={raid.image} alt="" loading="lazy" />
      ) : (
        <span className="dungeon-raid-img dungeon-noimg" aria-hidden="true" />
      )}
      <h3 className="dungeon-raid-name">{raid.name}</h3>
      {levelText(raid, sprache) && <p className="muted small">{levelText(raid, sprache)}</p>}
      <ul className="dungeon-bosses" aria-label={`${t(T.bosse)}: ${raid.name}`}>
        {raid.bosses.map((b) => (
          <li key={b.name} className={b.defeated > 0 ? "dungeon-boss-down" : ""}>
            <span className="dungeon-boss-box" aria-hidden="true">
              {b.defeated > 0 ? "✓" : ""}
            </span>
            <span>{b.name}</span>
            {b.defeated > 0 && <span className="num muted small">{fmt(b.defeated)}×</span>}
          </li>
        ))}
      </ul>
      <p className="muted small">
        {raid.completed > 0
          ? t(T.ganzDurch)(fmt(raid.completed), fmt(characters))
          : any
            ? t(T.angefangen)
            : t(T.werTrautSich)}
      </p>
      {(raid.who ?? []).length > 0 && (
        <MemberListTrigger
          label={`${t(L.werDrin)(fmt(raid.who.length))}: ${t(L.bosseBesiegt)}, ${raid.name}`}
          onClick={() =>
            onOpen({
              title: raid.name,
              subtitle: levelText(raid, sprache) ?? undefined,
              sets: [{ key: raid.name, label: raid.name, valueLabel: t(L.bosseBesiegt), entries: raid.who }],
              fixedGuild: true,
            })
          }
        >
          {t(L.werDrin)(fmt(raid.who.length))}
        </MemberListTrigger>
      )}
    </li>
  );
}

function Content({ view, onGuild }: { view: GuildDungeonsView; onGuild(slug: string | null): void }) {
  const { t } = useSprache();
  // Die Antwort ist schon nach Gilde gefiltert, darum ohne eigenen Umschalter im Dialog.
  const list = useMemberList(view.guild);
  const last = view.dungeons.map((d) => d.lastAt).filter((x): x is string => x !== null).sort().at(-1);
  return (
    <>
      <div className="stats-period">
        <GuildFilter guilds={view.guilds} value={view.guild} onChange={onGuild} />
      </div>
      <p className="page-subtitle muted">
        {t(T.mitProfil)(fmt(view.characters))}
        {last && t(T.letzterEndboss)(formatPlainDate(last.slice(0, 10)))}
      </p>
      {!view.available ? (
        <div className="state state-empty" role="status">
          <p>{t(T.listeFehlt)}</p>
        </div>
      ) : (
        <>
          <section className="panel dungeon-panel" aria-labelledby="abenteuerkarte">
            <header className="panel-header stat-theme-header">
              <h2 className="panel-title" id="abenteuerkarte">
                {t(T.abenteuerkarte)}
              </h2>
              <p className="stat-theme-blurb">
                {view.frontier ? t(T.amWeitesten)(view.frontier.dungeon) : t(T.vomKeller)}
                {view.frontier && t(T.geschafftHaben)(view.frontier.characters.length)}
                {view.frontier?.characters.map((c, i, all) => (
                  <span key={c.id}>
                    {i > 0 && (i === all.length - 1 ? t(T.und) : ", ")}
                    <CharacterLink character={c} />
                  </span>
                ))}
                {view.frontier && "."}
              </p>
            </header>
            <AdventureMap view={view} onOpen={list.open} />
          </section>
          <Highlights view={view} />
          {view.raids.length > 0 && (
            <section className="panel" aria-labelledby="raids-titel" id="raids">
              <header className="panel-header stat-theme-header">
                <h2 className="panel-title" id="raids-titel">
                  Raids
                </h2>
                <p className="stat-theme-blurb">{t(T.raidSpruch)}</p>
              </header>
              <ul className="dungeon-raids">
                {view.raids.map((r) => (
                  <Raid key={r.name} raid={r} characters={view.characters} onOpen={list.open} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      <p className="muted small">{t(T.herkunft)}</p>
      {list.dialog}
    </>
  );
}

/** Reiter Dungeons und Raids: Abenteuerkarte, Highlights und Raids über die ganze Gilde. */
export function DungeonOverview({ guild, onGuild }: { guild: string | null; onGuild(slug: string | null): void }) {
  const path = guild === null ? "/api/dungeons" : `/api/dungeons?gilde=${encodeURIComponent(guild)}`;
  const { data, error, loading } = useApi<GuildDungeonsView>(path);
  return (
    <DataState loading={loading} error={error}>
      {data && <Content view={data} onGuild={onGuild} />}
    </DataState>
  );
}
