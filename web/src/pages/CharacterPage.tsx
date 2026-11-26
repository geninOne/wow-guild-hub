import { useEffect, useRef } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router";
import { professionSlug } from "../../../src/transform/professions";
import type { CharacterView, TalentView } from "../../../src/api/types";
import { AttributesPanel } from "../components/AttributesPanel";
import { ClassName } from "../components/ClassName";
import { DataState } from "../components/DataState";
import { FactionCrest } from "../components/FactionCrest";
import { EquipmentPanel } from "../components/EquipmentPanel";
import { InstancesPanel } from "../components/InstancesPanel";
import { RecipeGrid } from "../components/RecipeGrid";
import { ReputationPanel } from "../components/ReputationPanel";
import { TalentTree } from "../components/TalentTree";
import { WrappedPanel } from "../components/WrappedCard";
import { OBERFLAECHEN_ERWEITERUNGEN } from "../erweiterungen";
import type { CharakterReiter } from "../erweiterungen/typen";
import { hasTitleBadge, TitleBadge } from "../components/TitleBadge";
import { weekLabel } from "../lib/fun";
import { useApi } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { useSprache, type Fassungen } from "../lib/sprache";

const TABS = [
  { id: "ausruestung", label: { de: "Ausrüstung", en: "Equipment", schwaebisch: "Ausrüschtung", bayrisch: "Ausrüstung" } },
  { id: "werte", label: { de: "Werte", en: "Stats", schwaebisch: "Werte", bayrisch: "Werte" } },
  { id: "talente", label: { de: "Talente", en: "Talents", schwaebisch: "Talente", bayrisch: "Talente" } },
  { id: "berufe", label: { de: "Berufe", en: "Professions", schwaebisch: "Berufe", bayrisch: "Berufe" } },
  { id: "dungeons", label: { de: "Dungeons & Raids", en: "Dungeons & Raids", schwaebisch: "Dungeons & Raids", bayrisch: "Dungeons & Raids" } },
  { id: "ruf", label: { de: "Ruf", en: "Reputation", schwaebisch: "Ruf", bayrisch: "Ruf" } },
  { id: "wrapped", label: { de: "Rückblick", en: "Recap", schwaebisch: "Rückblick", bayrisch: "Rückblick" } },
] as const satisfies readonly { id: string; label: Fassungen }[];

const T = {
  ehemalig: { de: "Ehemaliges Mitglied", en: "Former member", schwaebisch: "Ehemaligs Mitglied", bayrisch: "Ehemaligs Mitglied" },
  zuletztOnline: { de: "Zuletzt online", en: "Last online", schwaebisch: "Zletscht online", bayrisch: "Zletzt online" },
  titelTooltip: {
    de: (name: string, woche: string, wert: string) => `${name}, Titel der ${woche}: ${wert}`,
    en: (name: string, woche: string, wert: string) => `${name}, title for the ${woche.charAt(0).toLowerCase()}${woche.slice(1)}: ${wert}`,
    schwaebisch: (name: string, woche: string, wert: string) => `${name}, Titel vo dr ${woche}: ${wert}`,
    bayrisch: (name: string, woche: string, wert: string) => `${name}, Titel vo da ${woche}: ${wert}`,
  },
  talenteFehlen: {
    de: "Talentbäume sind noch nicht geladen.",
    en: "Talent trees have not been loaded yet.",
    schwaebisch: "D'Talentbäum sin no net glada.",
    bayrisch: "De Talentbaam san no ned gladn.",
  },
  keineBerufe: { de: "Keine Berufe erlernt", en: "No professions learned", schwaebisch: "Koine Berufe glernt", bayrisch: "Koane Berufe glernt" },
  rezepte: {
    de: (n: number) => (n === 1 ? "1 Rezept" : `${n} Rezepte`),
    en: (n: number) => (n === 1 ? "1 recipe" : `${n} recipes`),
    schwaebisch: (n: number) => (n === 1 ? "1 Rezept" : `${n} Rezept`),
    bayrisch: (n: number) => (n === 1 ? "1 Rezept" : `${n} Rezepte`),
  },
  ohneProfil: {
    de: "Blizzard zeigt Details zu Charakteren erst ab Level 10.",
    en: "Blizzard only shows character details from level 10.",
    schwaebisch: "Blizzard zeigt Details zu de Charaktere erscht ab Level 10.",
    bayrisch: "Blizzard zoagt Details zu de Charaktere erst ab Level 10.",
  },
  bereiche: { de: "Bereiche", en: "Sections", schwaebisch: "Bereiche", bayrisch: "Bereiche" },
  nichtGefunden: { de: "Charakter nicht gefunden", en: "Character not found", schwaebisch: "Charakter net gfonda", bayrisch: "Charakter ned gfundn" },
  unbekannt: {
    de: "Diesen Charakter kennen wir nicht.",
    en: "We don't know this character.",
    schwaebisch: "Den Charakter kennet mr net.",
    bayrisch: "Den Charakter kennan mia ned.",
  },
  gs: { de: "GS", en: "iLvl" },
  zurUebersicht: {
    de: "Zur Gildenübersicht",
    en: "Back to the guild overview",
    schwaebisch: "Zrück zur Gildenübersicht",
    bayrisch: "Zruck zur Gildnübersicht",
  },
} satisfies Record<string, Fassungen | Fassungen<(...a: never[]) => string>>;

