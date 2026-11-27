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
  former: { de: "Ehemaliges Mitglied", en: "Former member", schwaebisch: "Ehemaligs Mitglied", bayrisch: "Ehemaligs Mitglied" },
  lastOnline: { de: "Zuletzt online", en: "Last online", schwaebisch: "Zletscht online", bayrisch: "Zletzt online" },
  titleTooltip: {
    de: (name: string, week: string, value: string) => `${name}, Titel der ${week}: ${value}`,
    en: (name: string, week: string, value: string) => `${name}, title for the ${week.charAt(0).toLowerCase()}${week.slice(1)}: ${value}`,
    schwaebisch: (name: string, week: string, value: string) => `${name}, Titel vo dr ${week}: ${value}`,
    bayrisch: (name: string, week: string, value: string) => `${name}, Titel vo da ${week}: ${value}`,
  },
  talentsMissing: {
    de: "Talentbäume sind noch nicht geladen.",
    en: "Talent trees have not been loaded yet.",
    schwaebisch: "D'Talentbäum sin no net glada.",
    bayrisch: "De Talentbaam san no ned gladn.",
  },
  noProfessions: { de: "Keine Berufe erlernt", en: "No professions learned", schwaebisch: "Koine Berufe glernt", bayrisch: "Koane Berufe glernt" },
  recipes: {
    de: (n: number) => (n === 1 ? "1 Rezept" : `${n} Rezepte`),
    en: (n: number) => (n === 1 ? "1 recipe" : `${n} recipes`),
    schwaebisch: (n: number) => (n === 1 ? "1 Rezept" : `${n} Rezept`),
    bayrisch: (n: number) => (n === 1 ? "1 Rezept" : `${n} Rezepte`),
  },
  noProfile: {
    de: "Blizzard zeigt Details zu Charakteren erst ab Level 10.",
    en: "Blizzard only shows character details from level 10.",
    schwaebisch: "Blizzard zeigt Details zu de Charaktere erscht ab Level 10.",
    bayrisch: "Blizzard zoagt Details zu de Charaktere erst ab Level 10.",
  },
  sections: { de: "Bereiche", en: "Sections", schwaebisch: "Bereiche", bayrisch: "Bereiche" },
  notFound: { de: "Charakter nicht gefunden", en: "Character not found", schwaebisch: "Charakter net gfonda", bayrisch: "Charakter ned gfundn" },
  unknown: {
    de: "Diesen Charakter kennen wir nicht.",
    en: "We don't know this character.",
    schwaebisch: "Den Charakter kennet mr net.",
    bayrisch: "Den Charakter kennan mia ned.",
  },
  gs: { de: "GS", en: "iLvl" },
  backToOverview: {
    de: "Zur Gildenübersicht",
    en: "Back to the guild overview",
    schwaebisch: "Zrück zur Gildenübersicht",
    bayrisch: "Zruck zur Gildnübersicht",
  },
} satisfies Record<string, Fassungen | Fassungen<(...a: never[]) => string>>;

type TabId = (typeof TABS)[number]["id"];

const DEFAULT_TAB: TabId = "ausruestung";

/** Tabs of the extensions, after the core ones; each with its extension's id for the extra data. */
function extensionTabs(): (CharakterReiter & { extension: string })[] {
  return OBERFLAECHEN_ERWEITERUNGEN.flatMap((e) => (e.charakterReiter ?? []).map((r) => ({ ...r, extension: e.id }))).filter(
    (r) => !TABS.some((t) => t.id === r.id),
  );
}

function isTabId(value: string | null): value is TabId {
  return TABS.some((tab) => tab.id === value);
}

/** Extra data of an extension from the server's response. */
function extensionData(view: CharacterView, id: string): unknown {
  const all = view.erweiterungen;
  return all && Object.hasOwn(all, id) ? all[id] : undefined;
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
        {OBERFLAECHEN_ERWEITERUNGEN.map(({ id, charakterKopf: Header }) => {
          const data = extensionData(view, id);
          return Header && data !== undefined && <Header key={id} daten={data} view={view} />;
        })}
        {view.former && <span className="badge character-former">{t(T.former)}</span>}
        {(view.titles ?? []).map((title) => {
          const name = t(title.name);
          const tooltip = t(T.titleTooltip)(name, weekLabel(title.from, title.to, sprache), t(title.valueText));
          return hasTitleBadge(title.titleId) ? (
            <Link key={title.titleId} to="/titel" className="title-medal-link" aria-label={name}>
              <TitleBadge titleId={title.titleId} name={name} size={40} tooltip={tooltip} />
            </Link>
          ) : (
            <Link key={title.titleId} to="/titel" className="badge-gold title-badge" title={tooltip}>
              {name}
            </Link>
          );
        })}
        {c.lastLoginAt && (
          <span className="muted small">
            {t(T.lastOnline)}: {formatDateTime(c.lastLoginAt)}
          </span>
        )}
      </p>
    </header>
  );
}

/* Content per tab. */

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
        <p>{t(T.talentsMissing)}</p>
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
  // Jump target from the address, e.g. #bergbau from the professions page.
  const target = decodeURIComponent(useLocation().hash.slice(1));
  const highlighted = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    highlighted.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }, [target]);
  if (professions.length === 0) {
    return (
      <div className="state state-empty">
        <p>{t(T.noProfessions)}</p>
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
                {t(T.recipes)(p.recipes.length)}
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
  const extensionTab = extensionTabs().find((r) => r.id === tab);
  if (extensionTab) return <extensionTab.Komponente daten={extensionData(view, extensionTab.extension)} view={view} />;
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
  const allTabs: { id: string; label: Fassungen }[] = [...TABS, ...extensionTabs()];
  const tab = allTabs.find((r) => r.id === requested)?.id ?? DEFAULT_TAB;

  if (!view.character.hasProfile) {
    return (
      <>
        <CharacterHeader view={view} />
        <div className="state state-empty">
          <p>{t(T.noProfile)}</p>
        </div>
        {/* Without a profile there are no tabs; extension tabs with data are then shown below. */}
        {extensionTabs().map((r) => {
          const data = extensionData(view, r.extension);
          return data !== undefined && <r.Komponente key={r.id} daten={data} view={view} />;
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
      <div className="tabs" role="tablist" aria-label={t(T.sections)}>
        {allTabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            id={`reiter-${entry.id}`}
            aria-selected={entry.id === tab}
            aria-controls="reiter-inhalt"
            className="tab"
            onClick={() => select(entry.id)}
          >
            {t(entry.label)}

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
        <h1 className="page-title">{t(T.notFound)}</h1>
      </header>
      <div className="panel">
        <p>{t(T.unknown)}</p>
        <p>
          <Link to="/">{t(T.backToOverview)}</Link>
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
