import type { ReactNode } from "react";
import type { MemberFigures } from "../lib/crossfilter";
import { useSprache, type Fassungen } from "../lib/sprache";
import { numberLocale } from "../lib/format";

const T = {
  kennzahlen: { de: "Kennzahlen", en: "Key Figures", schwaebisch: "Kennzahle", bayrisch: "Kennzahln" },
  kennzahlenAuswahl: {
    de: "Kennzahlen der Auswahl",
    en: "Key figures for the selection",
    schwaebisch: "Kennzahle vo dr Auswahl",
    bayrisch: "Kennzahln vo da Auswahl",
  },
  gefiltert: { de: "Gefiltert", en: "Filtered", schwaebisch: "Gfiltert", bayrisch: "Gfiltert" },
  mitglieder: { de: "Mitglieder", en: "Members", schwaebisch: "Mitglieder", bayrisch: "Mitglieder" },
  // Weicher Trennstrich an der Wortfuge: wird es eng, bricht "Durchschnitts-level" dort und nirgends sonst.
  durchschnitt: { de: "Durchschnitts\u00adlevel", en: "Average level", schwaebisch: "Durchschnitts\u00adlevel", bayrisch: "Durchschnitts\u00adlevel" },
  level60: { de: "Auf Level 60", en: "At Level 60", schwaebisch: "Auf Level 60", bayrisch: "Auf Level 60" },
  klassen: { de: "Klassen", en: "Classes", schwaebisch: "Klasse", bayrisch: "Klassn" },
  liste: { de: "Liste", en: "List", schwaebisch: "Lischt", bayrisch: "Listn" },
  listeOeffnen: { de: "Liste öffnen", en: "Open list", schwaebisch: "Lischt aufmache", bayrisch: "Listn aufmacha" },
} satisfies Record<string, Fassungen>;

/* Eigene Symbole im Stil der Seite: schlicht, gefüllt, in currentColor (Gold). */
function PeopleGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="7" r="3.6" fill="currentColor" />
      <path d="M2 20c0-4.3 3.1-7.2 7-7.2s7 2.9 7 7.2z" fill="currentColor" />
      <circle cx="17.2" cy="8" r="2.8" fill="currentColor" opacity="0.65" />
      <path d="M16.4 13.2c3.3.2 5.6 2.8 5.6 6.8h-4.4c0-2.7-.4-4.9-1.2-6.8z" fill="currentColor" opacity="0.65" />
    </svg>
  );
}

function AverageGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="13" width="4.2" height="8" rx="1" fill="currentColor" opacity="0.6" />
      <rect x="9.9" y="8" width="4.2" height="13" rx="1" fill="currentColor" opacity="0.8" />
      <rect x="16.8" y="4" width="4.2" height="17" rx="1" fill="currentColor" />
      <path d="M1.5 11.5h21" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2.2 1.8" strokeLinecap="round" />
    </svg>
  );
}

function CrownGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 8l4.5 4L12 4.5 16.5 12 21 8l-1.8 10H4.8z" fill="currentColor" strokeLinejoin="round" />
      <rect x="4.8" y="19" width="14.4" height="2.2" rx="0.8" fill="currentColor" opacity="0.75" />
      <circle cx="12" cy="13.5" r="1.4" fill="var(--steel-2, #1c1d23)" />
    </svg>
  );
}

function ShieldGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5l8 3v6c0 5-3.4 8.7-8 10-4.6-1.3-8-5-8-10v-6z" fill="currentColor" opacity="0.85" />
      <path d="M12 6.5v11M8 10.5h8" stroke="var(--steel-2, #1c1d23)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function FunnelGlyph() {
  return (
    <svg className="figures-badge-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 3h12l-4.6 5.4V13l-2.8-1.4V8.4z" fill="currentColor" />
    </svg>
  );
}

interface FigureProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  /** Öffnet die Mitgliederliste; ohne bleibt es eine reine Zahl. */
  onClick?: () => void;
}

function Figure({ icon, label, value, onClick }: FigureProps) {
  const { t } = useSprache();
  const inner = (
    <>
      <span className="figure-icon">{icon}</span>
      <span className="figure-text">
        <span className="figure-label">{label}</span>
        <span className="figure-value-row">
          <strong className="figure-value num">{value}</strong>
          {onClick && (
            <>
              <span className="sr-only">, {t(T.listeOeffnen)}</span>
              <span className="figure-hint" aria-hidden="true">
                {t(T.liste)} ›
              </span>
            </>
          )}
        </span>
      </span>
    </>
  );
  return (
    <li className="figure">
      {onClick ? (
        <button type="button" className="figure-body figure-button" aria-haspopup="dialog" onClick={onClick}>
          {inner}
        </button>
      ) : (
        <div className="figure-body">{inner}</div>
      )}
    </li>
  );
}

interface FigureTileProps {
  figures: MemberFigures;
  /** true, wenn eine Auswahl gilt; dann zeigt die Kachel das sichtbar. */
  filtered: boolean;
  onMembers?: () => void;
  onCapped?: () => void;
}

/**
 * Eine Kachel mit den vier Kennzahlen der aktuellen Auswahl: Mitglieder, Durchschnittslevel, Auf Level 60 und
 * Klassen. Mitglieder und Level 60 öffnen die Mitgliederliste. Mit Auswahl goldener Rahmen und Marke "Gefiltert".
 */
export function FigureTile({ figures, filtered, onMembers, onCapped }: FigureTileProps) {
  const { t } = useSprache();
  return (
    <section className="figures" data-filtered={filtered ? "" : undefined} aria-label={t(filtered ? T.kennzahlenAuswahl : T.kennzahlen)}>
      <span className="figures-badge" aria-hidden={!filtered}>
        <FunnelGlyph />
        {t(T.gefiltert)}
      </span>
      <ul className="figures-list">
        <Figure icon={<PeopleGlyph />} label={t(T.mitglieder)} value={figures.members} onClick={onMembers} />
        <Figure
          icon={<AverageGlyph />}
          label={t(T.durchschnitt)}
          value={figures.average.toLocaleString(numberLocale(), { maximumFractionDigits: 1 })}
        />
        <Figure icon={<CrownGlyph />} label={t(T.level60)} value={figures.capped} onClick={onCapped} />
        <Figure icon={<ShieldGlyph />} label={t(T.klassen)} value={figures.classes} />
      </ul>
    </section>
  );
}