type TabId = (typeof TABS)[number]["id"];

const DEFAULT_TAB: TabId = "ausruestung";

/** Reiter der Erweiterungen, hinter denen des Kerns; je Erweiterung mit ihrer Kennung für die Zusatzdaten. */
function erweiterungsReiter(): (CharakterReiter & { erweiterung: string })[] {
  return OBERFLAECHEN_ERWEITERUNGEN.flatMap((e) => (e.charakterReiter ?? []).map((r) => ({ ...r, erweiterung: e.id }))).filter(
    (r) => !TABS.some((t) => t.id === r.id),
  );
}

function isTabId(value: string | null): value is TabId {
  return TABS.some((tab) => tab.id === value);
}

/** Zusatzdaten einer Erweiterung aus der Antwort des Servers. */
function zusatz(view: CharacterView, id: string): unknown {
  const alle = view.erweiterungen;
  return alle && Object.hasOwn(alle, id) ? alle[id] : undefined;
}

function CharacterHeader({ view }: { view: CharacterView }) {
  const { t, sprache } = useSprache();
  const c = view.character;
  return (
    <header className="page-header character-header">
      <h1 className="page-title character-name">
        {c.name}
        {c.surname && (
          <>
            {" "}
            <span className="character-surname">{c.surname}</span>
          </>
        )}
      </h1>
      <p className="character-meta">
        {c.level} {view.raceName} <ClassName classId={c.classId} name={view.className} />{" "}
        <span className="guild-cell gold">
          <FactionCrest faction={view.guildFaction} />
          &lt;{view.guildName}&gt;
        </span>
        {c.rulesetName && <> {c.rulesetName}</>}
      </p>
      <p className="character-facts">
        {c.equippedItemLevel !== null && <span className="badge">{t(T.gs)} {c.equippedItemLevel}</span>}
        {view.rankName && <span className="badge badge-muted">{view.rankName}</span>}
        {OBERFLAECHEN_ERWEITERUNGEN.map(({ id, charakterKopf: Kopf }) => {
          const daten = zusatz(view, id);
          return Kopf && daten !== undefined && <Kopf key={id} daten={daten} view={view} />;
        })}
        {view.former && <span className="badge character-former">{t(T.ehemalig)}</span>}
        {(view.titles ?? []).map((titel) => {
          const name = t(titel.name);
          const tooltip = t(T.titelTooltip)(name, weekLabel(titel.from, titel.to, sprache), t(titel.valueText));
          return hasTitleBadge(titel.titleId) ? (
            <Link key={titel.titleId} to="/titel" className="title-medal-link" aria-label={name}>
              <TitleBadge titleId={titel.titleId} name={name} size={40} tooltip={tooltip} />
            </Link>
          ) : (
            <Link key={titel.titleId} to="/titel" className="badge-gold title-badge" title={tooltip}>
              {name}
            </Link>
          );
        })}
        {c.lastLoginAt && (
          <span className="muted small">
            {t(T.zuletztOnline)}: {formatDateTime(c.lastLoginAt)}
          </span>
        )}
      </p>
    </header>
  );
}

/* Inhalt je Reiter. */

function EquipmentTab({ view }: { view: CharacterView }) {
  return (
    <div className="panel">
      <EquipmentPanel character={view.character} itemIcons={view.itemIcons} />
    </div>
  );
}

function TalentsTab({ view }: { view: CharacterView }) {
  const { t } = useSprache();
  const { data, error, loading } = useApi<TalentView>("/api/talents/" + view.character.classId);
  if (error?.status === 404) {
    return (
      <div className="state state-empty">
        <p>{t(T.talenteFehlen)}</p>
      </div>
    );
  }
  return (
    <DataState loading={loading} error={error}>
      {data && <TalentTree view={data} specs={view.character.specs} />}
    </DataState>
  );
}

