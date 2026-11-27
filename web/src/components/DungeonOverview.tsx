import type { CSSProperties } from "react";
import type { GuildDungeonsView, GuildDungeonView, GuildRaidView } from "../../../src/api/types";
import { useApi } from "../lib/api";
import { formatPlainDate } from "../lib/fun";
import { translationIn, useLanguage, type Translations, type Language } from "../lib/language";
import { CharacterLink } from "./CharacterLink";
import { DataState } from "./DataState";
import { GuildFilter } from "./GuildFilter";
import { VIEW_ALL, MemberListTrigger, PeopleIcon, useMemberList, type MemberListRequest } from "./MemberList";
import { numberLocale } from "../lib/format";

const fmt = (n: number) => n.toLocaleString(numberLocale());

const T = {
  to: { de: "bis", en: "to", schwaebisch: "bis", bayrisch: "bis" },
  byLevel: { de: "Dungeons nach Level", en: "Dungeons by level", schwaebisch: "Dungeons nach Level", bayrisch: "Dungeons nach Level" },
  nobodyYet: { de: "noch niemand", en: "nobody yet", schwaebisch: "no koiner", bayrisch: "no koana" },
  untracked: { de: "ohne Statistik", en: "not tracked", schwaebisch: "ohne Statistik", bayrisch: "ohne Statistik" },
  untrackedTitle: {
    de: "Blizzard führt den Endboss dieses Dungeons nicht in der Statistik der Charaktere. Wer durch ist, lässt sich deshalb nicht je Charakter sagen.",
    en: "Blizzard does not track this dungeon's final boss in character statistics, so clears cannot be told per character.",
    schwaebisch: "Blizzard führt den Endboss vo dem Dungeon net en dr Statistik vo de Charakter. Wer durch isch, woiß mr deshalb net.",
    bayrisch: "Blizzard führt an Endboss vo dem Dungeon ned in da Statistik vo de Charaktere. Wer durch is, woaß ma deshoib ned.",
  },
  cleared: { de: (n: string) => `${n} durch`, en: (n: string) => `${n} cleared`, schwaebisch: (n: string) => `${n} durch`, bayrisch: (n: string) => `${n} durch` },
  clearedCount: { de: (n: number) => `${n} geschafft`, en: (n: number) => `${n} cleared`, schwaebisch: (n: number) => `${n} gschafft`, bayrisch: (n: number) => `${n} gschafft` },
  locked: { de: "verschlossen", en: "locked", schwaebisch: "verschlosse", bayrisch: "zuagsperrt" },
  favoriteDungeon: { de: "Lieblingsdungeon", en: "Favorite dungeon", schwaebisch: "Lieblingsdungeon", bayrisch: "Lieblingsdungeon" },
  charactersCleared: {
    de: (n: string) => `${n} Charaktere durch`,
    en: (n: string) => `${n} characters cleared it`,
    schwaebisch: (n: string) => `${n} Charakter durch`,
    bayrisch: (n: string) => `${n} Charaktere durch`,
  },
  nothingCleared: {
    de: "Bisher war noch niemand irgendwo durch.",
    en: "Nobody has cleared anything yet.",
    schwaebisch: "No koiner nirgends durch.",
    bayrisch: "No koana nirgends durch.",
  },
  nextGoal: { de: "Nächstes Gildenziel", en: "Next guild goal", schwaebisch: "Nächschtes Gildeziel", bayrisch: "Nächsts Gildnziel" },
  nobodyInside: {
    de: "Dort war noch niemand drin",
    en: "Nobody has been inside yet",
    schwaebisch: "Do war no koiner drin",
    bayrisch: "Do war no koana drin",
  },
  allCleared: { de: "Alles geschafft. Respekt!", en: "Everything cleared. Respect!", schwaebisch: "Älles gschafft. Respekt!", bayrisch: "Ois gschafft. Respekt!" },
  regular: { de: "Dauergast", en: "Regular", schwaebisch: "Dauergascht", bayrisch: "Stammgast" },
  noRegulars: { de: "Noch kein Stammgast.", en: "No regulars yet.", schwaebisch: "No koi Stammgascht.", bayrisch: "No koa Stammgast." },
  bosses: { de: "Bosse", en: "Bosses", schwaebisch: "Bosse", bayrisch: "Bosse" },
  fullyCleared: {
    de: (n: string, total: string) => `${n} von ${total} Charakteren ganz durch.`,
    en: (n: string, total: string) => `${n} of ${total} characters cleared it fully.`,
    schwaebisch: (n: string, total: string) => `${n} vo ${total} Charakter ganz durch.`,
    bayrisch: (n: string, total: string) => `${n} vo ${total} Charakter ganz durch.`,
  },
  started: {
    de: "Angefangen, aber noch nicht fertig.",
    en: "Started, but not finished yet.",
    schwaebisch: "Agfange, aber no net fertig.",
    bayrisch: "Ogfangt, aber no ned firti.",
  },
  whoDares: {
    de: "Noch niemand drin. Wer traut sich?",
    en: "Nobody inside yet. Who dares?",
    schwaebisch: "No koiner drin. Wer traut sich?",
    bayrisch: "No koana drin. Wer traut si?",
  },
  withProfile: {
    de: (n: string) => `${n} Charaktere mit Profil`,
    en: (n: string) => `${n} characters with a profile`,
    schwaebisch: (n: string) => `${n} Charakter mit Profil`,
    bayrisch: (n: string) => `${n} Charaktere mit Profil`,
  },
  lastFinalBoss: {
    de: (d: string) => ` · letzter Endboss am ${d}`,
    en: (d: string) => ` · last final boss on ${d}`,
    schwaebisch: (d: string) => ` · letschter Endboss am ${d}`,
    bayrisch: (d: string) => ` · letzta Endboss am ${d}`,
  },
  listMissing: {
    de: "Die Dungeon-Liste von Blizzard fehlt noch. Sie kommt mit dem nächsten Lauf des Sammlers.",
    en: "The dungeon list from Blizzard is still missing. It arrives with the collector's next run.",
    schwaebisch: "D'Dungeon-Lischt vo Blizzard fehlt no. Die kommt mitm nächschte Lauf vom Sammler.",
    bayrisch: "D'Dungeon-Listn vo Blizzard fehlt no. De kimmt mim nächstn Lauf vom Sammler.",
  },
  adventureMap: { de: "Abenteuerkarte", en: "Adventure map", schwaebisch: "Abenteuerkart", bayrisch: "Abenteuerkartn" },
  furthestAhead: {
    de: (d: string) => `Am weitesten vorn: ${d}.`,
    en: (d: string) => `Furthest ahead: ${d}.`,
    schwaebisch: (d: string) => `Am weitschte vorne: ${d}.`,
    bayrisch: (d: string) => `Am weitastn vorn: ${d}.`,
  },
  fromCellar: {
    de: "Vom ersten Keller bis zur Burg: Wo war die Gilde schon?",
    en: "From the first cellar to the castle: where has the guild been?",
    schwaebisch: "Vom erschte Keller bis zur Burg: Wo war d'Gilde scho?",
    bayrisch: "Vom erstn Keller bis zur Burg: Wo war d'Gilde scho?",
  },
  clearedBy: {
    de: (n: number): string => (n === 1 ? " Geschafft hat es " : " Geschafft haben es "),
    en: (n: number): string => (n === 1 ? " Cleared by " : " Cleared by "),
    schwaebisch: (n: number): string => (n === 1 ? " Gschafft hot's " : " Gschafft hend's "),
    bayrisch: (n: number): string => (n === 1 ? " Gschafft hod's " : " Gschafft ham's "),
  },
  and: { de: " und ", en: " and ", schwaebisch: " ond ", bayrisch: " und " },
  raidBlurb: {
    de: "Die großen Brocken. Mit vierzig Leuten und guter Laune.",
    en: "The big ones. Forty people and good spirits.",
    schwaebisch: "Die große Brocke. Mit vierzig Leut ond guter Laune.",
    bayrisch: "De großn Brockn. Mit vierzg Leit und guada Laune.",
  },
  source: {
    de: 'Aus der Boss-Statistik aller aktiven Mitglieder mit Profil. "Durch" heißt: Der Charakter hat den Endboss selbst besiegt. Blizzards Dungeon-Erfolge gelten für den ganzen Account und zählen deshalb nicht, sonst würde jeder Twink mitzählen. Gegenstücke beider Fraktionen wie Flammenschlund und Halle der Thanen zählen zusammen.',
    en: 'Based on the boss statistics of all active members with a profile. "Cleared" means: the character defeated the final boss themselves. Blizzard\'s dungeon achievements are account-wide and do not count, otherwise every alt would count too. Horde and Alliance counterparts of the same dungeon count together.',
    schwaebisch: 'Aus dr Boss-Statistik vo älle aktive Mitglieder mit Profil. "Durch" hoißt: Dr Charakter hot den Endboss selber bsiegt. Blizzards Dungeon-Erfolg gelten fürs ganze Account ond zählet deshalb net, sonscht dät jeder Twink mitzähle. Gegestück vo beide Fraktiona wie Flammenschlund ond Halle der Thanen zählet zamme.',
    bayrisch: 'Aus da Boss-Statistik vo olle aktivn Mitglieder mit Profil. "Durch" hoaßt: Da Charakter hod an Endboss söiba bsiegt. Blizzards Dungeon-Erfolge geltn fürs ganze Account und zähln deshoib ned, sonst dad jeda Twink mitzähln. Gegnstückl vo boade Fraktionen wia Flammenschlund und Halle der Thanen zähln zamm.',
  },
} satisfies Record<string, Translations<unknown>>;
const L = {
  finalBossKills: { de: "Endboss-Siege", en: "Final boss kills", schwaebisch: "Endboss-Sieg", bayrisch: "Endboss-Siege" },
  bossesDefeated: { de: "Bosse besiegt", en: "Bosses defeated", schwaebisch: "Bosse bsiegt", bayrisch: "Bosse bsiegt" },
  viewAll: {
    de: (n: string) => `Alle ${n} ansehen`,
    en: (n: string) => `View all ${n}`,
    schwaebisch: (n: string) => `Älle ${n} aagucke`,
    bayrisch: (n: string) => `Olle ${n} oschaun`,
  },
} satisfies Record<string, Translations<unknown>>;

