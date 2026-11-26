import type { CSSProperties, ReactNode } from "react";
import type { AttributeGroupId, AttributeRow, AttributesView, ResourceKind } from "../../../src/api/types";
import { formatDateTime, zahlLocale } from "../lib/format";
import { useSprache, type Fassungen } from "../lib/sprache";

const T = {
  sammeln: {
    de: "Die Werte werden gerade zusammengetragen. Schau bald wieder vorbei.",
    en: "Stats are being gathered right now. Check back soon.",
    schwaebisch: "D'Werte werdet grad zammatraga. Schau bald wieder vorbei, gell.",
    bayrisch: "De Werte wern grad zammtragn. Schau boid wieder vorbei, gell.",
  },
  keine: {
    de: "Blizzard liefert für diesen Charakter keine Werte.",
    en: "Blizzard provides no stats for this character.",
    schwaebisch: "Blizzard liefert für den Charakter koine Werte.",
    bayrisch: "Blizzard liefert fia den Charakter koane Werte.",
  },
  stand: { de: "Stand", en: "As of", schwaebisch: "Stand", bayrisch: "Stand" },
  grundwert: {
    de: (base: string, plus: string) => `Grundwert ${base}, ${plus} durch Ausrüstung und Effekte`,
    en: (base: string, plus: string) => `Base ${base}, ${plus} from gear and effects`,
    schwaebisch: (base: string, plus: string) => `Grondwert ${base}, ${plus} durch Ausrüschtung ond Effekte`,
    bayrisch: (base: string, plus: string) => `Grundwert ${base}, ${plus} durch Ausrüstung und Effekte`,
  },
} satisfies Record<string, Fassungen<unknown>>;

const GROUPS: Record<AttributeGroupId, Fassungen> = {
  basis: { de: "Grundwerte", en: "Base Stats", schwaebisch: "Grondwerte", bayrisch: "Grundwerte" },
  angriff: { de: "Angriff", en: "Attack", schwaebisch: "Agriff", bayrisch: "Ogriff" },
  zauber: { de: "Zauber", en: "Spells", schwaebisch: "Zauber", bayrisch: "Zauba" },
  verteidigung: { de: "Verteidigung", en: "Defense", schwaebisch: "Verteidigung", bayrisch: "Vateidigung" },
};

const RESOURCES: Record<Exclude<ResourceKind, "other">, Fassungen> = {
  mana: { de: "Mana", en: "Mana" },
  rage: { de: "Wut", en: "Rage", schwaebisch: "Wut", bayrisch: "Wuad" },
  focus: { de: "Fokus", en: "Focus" },
  energy: { de: "Energie", en: "Energy" },
  runic_power: { de: "Runenmacht", en: "Runic Power" },
};

