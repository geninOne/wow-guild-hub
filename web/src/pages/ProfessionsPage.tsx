import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { CharacterRef, GuildRef, ProfessionRecipesView, ProfessionsView } from "../../../src/api/types";
import { ClassName } from "../components/ClassName";
import { DataState } from "../components/DataState";
import { FactionCrest } from "../components/FactionCrest";
import { GuildFilter } from "../components/GuildFilter";
import { Icon } from "../components/Icon";
import { RecipeCard } from "../components/RecipeCard";
import { useApi } from "../lib/api";
import { filterRecipes, MIN_QUERY } from "../lib/recipes";
import { translationIn, useLanguage, type Translations, type Language } from "../lib/language";

type Text = Translations;
type Fn<A extends unknown[]> = Translations<(...a: A) => string>;

const T = {
  title: { de: "Berufe", en: "Professions", schwaebisch: "Berufe", bayrisch: "Berufe" } as Text,
  subtitle: {
    de: "Wer welchen Beruf beherrscht und welche Rezepte kennt.",
    en: "Who has mastered which profession and knows which recipes.",
    schwaebisch: "Wer welchen Beruf ko ond welche Rezept kennt.",
    bayrisch: "Wer wos fia an Beruf ko und wos fia Rezepte kennt.",
  } as Text,
  characters: {
    de: (n: number) => (n === 1 ? "1 Charakter" : `${n} Charaktere`),
    en: (n: number) => (n === 1 ? "1 character" : `${n} characters`),
    schwaebisch: (n: number) => (n === 1 ? "1 Charakter" : `${n} Charaktere`),
    bayrisch: (n: number) => (n === 1 ? "1 Charakter" : `${n} Charaktere`),
  } as Fn<[number]>,
  inGuild: {
    de: (who: string, guild: string) => `${who} in ${guild}`,
    en: (who: string, guild: string) => `${who} in ${guild}`,
    schwaebisch: (who: string, guild: string) => `${who} in ${guild}`,
    bayrisch: (who: string, guild: string) => `${who} in ${guild}`,
  } as Fn<[string, string]>,
  inBothGuilds: {
    de: (who: string) => `${who} in beiden Gilden`,
    en: (who: string) => `${who} across both guilds`,
    schwaebisch: (who: string) => `${who} in boide Gilda`,
    bayrisch: (who: string) => `${who} in de zwoa Gildn`,
  } as Fn<[string]>,
  inTheGuild: {
    de: (who: string) => `${who} in der Gilde`,
    en: (who: string) => `${who} in the guild`,
    schwaebisch: (who: string) => `${who} in dr Gilde`,
    bayrisch: (who: string) => `${who} in da Gilde`,
  } as Fn<[string]>,
  professionsNav: { de: "Berufe", en: "Professions", schwaebisch: "Berufe", bayrisch: "Berufe" } as Text,
  chooseProfession: { de: "Beruf wählen", en: "Choose profession", schwaebisch: "Beruf wähla", bayrisch: "Beruf wähln" } as Text,
  searchRecipes: {
    de: (profession: string) => `Rezept in ${profession} suchen`,
    en: (profession: string) => `Search ${profession} recipes`,
    schwaebisch: (profession: string) => `Rezept in ${profession} sucha`,
    bayrisch: (profession: string) => `Rezept in ${profession} suachn`,
  } as Fn<[string]>,
  loadingRecipes: {
    de: "Rezepte werden geladen.",
    en: "Loading recipes.",
    schwaebisch: "D'Rezept werdet glada.",
    bayrisch: "De Rezepte wern gladn.",
  } as Text,
  recipesError: {
    de: "Rezepte konnten nicht geladen werden.",
    en: "Recipes could not be loaded.",
    schwaebisch: "D'Rezept hen sich net lada lassa.",
    bayrisch: "De Rezepte ham se ned ladn lassn.",
  } as Text,
  noMatch: { de: "Kein Rezept gefunden.", en: "No recipe found.", schwaebisch: "Koi Rezept gfonda.", bayrisch: "Koa Rezept gfundn." } as Text,
  noRecipes: {
    de: "Noch keine Rezepte bekannt.",
    en: "No recipes known yet.",
    schwaebisch: "No koine Rezept bekannt.",
    bayrisch: "No koane Rezepte bekannt.",
  } as Text,
  results: { de: "Treffer", en: "Results", schwaebisch: "Treffer", bayrisch: "Treffer" } as Text,
  recipes: { de: "Rezepte", en: "Recipes", schwaebisch: "Rezepte", bayrisch: "Rezepte" } as Text,
  people: { de: "Personen", en: "People", schwaebisch: "Personen", bayrisch: "Personen" } as Text,
  allRecipes: { de: "Alle Rezepte", en: "All recipes", schwaebisch: "Älle Rezept", bayrisch: "Olle Rezepte" } as Text,
  nobody: {
    de: (profession: string) => `Noch niemand hat ${profession} erlernt.`,
    en: (profession: string) => `Nobody has learned ${profession} yet.`,
    schwaebisch: (profession: string) => `No koiner hot ${profession} glernt.`,
    bayrisch: (profession: string) => `No koana hod ${profession} glernt.`,
  } as Fn<[string]>,
  nobodyFrom: {
    de: (guild: string, profession: string) => `Noch niemand aus ${guild} hat ${profession} erlernt.`,
    en: (guild: string, profession: string) => `Nobody from ${guild} has learned ${profession} yet.`,
    schwaebisch: (guild: string, profession: string) => `No koiner aus ${guild} hot ${profession} glernt.`,
    bayrisch: (guild: string, profession: string) => `No koana aus ${guild} hod ${profession} glernt.`,
  } as Fn<[string, string]>,
  noProfessions: {
    de: "Noch keine Berufe gesammelt.",
    en: "No professions collected yet.",
    schwaebisch: "No koine Berufe gsammlet.",
    bayrisch: "No koane Berufe gsammelt.",
  } as Text,
};