const idx = (i: number) => ({ "--i": i }) as CSSProperties;

function levelText(d: { levels: { min: number; max: number } | null }, language: Language = "de"): string | null {
  if (!d.levels) return null;
  return d.levels.min === d.levels.max ? `Level ${d.levels.min}` : `Level ${d.levels.min} ${translationIn(T.to, language)} ${d.levels.max}`;
}

/** Round image; without an image, the initial letter on stone. */
function Medallion({ name, image, className }: { name: string; image: string | null; className: string }) {
  return image ? (
    <img className={className} src={image} alt="" loading="lazy" />
  ) : (
    <span className={`${className} dungeon-noimg`} aria-hidden="true">
      {name.charAt(0)}
    </span>
  );
}

/** Adventure map: dungeons as stops by level, brighter the more have cleared them, unvisited ones in fog. */
function AdventureMap({ view, onOpen }: { view: GuildDungeonsView; onOpen(request: MemberListRequest): void }) {
  const { t, language } = useLanguage();
  const max = Math.max(1, ...view.dungeons.map((d) => d.completed));
  return (
    <ol className="dungeon-map" aria-label={t(T.byLevel)}>
      {view.dungeons.map((d, i) => {
        const glow = d.completed / max;
        return (
          <li
            key={d.key}
            className={`dungeon-stop${d.completed === 0 && d.tracked ? " dungeon-fog" : ""}${d.tracked ? "" : " dungeon-untracked"}`}
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
                    subtitle: levelText(d, language) ?? undefined,
                    sets: [{ key: d.key, label: d.name, valueLabel: t(L.finalBossKills), entries: d.who }],
                    fixedGuild: true,
                  })
                }
              >
                <Medallion name={d.name} image={d.image} className="dungeon-stop-img" />
                <span className="dungeon-stop-name">{d.name}</span>
                {levelText(d, language) && <span className="dungeon-stop-level muted small">{levelText(d, language)}</span>}
                <span className="dungeon-stop-count small">
                  <PeopleIcon />
                  {t(T.cleared)(fmt(d.completed))}
                </span>
                <span className="sr-only">, {t(VIEW_ALL)}</span>
              </button>
            ) : (
              <>
                <Medallion name={d.name} image={d.image} className="dungeon-stop-img" />
                <span className="dungeon-stop-name">{d.name}</span>
                {levelText(d, language) && <span className="dungeon-stop-level muted small">{levelText(d, language)}</span>}
                {d.tracked ? (
                  <span className="dungeon-stop-count small">
                    {d.completed === 0 ? t(T.nobodyYet) : t(T.cleared)(fmt(d.completed))}
                  </span>
                ) : (
                  <span className="dungeon-stop-count dungeon-stop-untracked small" title={t(T.untrackedTitle)}>
                    {t(T.untracked)}
                  </span>
                )}
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
              {view.raids.some((r) => r.completed > 0) ? t(T.clearedCount)(view.raids.filter((r) => r.completed > 0).length) : t(T.locked)}
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

/** Favorite dungeon, next guild goal and regular. */
function Highlights({ view }: { view: GuildDungeonsView }) {
  const { t, language } = useLanguage();
  // Dungeons without statistics say nothing about the guild: neither favorite nor next goal.
  const tracked = view.dungeons.filter((d) => d.tracked);
  const favourite = [...tracked].sort((a, b) => b.completed - a.completed)[0] ?? null;
  const next = tracked.find((d) => d.completed === 0) ?? null;
  const regular = [...view.dungeons].filter((d) => d.best).sort((a, b) => b.best!.times - a.best!.times)[0] ?? null;
  return (
    <ul className="dungeon-highlights">
      <Highlight kicker={t(T.favoriteDungeon)} dungeon={favourite}>
        {favourite && favourite.completed > 0 ? (
          <>
            <strong>{favourite.name}</strong>
            <span className="muted small">{t(T.charactersCleared)(fmt(favourite.completed))}</span>
          </>
        ) : (
          <span className="muted">{t(T.nothingCleared)}</span>
        )}
      </Highlight>
      <Highlight kicker={t(T.nextGoal)} dungeon={next}>
        {next ? (
          <>
            <strong>{next.name}</strong>
            <span className="muted small">
              {t(T.nobodyInside)}
              {levelText(next, language) ? `, ${levelText(next, language)}` : ""}.
            </span>
          </>
        ) : (
          <span className="muted">{t(T.allCleared)}</span>
        )}
      </Highlight>
      <Highlight kicker={t(T.regular)} dungeon={regular}>
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
          <span className="muted">{t(T.noRegulars)}</span>
        )}
      </Highlight>
    </ul>
  );
}

function Raid({ raid, characters, onOpen }: { raid: GuildRaidView; characters: number; onOpen(request: MemberListRequest): void }) {
  const { t, language } = useLanguage();
  const any = raid.bosses.some((b) => b.defeated > 0);
  return (
    <li className={`dungeon-raid${any ? "" : " dungeon-raid-locked"}`}>
      {raid.image ? (
        <img className="dungeon-raid-img" src={raid.image} alt="" loading="lazy" />
      ) : (
        <span className="dungeon-raid-img dungeon-noimg" aria-hidden="true" />
      )}
      <h3 className="dungeon-raid-name">{raid.name}</h3>
      {levelText(raid, language) && <p className="muted small">{levelText(raid, language)}</p>}
      <ul className="dungeon-bosses" aria-label={`${t(T.bosses)}: ${raid.name}`}>
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
          ? t(T.fullyCleared)(fmt(raid.completed), fmt(characters))
          : any
            ? t(T.started)
            : t(T.whoDares)}
      </p>
      {(raid.who ?? []).length > 0 && (
        <MemberListTrigger
          label={`${t(L.viewAll)(fmt(raid.who.length))}: ${t(L.bossesDefeated)}, ${raid.name}`}
          onClick={() =>
            onOpen({
              title: raid.name,
              subtitle: levelText(raid, language) ?? undefined,
              sets: [{ key: raid.name, label: raid.name, valueLabel: t(L.bossesDefeated), entries: raid.who }],
              fixedGuild: true,
            })
          }
        >
          {t(L.viewAll)(fmt(raid.who.length))}
        </MemberListTrigger>
      )}
    </li>
  );
}