function ProfessionsTab({ view }: { view: CharacterView }) {
  const { t } = useSprache();
  const professions = [...view.character.professions].sort(
    (a, b) => Number(b.primary) - Number(a.primary) || a.name.localeCompare(b.name, "de"),
  );
  // Sprungziel aus der Adresse, z.B. #bergbau von der Berufe-Seite.
  const target = decodeURIComponent(useLocation().hash.slice(1));
  const highlighted = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    highlighted.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }, [target]);
  if (professions.length === 0) {
    return (
      <div className="state state-empty">
        <p>{t(T.keineBerufe)}</p>
      </div>
    );
  }
  return (
    <div className="panel character-professions">
      {professions.map((p) => {
        const slug = professionSlug(p.name);
        const hit = slug === target;
        return (
        <div
          key={p.id}
          ref={hit ? highlighted : undefined}
          id={`beruf-${slug}`}
          className={hit ? "character-profession character-profession-highlight" : "character-profession"}
        >
          <div className="profession-member">
            <strong>{p.name}</strong>
            <span className="skill-bar" role="presentation">
              <span className="skill-bar-fill" style={{ width: `${p.max > 0 ? Math.min(100, (p.skill / p.max) * 100) : 0}%` }} />
            </span>
            <span className="num small">
              {p.skill} / {p.max}
            </span>
            {p.recipes.length > 0 && (
              <span className="muted small profession-recipe-count">
                {t(T.rezepte)(p.recipes.length)}
              </span>
            )}
          </div>
          <RecipeGrid profession={p} recipes={view.recipes ?? {}} />
        </div>
        );
      })}
    </div>
  );
}

function TabContent({ tab, view }: { tab: string; view: CharacterView }) {
  const zusatzReiter = erweiterungsReiter().find((r) => r.id === tab);
  if (zusatzReiter) return <zusatzReiter.Komponente daten={zusatz(view, zusatzReiter.erweiterung)} view={view} />;
  if (!isTabId(tab)) return null;
  switch (tab) {
    case "ausruestung":
      return <EquipmentTab view={view} />;
    case "werte":
      return <AttributesPanel view={view.attributes} />;
    case "talente":
      return <TalentsTab view={view} />;
    case "berufe":
      return <ProfessionsTab view={view} />;
    case "dungeons":
      return <InstancesPanel view={view.instances} />;
    case "ruf":
      return <ReputationPanel view={view.reputation} />;
    case "wrapped":
      return <WrappedPanel slug={view.character.slug} />;
  }
}

function CharacterContent({ view }: { view: CharacterView }) {
  const { t } = useSprache();
  const [params, setParams] = useSearchParams();
  const requested = params.get("reiter");
  const alleReiter: { id: string; label: Fassungen }[] = [...TABS, ...erweiterungsReiter()];
  const tab = alleReiter.find((r) => r.id === requested)?.id ?? DEFAULT_TAB;

  if (!view.character.hasProfile) {
    return (
      <>
        <CharacterHeader view={view} />
        <div className="state state-empty">
          <p>{t(T.ohneProfil)}</p>
        </div>
        {/* Ohne Profil gibt es keine Reiter; Reiter von Erweiterungen mit Daten stehen dann darunter. */}
        {erweiterungsReiter().map((r) => {
          const daten = zusatz(view, r.erweiterung);
          return daten !== undefined && <r.Komponente key={r.id} daten={daten} view={view} />;
        })}
      </>
    );
  }

  function select(id: string) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id === DEFAULT_TAB) next.delete("reiter");
        else next.set("reiter", id);
        return next;
      },
      { replace: true },
    );
  }

  return (
    <>
      <CharacterHeader view={view} />
      <div className="tabs" role="tablist" aria-label={t(T.bereiche)}>
        {alleReiter.map((reiter) => (
          <button
            key={reiter.id}
            type="button"
            role="tab"
            id={`reiter-${reiter.id}`}
            aria-selected={reiter.id === tab}
            aria-controls="reiter-inhalt"
            className="tab"
            onClick={() => select(reiter.id)}
          >
            {t(reiter.label)}
          </button>
        ))}
      </div>
      <div id="reiter-inhalt" role="tabpanel" aria-labelledby={`reiter-${tab}`}>
        <TabContent tab={tab} view={view} />
      </div>
    </>
  );
}

function NotFound() {
  const { t } = useSprache();
  return (
    <>
      <header className="page-header">
        <h1 className="page-title">{t(T.nichtGefunden)}</h1>
      </header>
      <div className="panel">
        <p>{t(T.unbekannt)}</p>
        <p>
          <Link to="/">{t(T.zurUebersicht)}</Link>
        </p>
      </div>
    </>
  );
}

export function CharacterPage() {
  const { key = "" } = useParams();
  const { data, error, loading } = useApi<CharacterView>(`/api/characters/${encodeURIComponent(key)}`);

  return (
    <section className="page character-page">
      {error?.status === 404 ? (
        <NotFound />
      ) : (
        <DataState loading={loading} error={error}>
          {data && <CharacterContent view={data} />}
        </DataState>
      )}
    </section>
  );
}
