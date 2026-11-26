import type { ReactNode } from "react";
import type { Axis } from "../lib/crossfilter";
import { useSprache, type Fassungen } from "../lib/sprache";
import { ClassName } from "./ClassName";

const T = {
  auswahl: { de: "Auswahl", en: "Selection", schwaebisch: "Auswahl", bayrisch: "Auswahl" },
  hinweis: {
    de: "Alle Mitglieder. Ein Klick in ein Diagramm filtert die anderen.",
    en: "All members. Click a chart to filter the others.",
    schwaebisch: "Älle Mitglieder. Klick ins Diagramm, no wird gfiltert.",
    bayrisch: "Olle Mitglieder. Klick ins Diagramm, nacha werd gfiltert.",
  },
  zuruecksetzen: { de: "Alles zurücksetzen", en: "Reset all", schwaebisch: "Älles zrucksetza", bayrisch: "Ois zruckstelln" },
} satisfies Record<string, Fassungen>;

const ENTFERNEN: Fassungen<(was: string) => string> = {
  de: (was) => `${was} entfernen`,
  en: (was) => `Remove ${was}`,
  schwaebisch: (was) => `${was} weglasse`,
  bayrisch: (was) => `${was} weglassn`,
};

interface SelectionBarProps {
  race: string | null;
  classId: number | null;
  classLabel: string | null;
  level: string | null;
  onRemove(axis: Axis): void;
  onReset(): void;
}

function Cross() {
  return (
    <svg className="dist-chip-x" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Zeile mit der aktiven Auswahl des Kreuzfilters: je Volk, Klasse und Levelstufe ein Schalter zum Entfernen,
 * dazu "Alles zurücksetzen". Ohne Auswahl ein kurzer Hinweis. Die Zeile hält ihre Höhe, damit nichts springt.
 */
export function SelectionBar({ race, classId, classLabel, level, onRemove, onReset }: SelectionBarProps) {
  const { t } = useSprache();
  const chips: { axis: Axis; label: string; node: ReactNode }[] = [];
  if (race !== null) chips.push({ axis: "race", label: race, node: race });
  if (classId !== null && classLabel !== null) {
    chips.push({ axis: "class", label: classLabel, node: <ClassName classId={classId} name={classLabel} /> });
  }
  if (level !== null) chips.push({ axis: "level", label: level, node: level });

  return (
    <div className="dist-selection" aria-live="polite">
      {chips.length === 0 ? (
        <p className="dist-selection-hint">{t(T.hinweis)}</p>
      ) : (
        <ul className="dist-chips" aria-label={t(T.auswahl)}>
          {chips.map((c) => (
            <li key={c.axis}>
              <button type="button" className="dist-chip" aria-label={t(ENTFERNEN)(c.label)} onClick={() => onRemove(c.axis)}>
                <span className="dist-chip-text">{c.node}</span>
                <Cross />
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="dist-reset" onClick={onReset}>
              {t(T.zuruecksetzen)}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
