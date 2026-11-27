import { useRef, type KeyboardEvent } from "react";
import type { GuildRef } from "../../../src/api/types";
import { useSprache, type Fassungen } from "../lib/sprache";
import { FactionCrest } from "./FactionCrest";

const GUILD: Fassungen = { de: "Gilde", en: "Guild" };
const ALL: Fassungen = { de: "Alle", en: "All", schwaebisch: "Älle", bayrisch: "Olle" };

interface GuildFilterProps {
  guilds: GuildRef[];
  /** Slug of the selected guild, null for "All". */
  value: string | null;
  onChange(slug: string | null): void;
}

/**
 * Segmented control "All / Guild A / Guild B" as a radio group: only the selected segment is
 * in the tab order, arrow keys, Home and End change the selection. Hidden with only one guild.
 */
export function GuildFilter({ guilds, value, onChange }: GuildFilterProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const { t } = useSprache();
  if (guilds.length < 2) return null;
  const options = [
    { slug: null as string | null, name: t(ALL), faction: "" },
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
    <div className="segmented" role="radiogroup" aria-label={t(GUILD)}>
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