const LABELS: Record<string, Fassungen> = {
  health: { de: "Gesundheit", en: "Health", schwaebisch: "Gsondheit", bayrisch: "Gsundheit" },
  strength: { de: "Stärke", en: "Strength", schwaebisch: "Schtärke", bayrisch: "Stärk" },
  agility: { de: "Beweglichkeit", en: "Agility" },
  intellect: { de: "Intelligenz", en: "Intellect" },
  stamina: { de: "Ausdauer", en: "Stamina", bayrisch: "Ausdaua" },
  spirit: { de: "Willenskraft", en: "Spirit", bayrisch: "Willnskraft" },
  attack_power: { de: "Angriffskraft", en: "Attack Power", schwaebisch: "Agriffskraft", bayrisch: "Ogriffskraft" },
  melee_crit: { de: "Krit Nahkampf", en: "Melee Crit" },
  ranged_crit: { de: "Krit Fernkampf", en: "Ranged Crit" },
  melee_haste: { de: "Tempo Nahkampf", en: "Melee Haste" },
  ranged_haste: { de: "Tempo Fernkampf", en: "Ranged Haste" },
  melee_hit: { de: "Trefferchance Nahkampf", en: "Melee Hit" },
  ranged_hit: { de: "Trefferchance Fernkampf", en: "Ranged Hit" },
  ranged_attack_power: { de: "Distanzangriffskraft", en: "Ranged Attack Power", bayrisch: "Distanzogriffskraft" },
  main_hand_dps: { de: "Schaden pro Sekunde", en: "Damage per Second", schwaebisch: "Schada pro Sekund", bayrisch: "Schadn pro Sekundn" },
  armor_penetration: { de: "Rüstungsdurchschlag", en: "Armor Penetration" },
  expertise: { de: "Waffenkunde", en: "Expertise" },
  mastery: { de: "Meisterschaft", en: "Mastery", bayrisch: "Moastaschaft" },
  versatility: { de: "Vielseitigkeit", en: "Versatility" },
  spell_power: { de: "Zaubermacht", en: "Spell Power" },
  spell_healing: { de: "Heilbonus", en: "Bonus Healing" },
  spell_crit: { de: "Zauberkrit", en: "Spell Crit" },
  spell_haste: { de: "Zaubertempo", en: "Spell Haste" },
  spell_hit: { de: "Zaubertrefferchance", en: "Spell Hit" },
  mana_regen: { de: "Manaregeneration", en: "Mana Regen", schwaebisch: "Manaregenerazion" },
  mana_regen_combat: { de: "Manaregeneration im Kampf", en: "Mana Regen in Combat", schwaebisch: "Manaregenerazion em Kampf" },
  spell_penetration: { de: "Zauberdurchschlag", en: "Spell Penetration" },
  armor: { de: "Rüstung", en: "Armor", schwaebisch: "Rüschtung" },
  defense: { de: "Verteidigung", en: "Defense", bayrisch: "Vateidigung" },
  dodge: { de: "Ausweichen", en: "Dodge", schwaebisch: "Ausweicha", bayrisch: "Ausweicha" },
  parry: { de: "Parieren", en: "Parry", schwaebisch: "Pariera", bayrisch: "Pariern" },
  block: { de: "Blocken", en: "Block", schwaebisch: "Blocka", bayrisch: "Blockn" },
  fire_resistance: { de: "Feuerwiderstand", en: "Fire Resistance" },
  frost_resistance: { de: "Frostwiderstand", en: "Frost Resistance" },
  nature_resistance: { de: "Naturwiderstand", en: "Nature Resistance" },
  shadow_resistance: { de: "Schattenwiderstand", en: "Shadow Resistance" },
  arcane_resistance: { de: "Arkanwiderstand", en: "Arcane Resistance" },
  holy_resistance: { de: "Heiligwiderstand", en: "Holy Resistance" },
};

/* Eigene Symbole im Stil der Seite: schlicht, gefüllt, in currentColor; die Farbe setzt die Kachel. */
type GlyphName =
  | "heart" | "drop" | "flame" | "bolt" | "rune" | "eye" | "fist" | "feather" | "book" | "mountain" | "spiral"
  | "sword" | "crosshair" | "hourglass" | "target" | "star" | "gem" | "sparkle" | "spear" | "shield" | "helm"
  | "wind" | "swords" | "ward";

