import { useState } from "react";
import type { RecipeView } from "../../../src/api/types";
import type { CharacterProfession } from "../../../src/model";
import { filterRecipes, recipeEntries } from "../lib/recipes";
import { useLanguage, type Translations } from "../lib/language";
import { RecipeIcon, RecipeTooltip } from "./RecipeTooltip";
import { Tooltip } from "./Tooltip";

const T = {
  filter: {
    de: (profession: string) => `Rezepte in ${profession} filtern`,
    en: (profession: string) => `Filter ${profession} recipes`,
    schwaebisch: (profession: string) => `Rezept in ${profession} filtera`,
    bayrisch: (profession: string) => `Rezepte in ${profession} filtern`,
  },
  noMatch: { de: "Kein Rezept gefunden.", en: "No recipe found.", schwaebisch: "Koi Rezept gfonda.", bayrisch: "Koa Rezept gfundn." },
  recipes: {
    de: (profession: string) => `Rezepte ${profession}`,
    en: (profession: string) => `${profession} recipes`,
    schwaebisch: (profession: string) => `Rezepte ${profession}`,
    bayrisch: (profession: string) => `Rezepte ${profession}`,
  },
} satisfies Record<string, Translations | Translations<(profession: string) => string>>;

/** From this many recipes on, a filter field appears. */
const FILTER_FROM = 24;

/** Grid of a character's recipe icons for one profession, tooltip on hover, focus or tap. */

export function RecipeGrid({ profession, recipes }: { profession: CharacterProfession; recipes: Record<string, RecipeView> }) {
  const [query, setQuery] = useState("");
  const { t } = useLanguage();
  const entries = recipeEntries(profession, recipes);
  if (entries.length === 0) return null;
  const shown = filterRecipes(entries, query);
  const label = t(T.filter)(profession.name);
  return (
    <div className="recipe-grid-wrap">
      {entries.length >= FILTER_FROM && (
        <input
          className="filter-input recipe-grid-filter"
          type="search"
          placeholder={label}
          aria-label={label}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      {shown.length === 0 ? (
        <p className="muted small">{t(T.noMatch)}</p>
      ) : (
        <ul className="recipe-grid" aria-label={t(T.recipes)(profession.name)}>
          {shown.map((e) => (
            <li key={e.key}>
              <Tooltip content={<RecipeTooltip name={e.name} recipe={e.recipe} />} className="recipe-grid-trigger">
                <RecipeIcon name={e.name} recipe={e.recipe} size={40} />
              </Tooltip>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
