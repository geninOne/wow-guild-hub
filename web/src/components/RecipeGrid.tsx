import { useState } from "react";
import type { RecipeView } from "../../../src/api/types";
import type { CharacterProfession } from "../../../src/model";
import { filterRecipes, recipeEntries } from "../lib/recipes";
import { useSprache, type Fassungen } from "../lib/sprache";
import { RecipeIcon, RecipeTooltip } from "./RecipeTooltip";
import { Tooltip } from "./Tooltip";

const T = {
  filtern: {
    de: (beruf: string) => `Rezepte in ${beruf} filtern`,
    en: (beruf: string) => `Filter ${beruf} recipes`,
    schwaebisch: (beruf: string) => `Rezept in ${beruf} filtera`,
    bayrisch: (beruf: string) => `Rezepte in ${beruf} filtern`,
  },
  keinTreffer: { de: "Kein Rezept gefunden.", en: "No recipe found.", schwaebisch: "Koi Rezept gfonda.", bayrisch: "Koa Rezept gfundn." },
  rezepte: {
    de: (beruf: string) => `Rezepte ${beruf}`,
    en: (beruf: string) => `${beruf} recipes`,
    schwaebisch: (beruf: string) => `Rezepte ${beruf}`,
    bayrisch: (beruf: string) => `Rezepte ${beruf}`,
  },
} satisfies Record<string, Fassungen | Fassungen<(beruf: string) => string>>;

/** Ab so vielen Rezepten erscheint ein Filterfeld. */
const FILTER_FROM = 24;

/** Raster der Rezept-Icons eines Berufs am Charakter, Tooltip beim Darüberfahren, Fokus oder Antippen. */
export function RecipeGrid({ profession, recipes }: { profession: CharacterProfession; recipes: Record<string, RecipeView> }) {
  const [query, setQuery] = useState("");
  const { t } = useSprache();
  const entries = recipeEntries(profession, recipes);
  if (entries.length === 0) return null;
  const shown = filterRecipes(entries, query);
  const label = t(T.filtern)(profession.name);
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
        <p className="muted small">{t(T.keinTreffer)}</p>
      ) : (
        <ul className="recipe-grid" aria-label={t(T.rezepte)(profession.name)}>
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
