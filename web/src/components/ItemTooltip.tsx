import type { ItemTooltip as ItemTooltipData } from "../../../src/model";
import { fassungIn, useSprache, type Fassungen, type Sprache } from "../lib/sprache";
import { qualityColor } from "../lib/wow";

type Coin = "gold" | "silver" | "copper";

const COIN_NAMES: Fassungen<Record<Coin, string>> = {
  de: { gold: "Gold", silver: "Silber", copper: "Kupfer" },
  en: { gold: "Gold", silver: "Silver", copper: "Copper" },
};

const T = {
  verkaufspreis: { de: "Verkaufspreis", en: "Sell Price" },
  gegenstandsstufe: { de: "Gegenstandsstufe", en: "Item Level" },
} satisfies Record<string, Fassungen>;

/** Münzwerte ab der ersten Stelle ungleich 0. Ohne Wert leer. */
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

/** "{g} Gold {s} Silber {k} Kupfer", führende Nullstellen entfallen. Ohne Wert `null`. */
export function formatSellPrice(price: ItemTooltipData["sellPrice"], sprache: Sprache = "de"): string | null {
  const parts = sellPriceParts(price);
  if (parts.length === 0) return null;
  const namen = fassungIn(COIN_NAMES, sprache);
  return parts.map((p) => `${p.value} ${namen[p.coin]}`).join(" ");
}

/** Verkaufspreis mit Münzen statt Wörtern; Screenreader lesen den Text aus dem Label. */
function SellPrice({ price }: { price: ItemTooltipData["sellPrice"] }) {
  const { t, sprache } = useSprache();
  const text = formatSellPrice(price, sprache);
  if (!text) return null;
  return (
    <p aria-label={`${t(T.verkaufspreis)}: ${text}`}>
      {t(T.verkaufspreis)}:{" "}
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

/** Was ein Gegenstand-Tooltip braucht: getragene Ausrüstung oder hergestellter Gegenstand eines Rezepts. */
export interface TooltipItem {
  name: string;
  quality: string | null;
  itemLevel: number | null;
  tooltip?: ItemTooltipData | null;
  enchantments?: string[];
  slotName?: string;
}

/** Inhalt eines Gegenstand-Tooltips. Alte Daten ohne `tooltip` zeigen nur das Wesentliche. */
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
          {t(T.gegenstandsstufe)} {item.itemLevel}
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