const GLYPHS: Record<GlyphName, ReactNode> = {
  heart: <path d="M12 20.5 4.2 13A5 5 0 0 1 12 6.6 5 5 0 0 1 19.8 13z" fill="currentColor" />,
  drop: <path d="M12 2.8c3.6 4.8 6.2 8.4 6.2 11.6a6.2 6.2 0 0 1-12.4 0c0-3.2 2.6-6.8 6.2-11.6z" fill="currentColor" />,
  flame: (
    <path
      d="M12 2.5c.8 3.4 4 5.2 5.4 8.6 1.9 4.6-1.2 9.4-5.4 9.4s-7.3-3.6-6.1-7.8c.6 1.6 1.8 2.6 3 2.8-1.3-3.8.6-8.4 3.1-13z"
      fill="currentColor"
    />
  ),
  bolt: <path d="M13.6 2.5 5 13.6h5.6L9.4 21.5 19 9.6h-5.8z" fill="currentColor" />,
  rune: (
    <>
      <path d="M12 2.5 20 12l-8 9.5L4 12z" fill="currentColor" opacity="0.85" />
      <path d="M12 6.5v11M9 9.5l6 5M15 9.5l-6 5" stroke="var(--steel-2, #1c1f27)" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12c2.6-4.4 6-6.6 10-6.6s7.4 2.2 10 6.6c-2.6 4.4-6 6.6-10 6.6S4.6 16.4 2 12z" fill="currentColor" />
      <circle cx="12" cy="12" r="3.2" fill="var(--steel-2, #1c1f27)" />
    </>
  ),
  fist: (
    <>
      <rect x="5" y="6" width="14" height="9" rx="3" fill="currentColor" />
      <path d="M7 14.5h10v3.5a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3z" fill="currentColor" opacity="0.75" />
      <path d="M8.6 6.5v4.4M12 6.5v4.4M15.4 6.5v4.4" stroke="var(--steel-2, #1c1f27)" strokeWidth="1.3" strokeLinecap="round" />
    </>
  ),
  feather: (
    <>
      <path d="M19.5 3C11 3.6 6 9.2 5.4 17.8L8 15.6c3.6.4 8.2-2.4 9.6-6.6l-3 .2 3.6-2.4c.6-1.2 1.1-2.4 1.3-3.8z" fill="currentColor" />
      <path d="M4 20.5 13 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  book: (
    <>
      <path d="M2.5 5.5c3.4-.8 6.6-.4 9 1.4v13c-2.4-1.6-5.6-2-9-1.2z" fill="currentColor" />
      <path d="M21.5 5.5c-3.4-.8-6.6-.4-9 1.4v13c2.4-1.6 5.6-2 9-1.2z" fill="currentColor" opacity="0.7" />
    </>
  ),
  mountain: (
    <>
      <path d="M1.5 20 9 6.5l4.2 7.4 2.3-3.4L22.5 20z" fill="currentColor" />
      <path d="M9 6.5 6.8 10.4l2.2-.9 1.6 1.4z" fill="var(--steel-2, #1c1f27)" opacity="0.55" />
    </>
  ),
  spiral: (
    <path
      d="M12 12.2c.6-.6.2-1.6-.6-1.6-1.4 0-2 1.6-1.4 2.8.9 1.8 3.6 1.8 4.6 0 1.4-2.6-.6-5.6-3.4-5.6-3.6 0-5.6 4-4 7.2 2 4 7.8 4 9.8 0 2.2-4.6-1-10-6-10"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  ),
  sword: (
    <>
      <path d="M19.5 2.5 21.5 4.5 10.4 15.6 8.4 13.6z" fill="currentColor" />
      <path d="M5.5 12.6 11.4 18.5M7.2 16.8 3 21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  crosshair: (
    <>
      <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 1.8v6M12 16.2v6M1.8 12h6M16.2 12h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
    </>
  ),
  hourglass: (
    <>
      <path d="M6 3h12M6 21h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 4h10c0 4-3 6-5 8 2 2 5 4 5 8H7c0-4 3-6 5-8-2-2-5-4-5-8z" fill="currentColor" opacity="0.8" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9.5" fill="currentColor" opacity="0.45" />
      <circle cx="12" cy="12" r="6" fill="currentColor" opacity="0.75" />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" />
    </>
  ),
  star: <path d="M12 2.5 14.9 8.8 21.6 9.4 16.5 13.9 18 20.5 12 17 6 20.5 7.5 13.9 2.4 9.4 9.1 8.8z" fill="currentColor" />,
  gem: (
    <>
      <path d="M6.5 3.5h11l4 5.5-9.5 12-9.5-12z" fill="currentColor" />
      <path d="M2.5 9h19M9 3.5 12 9l3-5.5M12 9v11.5" stroke="var(--steel-2, #1c1f27)" strokeWidth="1.1" opacity="0.6" />
    </>
  ),
  sparkle: (
    <>
      <path d="M11 2.5c.8 4.6 2.6 6.6 7.5 7.5-4.9.9-6.7 2.9-7.5 7.5-.8-4.6-2.6-6.6-7.5-7.5 4.9-.9 6.7-2.9 7.5-7.5z" fill="currentColor" />
      <path d="M18.5 14.5c.4 2.2 1.2 3.1 3.3 3.5-2.1.4-2.9 1.3-3.3 3.5-.4-2.2-1.2-3.1-3.3-3.5 2.1-.4 2.9-1.3 3.3-3.5z" fill="currentColor" opacity="0.7" />
    </>
  ),
  spear: (
    <>
      <path d="M3 21 16 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M21.5 2.5 19.6 10.2 13.8 4.4z" fill="currentColor" />
    </>
  ),
  shield: <path d="M12 2.5l8 3v6c0 5-3.4 8.7-8 10-4.6-1.3-8-5-8-10v-6z" fill="currentColor" />,
  helm: (
    <>
      <path d="M4 13a8 8 0 0 1 16 0v7.5h-5.5V15h-5v5.5H4z" fill="currentColor" />
      <path d="M12 4.6v7" stroke="var(--steel-2, #1c1f27)" strokeWidth="1.4" opacity="0.6" />
    </>
  ),
  wind: (
    <path
      d="M3 8.5h11.5a2.8 2.8 0 1 0-2.8-2.8M3 12.5h16a2.8 2.8 0 1 1-2.8 2.8M3 16.5h8"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  ),
  swords: (
    <path
      d="M4 4l11.5 11.5M20 4 8.5 15.5M13.4 17.6l4-4M10.6 17.6l-4-4M17 17l3.5 3.5M7 17l-3.5 3.5"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
    />
  ),
  ward: (
    <>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4.6" fill="currentColor" />
    </>
  ),
};

