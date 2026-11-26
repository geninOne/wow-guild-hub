import type { RecipeView } from "../../../src/api/types";
import { useSprache, type Fassungen } from "../lib/sprache";
import { qualityColor } from "../lib/wow";
import { Icon } from "./Icon";
import { ItemTooltip } from "./ItemTooltip";

export const REZEPT_TEXTE = {
  stellt: {
    de: (n: number) => `Stellt ${n} Stück her`,
    en: (n: number) => `Creates ${n}`,
    schwaebisch: (n: number) => `Macht ${n} Stück`,
    bayrisch: (n: number) => `Macht ${n} Stück`,
  },
  materialien: { de: "Materialien", en: "Reagents", schwaebisch: "Materialien", bayrisch: "Materialien" },
  detailsFolgen: {
    de: "Details folgen nach dem nächsten Datenabruf.",
    en: "Details will follow after the next data update.",
    schwaebisch: "Details kommet nach em nächschte Datenabruf.",
    bayrisch: "Details kemman nach'm nächstn Datnabruf.",
  },
} satisfies Record<string, Fassungen | Fassungen<(n: number) => string>>;
const T = REZEPT_TEXTE;

/** Rahmenfarbe eines Rezepts: Qualität des Ergebnisses, ohne Ergebnis der Standardrahmen. */
export function recipeTone(recipe: RecipeView | null): string | undefined {
  return recipe?.item?.quality ? qualityColor(recipe.item.quality) : undefined;
}

/** Rezept-Icon im Qualitätsrahmen; ohne Details ein leeres Feld. */
export function RecipeIcon({ name, recipe, size }: { name: string; recipe: RecipeView | null; size: number }) {
  return <Icon src={recipe?.icon} alt={name} size={size} tone={recipeTone(recipe)} />;
}

/** Tooltip eines Rezepts: hergestellter Gegenstand wie bei der Ausrüstung, Wirkung und Materialien. */
export function RecipeTooltip({ name, recipe }: { name: string; recipe: RecipeView | null }) {
  const { t } = useSprache();
  const item = recipe?.item ?? null;
  const showName = !item || item.name !== name;
  return (
    <div className="item-tip recipe-tip">
      {showName && <p className="item-tip-name recipe-tip-name">{name}</p>}
      {item && <ItemTooltip item={item} />}
      {recipe && recipe.craftedQuantity > 1 && <p className="recipe-tip-quantity">{t(T.stellt)(recipe.craftedQuantity)}</p>}
      {recipe && !item && recipe.description && <p className="item-tip-green">{recipe.description}</p>}
      {recipe && recipe.reagents.length > 0 && (
        <div className="recipe-tip-reagents">
          <p className="recipe-tip-label">{t(T.materialien)}</p>
          <ul>
            {recipe.reagents.map((r) => (
              <li key={r.id}>
                <Icon src={r.icon} alt="" size={18} loading="eager" />
                <span>
                  {r.quantity}× {r.name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!recipe && <p className="muted">{t(T.detailsFolgen)}</p>}
    </div>
  );
}
