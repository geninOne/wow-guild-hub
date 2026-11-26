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
import { fassungIn, useSprache, type Fassungen, type Sprache } from "../lib/sprache";

type Text = Fassungen;
type Fn<A extends unknown[]> = Fassungen<(...a: A) => string>;

const T = {
  titel: { de: "Berufe", en: "Professions", schwaebisch: "Berufe", bayrisch: "Berufe" } as Text,
  untertitel: {
    de: "Wer welchen Beruf beherrscht und welche Rezepte kennt.",
    en: "Who has mastered which profession and knows which recipes.",
    schwaebisch: "Wer welchen Beruf ko ond welche Rezept kennt.",
    bayrisch: "Wer wos fia an Beruf ko und wos fia Rezepte kennt.",
  } as Text,
  charaktere: {
    de: (n: number) => (n === 1 ? "1 Charakter" : `${n} Charaktere`),
    en: (n: number) => (n === 1 ? "1 character" : `${n} characters`),
    schwaebisch: (n: number) => (n === 1 ? "1 Charakter" : `${n} Charaktere`),
    bayrisch: (n: number) => (n === 1 ? "1 Charakter" : `${n} Charaktere`),
  } as Fn<[number]>,
  inGilde: {
    de: (wer: string, gilde: string) => `${wer} in ${gilde}`,
    en: (wer: string, gilde: string) => `${wer} in ${gilde}`,
    schwaebisch: (wer: string, gilde: string) => `${wer} in ${gilde}`,
    bayrisch: (wer: string, gilde: string) => `${wer} in ${gilde}`,
  } as Fn<[string, string]>,
  inBeiden: {
    de: (wer: string) => `${wer} in beiden Gilden`,
    en: (wer: string) => `${wer} across both guilds`,
    schwaebisch: (wer: string) => `${wer} in boide Gilda`,
    bayrisch: (wer: string) => `${wer} in de zwoa Gildn`,
  } as Fn<[string]>,
  inDerGilde: {
    de: (wer: string) => `${wer} in der Gilde`,
    en: (wer: string) => `${wer} in the guild`,
    schwaebisch: (wer: string) => `${wer} in dr Gilde`,
    bayrisch: (wer: string) => `${wer} in da Gilde`,
  } as Fn<[string]>,
  berufeNav: { de: "Berufe", en: "Professions", schwaebisch: "Berufe", bayrisch: "Berufe" } as Text,
  berufWaehlen: { de: "Beruf wählen", en: "Choose profession", schwaebisch: "Beruf wähla", bayrisch: "Beruf wähln" } as Text,
  rezeptSuchen: {
    de: (beruf: string) => `Rezept in ${beruf} suchen`,
    en: (beruf: string) => `Search ${beruf} recipes`,
    schwaebisch: (beruf: string) => `Rezept in ${beruf} sucha`,
    bayrisch: (beruf: string) => `Rezept in ${beruf} suachn`,
  } as Fn<[string]>,
  rezepteLaden: {
    de: "Rezepte werden geladen.",
    en: "Loading recipes.",
    schwaebisch: "D'Rezept werdet glada.",
    bayrisch: "De Rezepte wern gladn.",
  } as Text,
  rezepteFehler: {
    de: "Rezepte konnten nicht geladen werden.",
    en: "Recipes could not be loaded.",
    schwaebisch: "D'Rezept hen sich net lada lassa.",
    bayrisch: "De Rezepte ham se ned ladn lassn.",
  } as Text,
  keinTreffer: { de: "Kein Rezept gefunden.", en: "No recipe found.", schwaebisch: "Koi Rezept gfonda.", bayrisch: "Koa Rezept gfundn." } as Text,
  keineRezepte: {
    de: "Noch keine Rezepte bekannt.",
    en: "No recipes known yet.",
    schwaebisch: "No koine Rezept bekannt.",
    bayrisch: "No koane Rezepte bekannt.",
  } as Text,
  treffer: { de: "Treffer", en: "Results", schwaebisch: "Treffer", bayrisch: "Treffer" } as Text,
  rezepte: { de: "Rezepte", en: "Recipes", schwaebisch: "Rezepte", bayrisch: "Rezepte" } as Text,
  personen: { de: "Personen", en: "People", schwaebisch: "Personen", bayrisch: "Personen" } as Text,
  alleRezepte: { de: "Alle Rezepte", en: "All recipes", schwaebisch: "Älle Rezept", bayrisch: "Olle Rezepte" } as Text,
  niemand: {
    de: (beruf: string) => `Noch niemand hat ${beruf} erlernt.`,
    en: (beruf: string) => `Nobody has learned ${beruf} yet.`,
    schwaebisch: (beruf: string) => `No koiner hot ${beruf} glernt.`,
    bayrisch: (beruf: string) => `No koana hod ${beruf} glernt.`,
  } as Fn<[string]>,
  niemandAus: {
    de: (gilde: string, beruf: string) => `Noch niemand aus ${gilde} hat ${beruf} erlernt.`,
    en: (gilde: string, beruf: string) => `Nobody from ${gilde} has learned ${beruf} yet.`,
    schwaebisch: (gilde: string, beruf: string) => `No koiner aus ${gilde} hot ${beruf} glernt.`,
    bayrisch: (gilde: string, beruf: string) => `No koana aus ${gilde} hod ${beruf} glernt.`,
  } as Fn<[string, string]>,
  keineBerufe: {
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

/** Nur Charaktere der gewählten Gilde; null lässt alle durch. */
function inGuild(c: CharacterRef | undefined, guildSlug: string | null): c is CharacterRef {
  return c !== undefined && (guildSlug === null || c.guildSlug === guildSlug);
}

/** Link auf den Reiter "Berufe" des Charakters, mit dem Beruf als Sprungziel. */
function CharacterLink({ character, profession }: { character: CharacterRef; profession: string }) {
  return (
    <Link to={`/charakter/${character.slug}?reiter=berufe#${profession}`} className="bench-person-link">
      <ClassName classId={character.classId} name={fullName(character)} />
    </Link>
  );
}

/** Echtes Berufssymbol oder ein schlichtes Emblem mit dem Anfangsbuchstaben. */
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

function countText(n: number, guilds: GuildRef[], guildSlug: string | null, sprache: Sprache): string {
  const who = fassungIn(T.charaktere, sprache)(n);
  if (guildSlug !== null) return fassungIn(T.inGilde, sprache)(who, guilds.find((g) => g.slug === guildSlug)?.name ?? guildSlug);
  return guilds.length > 1 ? fassungIn(T.inBeiden, sprache)(who) : fassungIn(T.inDerGilde, sprache)(who);
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
  const { t } = useSprache();
  return (
    <>
      <nav className="bench-nav" aria-label={t(T.berufeNav)}>
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
          aria-label={t(T.berufWaehlen)}
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

type DetailMode = "personen" | "rezepte";

function ProfessionDetail({
  view,
  profession,
  guildSlug,
}: {
  view: ProfessionsView;
  profession: Profession;
  guildSlug: string | null;
}) {
  const { t, sprache } = useSprache();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<DetailMode>("personen");
  const recipesApi = useApi<ProfessionRecipesView>(`/api/professions/${encodeURIComponent(profession.slug)}`);
  const members = useMemo(() => profession.members.filter((m) => inGuild(m, guildSlug)), [profession, guildSlug]);
  const guildName = (slug: string) => view.guilds.find((g) => g.slug === slug)?.name ?? "";
  const faction = (slug: string) => view.guilds.find((g) => g.slug === slug)?.faction ?? "";
  const searching = query.trim().length >= MIN_QUERY;
  // Rezepte mit den Personen der gewählten Gilde; Personen in der Reihenfolge des Berufs (Fertigkeit, dann Name).
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
  const label = t(T.rezeptSuchen)(profession.name);

  const recipeList = (list: typeof recipes, listLabel: string) => {
    if (recipesApi.loading) return <p className="muted">{t(T.rezepteLaden)}</p>;
    if (recipesApi.error) return <p className="muted">{t(T.rezepteFehler)}</p>;
    if (list.length === 0) return <p className="muted">{searching ? t(T.keinTreffer) : t(T.keineRezepte)}</p>;
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
          <p className="muted small">{countText(members.length, view.guilds, guildSlug, sprache)}</p>
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
        recipeList(hits, t(T.treffer))
      ) : (
        <>
          <div className="bench-modes">
            <button
              type="button"
              className="bench-mode"
              aria-pressed={mode === "personen"}
              onClick={() => setMode("personen")}
            >
              {t(T.personen)} ({members.length})
            </button>
            <button
              type="button"
              className="bench-mode"
              aria-pressed={mode === "rezepte"}
              onClick={() => setMode("rezepte")}
            >
              {recipesApi.data ? `${t(T.alleRezepte)} (${recipes.length})` : t(T.alleRezepte)}
            </button>
          </div>
          {mode === "rezepte" ? (
            recipeList(recipes, t(T.rezepte))
          ) : members.length === 0 ? (
            <p className="muted bench-empty">
              {guildSlug === null
                ? t(T.niemand)(profession.name)
                : t(T.niemandAus)(guildName(guildSlug), profession.name)}
            </p>
          ) : (
            <ul className="bench-people" aria-label={t(T.personen)}>
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
  const { t } = useSprache();
  const [guildSlug, setGuildSlug] = useState<string | null>(null);
  if (view.professions.length === 0) {
    return (
      <div className="state state-empty">
        <p>{t(T.keineBerufe)}</p>
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
  const { beruf } = useParams();
  const { t } = useSprache();
  const { data, error, loading } = useApi<ProfessionsView>("/api/professions");
  return (
    <section className="page">
      <header className="page-header">
        <h1 className="page-title">{t(T.titel)}</h1>
        <p className="page-subtitle muted">{t(T.untertitel)}</p>
      </header>
      <DataState loading={loading} error={error}>
        {data && <Workbench view={data} slug={beruf} />}
      </DataState>
    </section>
  );
}
