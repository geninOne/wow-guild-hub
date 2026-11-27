import type { CharacterRecord, EquippedItem } from "../../../src/model";
import { qualityColor, SLOT_LAYOUT, SLOT_NAMES_DE } from "../lib/wow";
import { useSprache, type Fassungen } from "../lib/sprache";
import { Icon } from "./Icon";
import { ItemTooltip } from "./ItemTooltip";
import { Portrait } from "./Portrait";
import { Tooltip } from "./Tooltip";

interface EquipmentPanelProps {
  character: CharacterRecord;
  /** Key: itemId */
  itemIcons: Record<string, string | null>;
}

const ICON_SIZE = 44;

/** Slot names as in the English game client; German and the dialects use SLOT_NAMES_DE. */
const SLOT_NAMES_EN: Record<string, string> = {
  HEAD: "Head",
  NECK: "Neck",
  SHOULDER: "Shoulder",
  BACK: "Back",
  CHEST: "Chest",
  SHIRT: "Shirt",
  TABARD: "Tabard",
  WRIST: "Wrist",
  HANDS: "Hands",
  WAIST: "Waist",
  LEGS: "Legs",
  FEET: "Feet",
  FINGER_1: "Finger 1",
  FINGER_2: "Finger 2",
  TRINKET_1: "Trinket 1",
  TRINKET_2: "Trinket 2",
  MAIN_HAND: "Main Hand",
  OFF_HAND: "Off Hand",
  RANGED: "Ranged",
  AMMO: "Ammo",
};

const SLOT_NAMES: Fassungen<Record<string, string>> = { de: SLOT_NAMES_DE, en: SLOT_NAMES_EN };

const T = {
  left: { de: "Ausrüstung links", en: "Equipment, left" },
  right: { de: "Ausrüstung rechts", en: "Equipment, right" },
  weapons: { de: "Waffen", en: "Weapons" },
} satisfies Record<string, Fassungen>;

function Slot({ slot, item, icon }: { slot: string; item: EquippedItem | undefined; icon: string | null }) {
  const { t } = useSprache();
  const slotName = t(SLOT_NAMES)[slot] ?? slot;
  if (!item) {
    return (
      <li className="slot slot-empty">
        <Icon src={null} alt="" size={ICON_SIZE} />
        <span className="slot-text">
          <span className="slot-name muted">{slotName}</span>
        </span>
      </li>
    );
  }
  const color = qualityColor(item.quality);
  return (
    <li className="slot">
      <Tooltip content={<ItemTooltip item={item} />} className="slot-trigger">
        <Icon src={icon} alt="" size={ICON_SIZE} tone={color} />
        <span className="slot-text">
          <span className="slot-name" style={{ color }}>
            {item.name}
          </span>
          <span className="slot-meta">
            {item.itemLevel !== null && <span className="slot-level">{item.itemLevel}</span>}
            {item.enchantments.map((text, i) => (
              <span key={i} className="slot-enchant">
                {text}
              </span>
            ))}
          </span>
        </span>
      </Tooltip>
    </li>
  );
}

/** Equipment: slots left and right of the character portrait, weapons below. */

export function EquipmentPanel({ character, itemIcons }: EquipmentPanelProps) {
  const { t } = useSprache();
  const bySlot = new Map(character.equipment.map((item) => [item.slot, item]));
  const column = (slots: string[]) =>
    slots
      .filter((slot) => slot !== "AMMO" || bySlot.has(slot))
      .map((slot) => {
        const item = bySlot.get(slot);
        return <Slot key={slot} slot={slot} item={item} icon={item ? (itemIcons[String(item.itemId)] ?? null) : null} />;
      });

  return (
    <div className="equipment">
      <ul className="equipment-column equipment-left" aria-label={t(T.left)}>
        {column(SLOT_LAYOUT.left)}
      </ul>
      <div className="equipment-portrait">
        <Portrait character={character} />
      </div>
      <ul className="equipment-column equipment-right" aria-label={t(T.right)}>
        {column(SLOT_LAYOUT.right)}
      </ul>
      <ul className="equipment-weapons" aria-label={t(T.weapons)}>
        {column(SLOT_LAYOUT.bottom)}
      </ul>
    </div>
  );
}