type Profession = ProfessionsView["professions"][number];

function fullName(c: CharacterRef): string {
  return c.surname ? `${c.name} ${c.surname}` : c.name;
}

/** Only characters of the chosen guild; null lets everyone through. */
function inGuild(c: CharacterRef | undefined, guildSlug: string | null): c is CharacterRef {
  return c !== undefined && (guildSlug === null || c.guildSlug === guildSlug);
}

/** Link to the character's "Berufe" tab, with the profession as the jump target. */
function CharacterLink({ character, profession }: { character: CharacterRef; profession: string }) {
  return (
    <Link to={`/charakter/${character.slug}?reiter=berufe#${profession}`} className="bench-person-link">
      <ClassName classId={character.classId} name={fullName(character)} />
    </Link>
  );
}

/** Real profession icon or a plain emblem with the initial letter. */
function ProfessionEmblem({ profession, size }: { profession: Profession; size: number }) {
  if (profession.icon) return <Icon src={profession.icon} alt="" size={size} />;
  return (
    <span className="bench-emblem" style={{ width: size, height: size, fontSize: size * 0.45 }} aria-hidden="true">
      {profession.name[0]}
    </span>
  );
}

function groupsOf(professions: Profession[]): [string, Profession[]][] {
  const groups = new Map<string, Profession[]>();
  for (const p of professions) groups.set(p.group, [...(groups.get(p.group) ?? []), p]);
  return [...groups];
}

function countText(n: number, guilds: GuildRef[], guildSlug: string | null, language: Language): string {
  const who = translationIn(T.characters, language)(n);
  if (guildSlug !== null) return translationIn(T.inGuild, language)(who, guilds.find((g) => g.slug === guildSlug)?.name ?? guildSlug);
  return guilds.length > 1 ? translationIn(T.inBothGuilds, language)(who) : translationIn(T.inTheGuild, language)(who);
}

