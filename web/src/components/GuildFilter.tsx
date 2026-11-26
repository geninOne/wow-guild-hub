import { useRef, type KeyboardEvent } from "react";
import type { GuildRef } from "../../../src/api/types";
import { useSprache, type Fassungen } from "../lib/sprache";
import { FactionCrest } from "./FactionCrest";

const GILDE: Fassungen = { de: "Gilde", en: "Guild" };
const ALLE: Fassungen = { de: "Alle", en: "All", schwaebisch: "Älle", bayrisch: "Olle" };

interface GuildFilterProps {
  guilds: GuildRef[];
  /** Slug der gewählten Gilde, null für "Alle". */
  value: string | null;
  onChange(slug: string | null): void;
}

/**
 * Segmentsteuerung "Alle / Gilde A / Gilde B" als Radiogruppe: nur das gewählte Segment ist
 * im Tab-Fokus, Pfeiltasten, Pos1 und Ende wählen um. Bei nur einer Gilde unsichtbar.
 */
export function GuildFilter({ guilds, value, onChange }: GuildFilterProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const { t } = useSprache();
  if (guilds.length < 2) return null;
  const options = [
    { slug: null as string | null, name: t(ALLE), faction: "" },
    ...guilds.map((g) => ({ slug: g.slug, name: g.name, faction: g.faction })),
  ];
  const current = Math.max(0, options.findIndex((o) => o.slug === value));

  function select(index: number) {
    const next = (index + options.length) % options.length;
    onChange(options[next].slug);
    refs.current[next]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const moves: Record<string, number> = {
      ArrowRight: current + 1,
      ArrowDown: current + 1,
      ArrowLeft: current - 1,
      ArrowUp: current - 1,
      Home: 0,
      End: options.length - 1,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    select(moves[event.key]);
  }

  return (
    <div className="segmented" role="radiogroup" aria-label={t(GILDE)}>
      {options.map((o, i) => (
        <button
          key={o.slug ?? ""}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          className="segmented-option"
          data-faction={o.faction}
          aria-checked={i === current}
          tabIndex={i === current ? 0 : -1}
          onClick={() => onChange(o.slug)}
          onKeyDown={onKeyDown}
        >
          {o.faction && <FactionCrest faction={o.faction} size={16} decorative />}
          {o.name}
        </button>
      ))}
    </div>
  );
}
