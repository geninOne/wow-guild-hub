import { useState } from "react";
import { Link } from "react-router";
import type { CharacterRef, ProfessionRecipe, RecipeView } from "../../../src/api/types";
import { ClassName } from "./ClassName";
import { FactionCrest } from "./FactionCrest";
import { Icon } from "./Icon";
import { fassungIn, useSprache, type Fassungen, type Sprache } from "../lib/sprache";
import { RecipeIcon, recipeTone, RecipeTooltip, REZEPT_TEXTE } from "./RecipeTooltip";
import { Tooltip } from "./Tooltip";

export type RecipePerson = CharacterRef & { skill: number; max: number };

/** So viele Personen sind sichtbar, bevor eingeklappt wird. */
const VISIBLE_PEOPLE = 6;

function fullName(c: CharacterRef): string {
  return c.surname ? `${c.name} ${c.surname}` : c.name;
}

const T = {
  kennen: {
    de: (n: number) => (n === 1 ? "kennt 1 Charakter" : `kennen ${n} Charaktere`),
    en: (n: number) => (n === 1 ? "known by 1 character" : `known by ${n} characters`),
    schwaebisch: (n: number) => (n === 1 ? "kennt 1 Charakter" : `kennet ${n} Charaktere`),
    bayrisch: (n: number) => (n === 1 ? "kennt 1 Charakter" : `kennan ${n} Charaktere`),
  },
  stelltHer: { de: "Stellt her", en: "Creates", schwaebisch: "Macht", bayrisch: "Macht" },
  materialien: REZEPT_TEXTE.materialien,
  werKennt: {
    de: (name: string) => `Wer kennt ${name}`,
    en: (name: string) => `Who knows ${name}`,
    schwaebisch: (name: string) => `Wer kennt ${name}`,
    bayrisch: (name: string) => `Wer kennt ${name}`,
  },
  fertigkeit: { de: "Fertigkeit", en: "Skill", schwaebisch: "Fertigkeit", bayrisch: "Fertigkeit" },
  weniger: { de: "weniger anzeigen", en: "show less", schwaebisch: "weniger zoiga", bayrisch: "weniger ozoagn" },
  alle: {
    de: (n: number) => `alle ${n} anzeigen`,
    en: (n: number) => `show all ${n}`,
    schwaebisch: (n: number) => `älle ${n} zoiga`,
    bayrisch: (n: number) => `olle ${n} ozoagn`,
  },
} satisfies Record<string, Fassungen | Fassungen<(...a: never[]) => string>>;

/** Unterzeile: hergestellter Gegenstand, wenn er vom Rezeptnamen abweicht, sonst Art und Platz. */
function subline(name: string, recipe: RecipeView | null, sprache: Sprache): string | null {
  if (!recipe) return fassungIn(REZEPT_TEXTE.detailsFolgen, sprache);
  const item = recipe.item;
  if (!item) return recipe.description;
  if (item.name !== name || recipe.craftedQuantity > 1) {
    return `${fassungIn(T.stelltHer, sprache)}: ${item.name}${recipe.craftedQuantity > 1 ? ` × ${recipe.craftedQuantity}` : ""}`;
  }
  const kind = [item.tooltip?.subclass, item.tooltip?.slotType].filter(Boolean).join(" · ");
  return kind || null;
}

/** Rezept als Karte: Icon und Name mit Tooltip, Materialien und wer es kennt. */
export function RecipeCard({
  entry,
  people,
  profession,
  factionOf,
}: {
  entry: ProfessionRecipe;
  /** Bereits gefiltert und sortiert. */
  people: RecipePerson[];
  /** URL-Kürzel des Berufs als Sprungziel am Charakter. */
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
        <span className="recipe-card-count">{t(T.kennen)(people.length)}</span>
      </div>

      {recipe && recipe.reagents.length > 0 && (
        <ul className="recipe-card-reagents" aria-label={t(T.materialien)}>
          {recipe.reagents.map((r) => (
            <li key={r.id}>
              <Icon src={r.icon} alt="" size={18} />
              {r.quantity}× {r.name}
            </li>
          ))}
        </ul>
      )}

      <ul className="recipe-card-people" aria-label={t(T.werKennt)(name)}>
        {shown.map((p) => (
          <li key={p.id}>
            <Link to={`/charakter/${p.slug}?reiter=berufe#${profession}`} className="recipe-chip">
              <FactionCrest faction={factionOf(p.guildSlug)} size={14} />
              <ClassName classId={p.classId} name={fullName(p)} />
              <span className="recipe-chip-skill" title={t(T.fertigkeit)}>
                {p.skill}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {collapsible && (
        <button type="button" className="recipe-card-more" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? t(T.weniger) : t(T.alle)(people.length)}
        </button>
      )}
    </li>
  );
}