function ProfessionNav({
  groups,
  active,
  count,
}: {
  groups: [string, Profession[]][];
  active: Profession;
  count: (p: Profession) => number;
}) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  return (
    <>
      <nav className="bench-nav" aria-label={t(T.professionsNav)}>
        {groups.map(([group, list]) => (
          <div key={group} className="bench-group">
            <h3 className="bench-group-title">{group}</h3>
            {list.map((p) => (
              <Link
                key={p.id}
                to={`/berufe/${p.slug}`}
                className="bench-nav-link"
                aria-current={p.id === active.id ? "page" : undefined}
              >
                <ProfessionEmblem profession={p} size={28} />
                <span className="bench-nav-name">{p.name}</span>
                <span className="bench-nav-count">{count(p)}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="bench-select">
        <select
          className="filter-input"
          aria-label={t(T.chooseProfession)}
          value={active.slug}
          onChange={(e) => navigate(`/berufe/${e.target.value}`)}
        >
          {groups.map(([group, list]) => (
            <optgroup key={group} label={group}>
              {list.map((p) => (
                <option key={p.id} value={p.slug}>
                  {p.name} ({count(p)})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    </>
  );
}

type DetailMode = "people" | "recipes";

function ProfessionDetail({
  view,
  profession,
  guildSlug,
}: {
  view: ProfessionsView;
  profession: Profession;
  guildSlug: string | null;
}) {
  const { t, language } = useLanguage();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<DetailMode>("people");
  const recipesApi = useApi<ProfessionRecipesView>(`/api/professions/${encodeURIComponent(profession.slug)}`);
  const members = useMemo(() => profession.members.filter((m) => inGuild(m, guildSlug)), [profession, guildSlug]);
  const guildName = (slug: string) => view.guilds.find((g) => g.slug === slug)?.name ?? "";
  const faction = (slug: string) => view.guilds.find((g) => g.slug === slug)?.faction ?? "";
  const searching = query.trim().length >= MIN_QUERY;
  // Recipes with the people of the chosen guild; people in the profession's order (skill, then name).
  const recipes = useMemo(
    () =>
      (recipesApi.data?.recipes ?? [])
        .map((r) => {
          const ids = new Set(r.characterIds);
          return { entry: r, people: members.filter((m) => ids.has(m.id)) };
        })
        .filter((r) => r.people.length > 0),
    [recipesApi.data, members],
  );
  const hits = useMemo(
    () => (searching ? filterRecipes(recipes.map((r) => ({ ...r, name: r.entry.name })), query) : []),
    [recipes, query, searching],
  );
  const label = t(T.searchRecipes)(profession.name);

  const recipeList = (list: typeof recipes, listLabel: string) => {
    if (recipesApi.loading) return <p className="muted">{t(T.loadingRecipes)}</p>;
    if (recipesApi.error) return <p className="muted">{t(T.recipesError)}</p>;
    if (list.length === 0) return <p className="muted">{searching ? t(T.noMatch) : t(T.noRecipes)}</p>;
    return (
      <ul className="recipe-cards" aria-label={listLabel}>
        {list.map((r) => (
          <RecipeCard
            key={r.entry.id ?? `name:${r.entry.name}`}
            entry={r.entry}
            people={r.people}
            profession={profession.slug}
            factionOf={faction}
          />
        ))}
      </ul>
    );
  };

  return (
    <section className="bench-detail" aria-labelledby="beruf-titel">
      <header className="bench-detail-head">
        <ProfessionEmblem profession={profession} size={56} />
        <div>
          <h2 className="bench-detail-title" id="beruf-titel">
            {profession.name}
          </h2>
          <p className="muted small">{countText(members.length, view.guilds, guildSlug, language)
}</p>
        </div>
      </header>

      <input
        className="filter-input bench-search"
        type="search"
        placeholder={label}
        aria-label={label}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {searching ? (
        recipeList(hits, t(T.results))
      ) : (
        <>
          <div className="bench-modes">
            <button
              type="button"
              className="bench-mode"
              aria-pressed={mode === "people"}
              onClick={() => setMode("people")}
            >
              {t(T.people)} ({members.length})
            </button>
            <button
              type="button"
              className="bench-mode"
              aria-pressed={mode === "recipes"}
              onClick={() => setMode("recipes")}
            >
              {recipesApi.data ? `${t(T.allRecipes)} (${recipes.length})` : t(T.allRecipes)}
            </button>
          </div>
          {mode === "recipes" ? (
            recipeList(recipes, t(T.recipes))
          ) : members.length === 0 ? (
            <p className="muted bench-empty">
              {guildSlug === null
                ? t(T.nobody)(profession.name)
                : t(T.nobodyFrom)(guildName(guildSlug), profession.name)}
            </p>
          ) : (
            <ul className="bench-people" aria-label={t(T.people)}>
              {members.map((m) => (
                <li key={m.id} className="bench-person">
                  <div className="bench-person-top">
                    <span className="bench-person-name">
                      <FactionCrest faction={faction(m.guildSlug)} />
                      <CharacterLink character={m} profession={profession.slug} />
                    </span>
                    <span className="num small muted">
                      {m.skill} / {m.max}
                    </span>
                  </div>
                  <p className="bench-person-sub">
                    {m.className ? `${m.className} · ` : ""}
                    {guildName(m.guildSlug)}
                  </p>
                  <span className="skill-bar" role="presentation">
                    <span className="skill-bar-fill" style={{ width: `${m.max > 0 ? Math.min(100, (m.skill / m.max) * 100) : 0}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function Workbench({ view, slug }: { view: ProfessionsView; slug: string | undefined }) {
  const { t } = useLanguage();
  const [guildSlug, setGuildSlug] = useState<string | null>(null);
  if (view.professions.length === 0) {
    return (
      <div className="state state-empty">
        <p>{t(T.noProfessions)}</p>
      </div>
    );
  }
  const active = view.professions.find((p) => p.slug === slug) ?? view.professions[0];
  const count = (p: Profession) => p.members.filter((m) => inGuild(m, guildSlug)).length;
  return (
    <>
      <GuildFilter guilds={view.guilds} value={guildSlug} onChange={setGuildSlug} />
      <div className="bench">
        <ProfessionNav groups={groupsOf(view.professions)} active={active} count={count} />
        <ProfessionDetail key={active.id} view={view} profession={active} guildSlug={guildSlug} />
      </div>
    </>
  );
}

export function ProfessionsPage() {
  const { beruf: slug } = useParams();
  const { t } = useLanguage();
  const { data, error, loading } = useApi<ProfessionsView>("/api/professions");
  return (
    <section className="page">
      <header className="page-header">
        <h1 className="page-title">{t(T.title)}</h1>
        <p className="page-subtitle muted">{t(T.subtitle)}</p>
      </header>
      <DataState loading={loading} error={error}>
        {data && <Workbench view={data} slug={slug} />}
      </DataState>
    </section>
  );
}
