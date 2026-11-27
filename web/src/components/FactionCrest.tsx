import { useId } from "react";
import { useSprache } from "../lib/sprache";
import { factionName } from "../lib/wow";
import { Icon } from "./Icon";

const RENDER = "https://render.worldofwarcraft.com";

/**
 * Official faction icons from Blizzard's image server (like all other game icons, not in the repo).
 * First the round faction icon, then the faction's PvP banner; if nothing loads, the colored pennant remains.
 */
export const FACTION_ICONS: Record<string, string[]> = {
  HORDE: [
    `${RENDER}/eu/icons/56/pvpcurrency-honor-horde.jpg`,
    `${RENDER}/forever-eu/icons/56/132485.jpg`,
    `${RENDER}/forever-us/icons/56/132485.jpg`,
  ],
  ALLIANCE: [
    `${RENDER}/eu/icons/56/pvpcurrency-honor-alliance.jpg`,
    `${RENDER}/forever-eu/icons/56/132486.jpg`,
    `${RENDER}/forever-us/icons/56/132486.jpg`,
  ],
};

/** Banner colors (light, dark) from the crest palette. */
const FIELDS: Record<string, [string, string]> = {
  HORDE: ["#e0393f", "#b3202a"],
  ALLIANCE: ["#2f6ae0", "#1f4fb8"],
};

/** Colored pennant as a fallback when the faction icon does not load, and for unknown factions. */
function Pennant({ faction, size }: { faction: string; size: number }) {
  const id = useId();
  const { sprache } = useSprache();
  const en = sprache === "en";
  const [light, dark] = FIELDS[faction] ?? ["#6b6f7a", "#3a3d46"];
  const label = faction ? factionName(faction, en) : en ? "Unknown faction" : "Fraktion unbekannt";
  return (
    <svg className="faction-crest" role="img" aria-label={label} viewBox="0 0 20 24" width={size} height={size * 1.2}>
      <title>{label}</title>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
      </defs>
      <path d="M3.5 3 H16.5 V17.5 L10 22.5 L3.5 17.5 Z" fill={`url(#${id})`} stroke="#c9952e" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M1.5 2.5 H18.5" stroke="#f2c95a" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** Horde or Alliance faction icon with a border in the faction color; the colored pennant on a load error. */

export function FactionCrest({ faction, size = 18, decorative = false }: { faction: string; size?: number; decorative?: boolean }) {
  const { sprache } = useSprache();
  const sources = FACTION_ICONS[faction];
  if (decorative) {
    return (
      <span className="faction-crest-deko" aria-hidden="true">
        <FactionCrest faction={faction} size={size} />
      </span>
    );
  }
  if (!sources) return <Pennant faction={faction} size={size} />;
  const [src, ...fallbacks] = sources;
  return (
    <Icon
      src={src}
      fallbacks={fallbacks}
      alt={factionName(faction, sprache === "en")}
      size={size}
      tone={FIELDS[faction][1]}
      className="faction-crest faction-icon"
      placeholder={<Pennant faction={faction} size={size} />}
    />
  );
}
