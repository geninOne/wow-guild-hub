import type { ItemTooltip as ItemTooltipData } from "../../../src/model";
import { fassungIn, useSprache, type Fassungen, type Sprache } from "../lib/sprache";
import { qualityColor } from "../lib/wow";

type Coin = "gold" | "silver" | "copper";

const COIN_NAMES: Fassungen<Record<Coin, string>> = {
  de: { gold: "Gold", silver: "Silber", copper: "Kupfer" },
  en: { gold: "Gold", silver: "Silver", copper: "Copper" },
};

const T = {
  sellPrice: { de: "Verkaufspreis", en: "Sell Price" },
  itemLevel: { de: "Gegenstandsstufe", en: "Item Level" },
} satisfies Record<string, Fassungen>;

/** Coin values from the first nonzero place on. Empty without a value. */
function sellPriceParts(price: ItemTooltipData["sellPrice"]): { value: number; coin: Coin }[] {
  if (!price) return [];
  const parts: { value: number; coin: Coin }[] = [
    { value: price.gold, coin: "gold" },
    { value: price.silver, coin: "silver" },
    { value: price.copper, coin: "copper" },
  ];
  const first = parts.findIndex((p) => p.value > 0);
  return first === -1 ? [] : parts.slice(first);
}

/** "{g} Gold {s} Silber {k} Kupfer", leading zero places are dropped. `null` without a value. */
export function formatSellPrice(price: ItemTooltipData["sellPrice"], language: Sprache = "de"): string | null {
  const parts = sellPriceParts(price);
  if (parts.length === 0) return null;
  const names = fassungIn(COIN_NAMES, language);
  return parts.map((p) => `${p.value} ${names[p.coin]}`).join(" ");
}

/** Sell price with coins instead of words; screen readers read the text from the label. */
function SellPrice({ price }: { price: ItemTooltipData["sellPrice"] }) {
  const { t, sprache } = useSprache();
  const text = formatSellPrice(price, sprache);
  if (!text) return null;
  return (
    <p aria-label={`${t(T.sellPrice)}: ${text}`}>
      {t(T.sellPrice)}:{" "}
      {sellPriceParts(price).map((p, i) => (
        <span key={p.coin}>
          {i > 0 && " "}
          {p.value}
          <span className={`coin coin-${p.coin}`} aria-hidden="true" />
        </span>
      ))}
    </p>
  );
}

function Pair({ left, right }: { left: string | null; right: string | null }) {
  if (!left && !right) return null;
  return (
    <p className="item-tip-pair">
      <span>{left}</span>
      <span>{right}</span>
    </p>
  );
}

function Line({ text, className }: { text: string | null; className?: string }) {
  if (!text) return null;
  return <p className={className}>{text}</p>;
}

/** What an item tooltip needs: worn equipment or the crafted item of a recipe. */
export interface TooltipItem {
  name: string;
  quality: string | null;
  itemLevel: number | null;
  tooltip?: ItemTooltipData | null;
  enchantments?: string[];
  slotName?: string;
}

/** Content of an item tooltip. Old data without `tooltip` only shows the essentials. */

export function ItemTooltip({ item }: { item: TooltipItem }) {
  const { t } = useSprache();
  const tip = item.tooltip;
  const enchantments = (item.enchantments ?? []).map((text, i) => (
    <p key={`e${i}`} className="item-tip-green">
      {text}
    </p>
  ));

  return (
    <div className="item-tip">
      <p className="item-tip-name" style={{ color: qualityColor(item.quality ?? "") }}>
        {item.name}
      </p>
      {item.itemLevel !== null && <p className="item-tip-level">
          {t(T.itemLevel)} {item.itemLevel}
        </p>}
      {tip ? (
        <>
          <Line text={tip.binding} />
          <Line text={tip.unique} />
          <Pair left={tip.slotType} right={tip.subclass} />
          <Line text={tip.containerSlots ?? null} />
          <Line text={tip.armor} />
          <Line text={tip.block} />
          <Pair left={tip.damage} right={tip.speed} />
          <Line text={tip.dps} />
          {tip.stats.map((stat, i) => (
            <p key={`s${i}`}>{stat}</p>
          ))}
          {enchantments}
          {tip.spells.map((spell, i) => (
            <p key={`z${i}`} className="item-tip-green">
              {spell}
            </p>
          ))}
          <Line text={tip.description} className="item-tip-description" />
          <Line text={tip.durability} />
          <Line text={tip.requiredLevel} />
          <SellPrice price={tip.sellPrice} />
        </>
      ) : (
        <>
          {item.slotName && <p className="muted">{item.slotName}</p>}
          {enchantments}
        </>
      )}
    </div>
  );
}