/** Symbol und Farbe je Wert. Die Farben sind nur Grafik; Zahlen und Beschriftungen bleiben in den Textfarben. */
const LOOK: Record<string, { glyph: GlyphName; color: string }> = {
  health: { glyph: "heart", color: "#5fd068" },
  strength: { glyph: "fist", color: "#ec6a45" },
  agility: { glyph: "feather", color: "#b4dc55" },
  intellect: { glyph: "book", color: "#b08cf5" },
  stamina: { glyph: "mountain", color: "#f2a93b" },
  spirit: { glyph: "spiral", color: "#8fe3e0" },
  attack_power: { glyph: "sword", color: "#ec6a45" },
  melee_crit: { glyph: "crosshair", color: "#f2c95a" },
  ranged_crit: { glyph: "crosshair", color: "#f2c95a" },
  melee_haste: { glyph: "hourglass", color: "#f2c95a" },
  ranged_haste: { glyph: "hourglass", color: "#f2c95a" },
  melee_hit: { glyph: "target", color: "#f2c95a" },
  ranged_hit: { glyph: "target", color: "#f2c95a" },
  ranged_attack_power: { glyph: "spear", color: "#ec6a45" },
  main_hand_dps: { glyph: "bolt", color: "#f2c95a" },
  armor_penetration: { glyph: "spear", color: "#f2c95a" },
  expertise: { glyph: "sword", color: "#f2c95a" },
  mastery: { glyph: "star", color: "#f2c95a" },
  versatility: { glyph: "gem", color: "#f2c95a" },
  spell_power: { glyph: "sparkle", color: "#b08cf5" },
  spell_healing: { glyph: "sparkle", color: "#5fd068" },
  spell_crit: { glyph: "crosshair", color: "#b08cf5" },
  spell_haste: { glyph: "hourglass", color: "#b08cf5" },
  spell_hit: { glyph: "target", color: "#b08cf5" },
  mana_regen: { glyph: "drop", color: "#5b9bff" },
  mana_regen_combat: { glyph: "drop", color: "#5b9bff" },
  spell_penetration: { glyph: "spear", color: "#b08cf5" },
  armor: { glyph: "shield", color: "#c3c8d4" },
  defense: { glyph: "helm", color: "#c3c8d4" },
  dodge: { glyph: "wind", color: "#c3c8d4" },
  parry: { glyph: "swords", color: "#c3c8d4" },
  block: { glyph: "shield", color: "#c3c8d4" },
  fire_resistance: { glyph: "ward", color: "#f2643a" },
  frost_resistance: { glyph: "ward", color: "#7fd0ff" },
  nature_resistance: { glyph: "ward", color: "#7ccf52" },
  shadow_resistance: { glyph: "ward", color: "#a585e0" },
  arcane_resistance: { glyph: "ward", color: "#e98bf0" },
  holy_resistance: { glyph: "ward", color: "#ffe08a" },
};

const RESOURCE_LOOK: Record<ResourceKind, { glyph: GlyphName; color: string }> = {
  mana: { glyph: "drop", color: "#5b9bff" },
  rage: { glyph: "flame", color: "#ec4b50" },
  focus: { glyph: "eye", color: "#f09a3a" },
  energy: { glyph: "bolt", color: "#f4d83a" },
  runic_power: { glyph: "rune", color: "#4fd2e8" },
  other: { glyph: "drop", color: "#f2c95a" },
};

