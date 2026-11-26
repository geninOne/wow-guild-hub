import type { CSSProperties } from "react";
import { useSprache, type Fassungen } from "../lib/sprache";

export interface LevelColumn {
  label: string;
  from: number;
  to: number;
  count: number;
}

const T = {
  liste: { de: "Mitglieder je Levelstufe", en: "Members per level range", schwaebisch: "Mitglieder je Levelstufe", bayrisch: "Mitglieder je Levelstufe" },
} satisfies Record<string, Fassungen>;

const SAEULE: Fassungen<(label: string, n: number) => string> = {
  de: (label, n) => `${label}: ${n} ${n === 1 ? "Mitglied" : "Mitglieder"}`,
  en: (label, n) => `${label}: ${n} ${n === 1 ? "member" : "members"}`,
  schwaebisch: (label, n) => `${label}: ${n} ${n === 1 ? "Mitglied" : "Mitglieder"}`,
  bayrisch: (label, n) => `${label}: ${n} ${n === 1 ? "Mitglied" : "Mitglieder"}`,
};

/** Kurze Beschriftung für schmale Schirme: "10-19" statt "10 bis 19", "60" statt "Level 60". */
function shortLabel(c: LevelColumn): string {
  return c.from === c.to ? String(c.from) : `${c.from}-${c.to}`;
}

/** "bis" zwischen zwei Levelgrenzen, je Sprache. */
export const LEVEL_BIS: Fassungen = { de: "bis", en: "to", schwaebisch: "bis", bayrisch: "bis" };

/** Beschriftung einer Stufe in der Sprache: "10 bis 19" bzw. "10 to 19", eine einzelne Stufe als "Level 60". */
export function bandLabel(c: Pick<LevelColumn, "from" | "to">, bis = "bis"): string {
  return c.from === c.to ? `Level ${c.from}` : `${c.from} ${bis} ${c.to}`;
}

/** Ausführliche Beschriftung für Screenreader, auch für die Stufe ohne "Level" im Namen. */
export function fullLabel(c: Pick<LevelColumn, "from" | "to">, bis = "bis"): string {
  const label = bandLabel(c, bis);
  return label.startsWith("Level") ? label : `Level ${label}`;
}

interface LevelColumnsProps {
  columns: LevelColumn[];
  /** Index der gewählten Stufe in `columns` (gleich `LEVEL_BANDS`), Teil der gemeinsamen Auswahl des Kreuzfilters. */
  selected: number | null;
  onSelect(index: number | null): void;
  /** Farbe der Säulen, wenn eine Klasse gewählt ist; sonst Gold. */
  color?: string;
}

/**
 * Senkrechtes Säulendiagramm der Levelstufen. Jede Säule ist ein Schalter: ein Klick setzt die gemeinsame
 * Levelwahl, ein zweiter hebt sie auf. Die Höhen verteilt Flexbox über `flex-grow` (Säule gegen Luft darüber),
 * so passt sich das Diagramm jeder Panelhöhe an und die Spalten auf dem Desktop enden bündig.
 */
export function LevelColumns({ columns, selected, onSelect, color }: LevelColumnsProps) {
  const { t } = useSprache();
  const bis = t(LEVEL_BIS);
  const max = Math.max(1, ...columns.map((c) => c.count));
  return (
    <ul className="level-cols" aria-label={t(T.liste)} data-picked={selected !== null ? "" : undefined}>
      {columns.map((c, i) => (
        <li key={c.from} className="level-col-item">
          <button
            type="button"
            className="level-col"
            aria-pressed={selected === i}
            aria-label={t(SAEULE)(fullLabel(c, bis), c.count)}
            title={t(SAEULE)(fullLabel(c, bis), c.count)}
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
              <span className="level-col-long">{bandLabel(c, bis)}</span>
              <span className="level-col-short">{shortLabel(c)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
