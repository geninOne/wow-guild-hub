import type { CSSProperties } from "react";
import { useSprache, type Fassungen } from "../lib/sprache";

export interface LevelColumn {
  label: string;
  from: number;
  to: number;
  count: number;
}

const T = {
  list: { de: "Mitglieder je Levelstufe", en: "Members per level range", schwaebisch: "Mitglieder je Levelstufe", bayrisch: "Mitglieder je Levelstufe" },
} satisfies Record<string, Fassungen>;

const COLUMN: Fassungen<(label: string, n: number) => string> = {
  de: (label, n) => `${label}: ${n} ${n === 1 ? "Mitglied" : "Mitglieder"}`,
  en: (label, n) => `${label}: ${n} ${n === 1 ? "member" : "members"}`,
  schwaebisch: (label, n) => `${label}: ${n} ${n === 1 ? "Mitglied" : "Mitglieder"}`,
  bayrisch: (label, n) => `${label}: ${n} ${n === 1 ? "Mitglied" : "Mitglieder"}`,
};

/** Short label for narrow screens: "10-19" instead of "10 bis 19", "60" instead of "Level 60". */
function shortLabel(c: LevelColumn): string {
  return c.from === c.to ? String(c.from) : `${c.from}-${c.to}`;
}

/** "bis" between two level bounds, per language. */
export const LEVEL_TO: Fassungen = { de: "bis", en: "to", schwaebisch: "bis", bayrisch: "bis" };

/** Label of a range in the language: "10 bis 19" or "10 to 19", a single level as "Level 60". */
export function bandLabel(c: Pick<LevelColumn, "from" | "to">, toWord = "bis"): string {
  return c.from === c.to ? `Level ${c.from}` : `${c.from} ${toWord} ${c.to}`;
}

/** Full label for screen readers, also for the range without "Level" in its name. */
export function fullLabel(c: Pick<LevelColumn, "from" | "to">, toWord = "bis"): string {
  const label = bandLabel(c, toWord);
  return label.startsWith("Level") ? label : `Level ${label}`;
}

interface LevelColumnsProps {
  columns: LevelColumn[];
  /** Index of the selected range in `columns` (same as `LEVEL_BANDS`), part of the shared crossfilter selection. */
  selected: number | null;
  onSelect(index: number | null): void;
  /** Column color when a class is selected; gold otherwise. */
  color?: string;
}

/**
 * Vertical column chart of the level ranges. Each column is a toggle: one click sets the shared
 * level selection, a second clears it. Flexbox distributes the heights via `flex-grow` (column against the air
 * above it), so the chart fits any panel height and the columns end flush on desktop.
 */
export function LevelColumns({ columns, selected, onSelect, color }: LevelColumnsProps) {
  const { t } = useSprache();
  const toWord = t(LEVEL_TO);
  const max = Math.max(1, ...columns.map((c) => c.count));
  return (
    <ul className="level-cols" aria-label={t(T.list)} data-picked={selected !== null ? "" : undefined}>
      {columns.map((c, i) => (
        <li key={c.from} className="level-col-item">
          <button
            type="button"
            className="level-col"
            aria-pressed={selected === i}
            aria-label={t(COLUMN)(fullLabel(c, toWord), c.count)}
            title={t(COLUMN)(fullLabel(c, toWord), c.count)}
            onClick={() => onSelect(selected === i ? null : i)}
            style={{ "--i": i } as CSSProperties}
          >
            <span className="level-col-well" aria-hidden="true">
              <span className="level-col-air" style={{ flexGrow: max - c.count }} />
              <span className="level-col-count num">{c.count}</span>
              <span
                className="level-col-bar"
                data-empty={c.count === 0 ? "" : undefined}
                style={{ flexGrow: c.count, background: color }}
              />
            </span>
            <span className="level-col-label" aria-hidden="true">
              <span className="level-col-long">{bandLabel(c, toWord)}</span>
              <span className="level-col-short">{shortLabel(c)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
