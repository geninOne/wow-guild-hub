import { useState } from "react";
import { Link } from "react-router";
import type { CharacterRef, ProfessionRecipe, RecipeView } from "../../../src/api/types";
import { ClassName } from "./ClassName";
import { FactionCrest } from "./FactionCrest";
import { Icon } from "./Icon";
import { fassungIn, useSprache, type Fassungen, type Sprache } from "../lib/sprache";
import { RecipeIcon, recipeTone, RecipeTooltip, RECIPE_TEXTS } from "./RecipeTooltip";
import { Tooltip } from "./Tooltip";

export type RecipePerson = CharacterRef & { skill: number; max: number };

/** This many people are visible before the list collapses. */
const VISIBLE_PEOPLE = 6;

function fullName(c: CharacterRef): string {
  return c.surname ? `${c.name} ${c.surname}` : c.name;
}

const T = {
  knownBy: {
    de: (n: number) => (n === 1 ? "kennt 1 Charakter" : `kennen ${n} Charaktere`),
    en: (n: number) => (n === 1 ? "known by 1 character" : `known by ${n} characters`),
    schwaebisch: (n: number) => (n === 1 ? "kennt 1 Charakter" : `kennet ${n} Charaktere`),
    bayrisch: (n: number) => (n === 1 ? "kennt 1 Charakter" : `kennan ${n} Charaktere`),
  },
  creates: { de: "Stellt her", en: "Creates", schwaebisch: "Macht", bayrisch: "Macht" },
  reagents: RECIPE_TEXTS.reagents,
  whoKnows: {
    de: (name: string) => `Wer kennt ${name}`,
    en: (name: string) => `Who knows ${name}`,
    schwaebisch: (name: string) => `Wer kennt ${name}`,
    bayrisch: (name: string) => `Wer kennt ${name}`,
  },
  skill: { de: "Fertigkeit", en: "Skill", schwaebisch: "Fertigkeit", bayrisch: "Fertigkeit" },
  showLess: { de: "weniger anzeigen", en: "show less", schwaebisch: "weniger zoiga", bayrisch: "weniger ozoagn" },
  showAll: {
    de: (n: number) => `alle ${n} anzeigen`,
    en: (n: number) => `show all ${n}`,
    schwaebisch: (n: number) => `älle ${n} zoiga`,
    bayrisch: (n: number) => `olle ${n} ozoagn`,
  },
} satisfies Record<string, Fassungen | Fassungen<(...a: never[]) => string>>;

/** Subline: crafted item if it differs from the recipe name, otherwise type and slot. */
function subline(name: string, recipe: RecipeView | null, language: Sprache): string | null {
  if (!recipe) return fassungIn(RECIPE_TEXTS.detailsPending, language);
  const item = recipe.item;
  if (!item) return recipe.description;
  if (item.name !== name || recipe.craftedQuantity > 1) {
    return `${fassungIn(T.creates, language)}: ${item.name}${recipe.craftedQuantity > 1 ? ` × ${recipe.craftedQuantity}` : ""}`;
  }
  const kind = [item.tooltip?.subclass, item.tooltip?.slotType].filter(Boolean).join(" · ");
  return kind || null;
}

/** Recipe as a card: icon and name with tooltip, reagents and who knows it. */
export function RecipeCard({
  entry,
  people,
  profession,
  factionOf,
}: {
  entry: ProfessionRecipe;
  /** Already filtered and sorted. */
  people: RecipePerson[];
  /** URL slug of the profession as the jump target on the character. */

  profession: string;
  factionOf: (guildSlug: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const { t, sprache } = useSprache();
  const { name, recipe } = entry;
  const collapsible = people.length > VISIBLE_PEOPLE + 1;
  const shown = collapsible && !expanded ? people.slice(0, VISIBLE_PEOPLE) : people;
  const sub = subline(name, recipe, sprache);

  return (
    <li className="recipe-card">
      <div className="recipe-card-head">
        <Tooltip content={<RecipeTooltip name={name} recipe={recipe} />} className="recipe-card-trigger">
          <RecipeIcon name={name} recipe={recipe} size={40} />
          <span className="recipe-card-text">
            <span className="recipe-card-name" style={{ color: recipeTone(recipe) }}>
              {name}
            </span>
            {sub && <span className="recipe-card-sub">{sub}</span>}
          </span>
        </Tooltip>
        <span className="recipe-card-count">{t(T.knownBy)(people.length)}</span>
      </div>

      {recipe && recipe.reagents.length > 0 && (
        <ul className="recipe-card-reagents" aria-label={t(T.reagents)}>
          {recipe.reagents.map((r) => (
            <li key={r.id}>
              <Icon src={r.icon} alt="" size={18} />
              {r.quantity}× {r.name}
            </li>
          ))}
        </ul>
      )}

      <ul className="recipe-card-people" aria-label={t(T.whoKnows)(name)}>
        {shown.map((p) => (
          <li key={p.id}>
            <Link to={`/charakter/${p.slug}?reiter=berufe#${profession}`} className="recipe-chip">
              <FactionCrest faction={factionOf(p.guildSlug)} size={14} />
              <ClassName classId={p.classId} name={fullName(p)} />
              <span className="recipe-chip-skill" title={t(T.skill)}>
                {p.skill}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {collapsible && (
        <button type="button" className="recipe-card-more" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? t(T.showLess) : t(T.showAll)(people.length)}
        </button>
      )}
    </li>
  );
}