function AttributeGlyph({ glyph, color }: { glyph: GlyphName; color: string }) {
  return (
    <span className="attribute-glyph" style={{ color }}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {GLYPHS[glyph]}
      </svg>
    </span>
  );
}

function formatValue(row: AttributeRow): string {
  if (row.kind === "percent") {
    return `${row.value.toLocaleString(zahlLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
  }
  return row.value.toLocaleString(zahlLocale(), { maximumFractionDigits: 1 });
}

/** Beschriftung, Symbol und Farbe einer Zeile; die Ressource richtet sich nach ihrer Art. */
function useRowLook(row: AttributeRow, view: AttributesView): { label: string; glyph: GlyphName; color: string } {
  const { t } = useSprache();
  if (row.key === "power" && view.resource) {
    const { kind, name } = view.resource;
    return { label: kind === "other" ? name : t(RESOURCES[kind]), ...RESOURCE_LOOK[kind] };
  }
  const look = LOOK[row.key] ?? { glyph: "star", color: "#f2c95a" };
  return { label: LABELS[row.key] ? t(LABELS[row.key]) : row.key, ...look };
}

/** Hinweis zum Grundwert, wenn Ausrüstung und Effekte den Wert ändern. */
function useBaseTooltip(row: AttributeRow): string | undefined {
  const { t } = useSprache();
  if (row.base === undefined) return undefined;
  const diff = row.value - row.base;
  const plus = `${diff >= 0 ? "+" : "−"}${Math.abs(diff).toLocaleString(zahlLocale(), { maximumFractionDigits: 1 })}`;
  return t(T.grundwert)(row.base.toLocaleString(zahlLocale()), plus);
}

function AttributeTile({ row, view }: { row: AttributeRow; view: AttributesView }) {
  const { label, glyph, color } = useRowLook(row, view);
  const title = useBaseTooltip(row);
  return (
    <li className="attribute-tile" title={title} style={{ "--attribute-color": color } as CSSProperties}>
      <AttributeGlyph glyph={glyph} color={color} />
      <span className="attribute-label">{label}</span>
      <span className="attribute-value num">{formatValue(row)}</span>
      {row.base !== undefined && row.value > row.base && (
        <span className="attribute-bonus num small">+{(row.value - row.base).toLocaleString(zahlLocale(), { maximumFractionDigits: 1 })}</span>
      )}
    </li>
  );
}

function AttributeLine({ row, view }: { row: AttributeRow; view: AttributesView }) {
  const { label, glyph, color } = useRowLook(row, view);
  const title = useBaseTooltip(row);
  return (
    <li className="attribute-row" title={title}>
      <AttributeGlyph glyph={glyph} color={color} />
      <span className="attribute-label">{label}</span>
      <span className="attribute-value num">{formatValue(row)}</span>
    </li>
  );
}

/** Grundwerte eines Charakters wie im Arsenal: oben die Grundwerte als Kacheln, darunter Angriff, Zauber, Verteidigung. */
export function AttributesPanel({ view }: { view: AttributesView | undefined }) {
  const { t } = useSprache();
  if (!view?.available) {
    return (
      <div className="state state-empty">
        <p>{t(view?.fetchedAt ? T.keine : T.sammeln)}</p>
      </div>
    );
  }
  const basis = view.groups.find((g) => g.id === "basis");
  const rest = view.groups.filter((g) => g.id !== "basis");
  return (
    <div className="attributes">
      {basis && (
        <section className="panel" aria-labelledby="werte-basis">
          <h2 className="panel-title" id="werte-basis">
            {t(GROUPS.basis)}
          </h2>
          <ul className="attribute-tiles">
            {basis.rows.map((row) => (
              <AttributeTile key={row.key} row={row} view={view} />
            ))}
          </ul>
        </section>
      )}
      {rest.length > 0 && (
        <div className="attribute-groups">
          {rest.map((group) => (
            <section key={group.id} className="panel" aria-labelledby={`werte-${group.id}`}>
              <h2 className="panel-title" id={`werte-${group.id}`}>
                {t(GROUPS[group.id])}
              </h2>
              <ul className="attribute-list">
                {group.rows.map((row) => (
                  <AttributeLine key={row.key} row={row} view={view} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {view.fetchedAt && (
        <p className="muted small attributes-stand">
          {t(T.stand)}: {formatDateTime(view.fetchedAt)}
        </p>
      )}
    </div>
  );
}