function Content({ view, onGuild }: { view: GuildDungeonsView; onGuild(slug: string | null): void }) {
  const { t } = useLanguage();
  // The response is already filtered by guild, so no own switch in the dialog.
  const list = useMemberList(view.guild);
  const last = view.dungeons.map((d) => d.lastAt).filter((x): x is string => x !== null).sort().at(-1);
  return (
    <>
      <div className="stats-period">
        <GuildFilter guilds={view.guilds} value={view.guild} onChange={onGuild} />
      </div>
      <p className="page-subtitle muted">
        {t(T.withProfile)(fmt(view.characters))}
        {last && t(T.lastFinalBoss)(formatPlainDate(last.slice(0, 10)))}
      </p>
      {!view.available ? (
        <div className="state state-empty" role="status">
          <p>{t(T.listMissing)}</p>
        </div>
      ) : (
        <>
          <section className="panel dungeon-panel" aria-labelledby="abenteuerkarte">
            <header className="panel-header stat-theme-header">
              <h2 className="panel-title" id="abenteuerkarte">
                {t(T.adventureMap)}
              </h2>
              <p className="stat-theme-blurb">
                {view.frontier ? t(T.furthestAhead)(view.frontier.dungeon) : t(T.fromCellar)}
                {view.frontier && t(T.clearedBy)(view.frontier.characters.length)}
                {view.frontier?.characters.map((c, i, all) => (
                  <span key={c.id}>
                    {i > 0 && (i === all.length - 1 ? t(T.and) : ", ")}
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
                <p className="stat-theme-blurb">{t(T.raidBlurb)}</p>
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
      <p className="muted small">{t(T.source)}</p>
      {list.dialog}
    </>
  );
}

/** Dungeons and raids tab: adventure map, highlights and raids across the whole guild. */

export function DungeonOverview({ guild, onGuild }: { guild: string | null; onGuild(slug: string | null): void }) {
  const path = guild === null ? "/api/dungeons" : `/api/dungeons?guild=${encodeURIComponent(guild)}`;
  const { data, error, loading } = useApi<GuildDungeonsView>(path);
  return (
    <DataState loading={loading} error={error}>
      {data && <Content view={data} onGuild={onGuild} />}
    </DataState>
  );
}
