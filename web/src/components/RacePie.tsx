import { useMemo, useState } from "react";
import type { MemberRow } from "../../../src/api/types";
import { keepSelected } from "../lib/crossfilter";
import { raceDistribution, type RaceSlice } from "../lib/members";
import { pieArcs } from "../lib/pie";
import { useSprache, type Fassungen } from "../lib/sprache";
import { numberLocale } from "../lib/format";

const T = {
  titel: { de: "Völkerverteilung", en: "Race Distribution", schwaebisch: "Völkerverteilung", bayrisch: "Völkerverteilung" },
  spruch: {
    de: "Wer steckt in welcher Haut? Ein Klick auf ein Volk filtert Klassen und Level.",
    en: "Who's in whose skin? Click a race to filter classes and levels.",
    schwaebisch: "Wer steckt in welchere Haut? Klick auf a Volk, no siehsch seine Klasse ond Level.",
    bayrisch: "Wer steckt in wos für a Haut? Klick auf a Volk, nacha siagst seine Klassn und Level.",
  },
  volk: { de: "Volk", en: "Race", schwaebisch: "Volk", bayrisch: "Volk" },
  anzahl: { de: "Anzahl", en: "Count", schwaebisch: "Azahl", bayrisch: "Anzahl" },
  anteil: { de: "Anteil", en: "Share", schwaebisch: "Anteil", bayrisch: "Anteil" },
  leer: {
    de: "Niemand da. Selbst die Untoten sind heute im Grab geblieben.",
    en: "Nobody here. Even the Undead stayed in their graves today.",
    schwaebisch: "Koiner do. Sogar d'Untote sind heit im Grab bliebe.",
    bayrisch: "Koana do. Sogar de Untotn san heit im Grab bliebn.",
  },
  torte: { de: "Völker als Torte", en: "Races as a pie chart", schwaebisch: "Völker als Torte", bayrisch: "Völker ois Tortn" },
} satisfies Record<string, Fassungen>;

/** Spruch zum häufigsten Volk, nach Volk-ID (Classic: 1 Mensch bis 8 Troll, Forever: 95 und 96 Himmelsgeborene). */
const VORNE: Record<number, Fassungen> = {
  1: {
    de: "Menschen vorne. Durchschnitt ist auch eine Stärke.",
    en: "Humans in the lead. Being average is a strength too.",
    schwaebisch: "D'Menscha vorne. Durchschnitt isch au a Stärke.",
    bayrisch: "De Menschn vorn. Durchschnitt is a a Stärk.",
  },
  2: {
    de: "Orcs vorne. Lok'tar, und bitte die Hauer putzen.",
    en: "Orcs in the lead. Lok'tar, and please brush those tusks.",
    schwaebisch: "D'Orcs vorne. Lok'tar, ond butzet d'Hauer.",
    bayrisch: "De Orcs vorn. Lok'tar, und d'Hauer putzn, bittschön.",
  },
  3: {
    de: "Zwerge vorne. Klein, bärtig, durstig.",
    en: "Dwarves in the lead. Short, bearded, thirsty.",
    schwaebisch: "D'Zwerg vorne. Kloi, bärtig, durschtig.",
    bayrisch: "De Zwerg vorn. Kloa, bärtig, durstig.",
  },
  4: {
    de: "Nachtelfen vorne. Sie hüpfen beim Laufen, aber elegant.",
    en: "Night Elves in the lead. They hop when they run, but gracefully.",
    schwaebisch: "D'Nachtelfa vorne. Se hopset beim Laufa, aber elegant.",
    bayrisch: "De Nachtelfn vorn. De hupfn beim Laffa, aber elegant.",
  },
  5: {
    de: "Untote vorne. Die Gilde lebt, mehr oder weniger.",
    en: "Undead in the lead. The guild is alive, more or less.",
    schwaebisch: "D'Untote vorne. D'Gild lebt, mehr oder wenger.",
    bayrisch: "De Untotn vorn. D'Gild lebt, mehr oder weniger.",
  },
  6: {
    de: "Tauren vorne. Viel Fell, viel Herz, wenig Platz im Zeppelin.",
    en: "Tauren in the lead. Lots of fur, lots of heart, little room on the zeppelin.",
    schwaebisch: "D'Taure vorne. Viel Fell, viel Herz, wenig Platz im Zeppelin.",
    bayrisch: "De Taurn vorn. Vui Fell, vui Herz, wenig Platz im Zeppelin.",
  },
  7: {
    de: "Gnome vorne. Klein, aber zahlreich.",
    en: "Gnomes in the lead. Small, but plentiful.",
    schwaebisch: "D'Gnom vorne. Kloi, aber viele.",
    bayrisch: "De Gnome vorn. Kloa, aber vui.",
  },
  8: {
    de: "Trolle vorne. Entspannt bleiben, Mann.",
    en: "Trolls in the lead. Stay relaxed, mon.",
    schwaebisch: "D'Troll vorne. Bloß net hudla, Mann.",
    bayrisch: "De Troll vorn. Nur ned hudln, Mann.",
  },
  95: {
    de: "Himmelsgeborene vorne. Die Gilde hebt ab.",
    en: "Skyborn in the lead. The guild is taking off.",
    schwaebisch: "D'Himmelsgeborene vorne. D'Gild hebt ab.",
    bayrisch: "De Himmelsgeborenen vorn. D'Gild hebt ab.",
  },
  96: {
    de: "Himmelsgeborene vorne. Rückenwind inklusive.",
    en: "Skyborn in the lead. Tailwind included.",
    schwaebisch: "D'Himmelsgeborene vorne. Rückawind isch dabei.",
    bayrisch: "De Himmelsgeborenen vorn. Rückenwind is dabei.",
  },
};

const VORNE_SONST: Fassungen<(name: string) => string> = {
  de: (name) => `${name} vorne. Volk der Stunde!`,
  en: (name) => `${name} in the lead. Race of the hour!`,
  schwaebisch: (name) => `${name} vorne. Volk vo dr Stund!`,
  bayrisch: (name) => `${name} vorn. Volk vo da Stund!`,
};

const GLEICHSTAND: Fassungen<(a: string, b: string) => string> = {
  de: (a, b) => `Gleichstand an der Spitze: ${a} und ${b} teilen sich das Treppchen.`,
  en: (a, b) => `Tied at the top: ${a} and ${b} share the podium.`,
  schwaebisch: (a, b) => `Gleichstand ganz vorne: ${a} ond ${b} teilet sich's Trepple.`,
  bayrisch: (a, b) => `Gleichstand ganz vorn: ${a} und ${b} teiln sich's Stockerl.`,
};

/**
 * Feste Farbe je Volk, damit ein Volk beim Filtern seine Farbe behält. Helle, gesättigte Töne mit großem
 * Abstand im Farbkreis (Elfenbein und Limette für die Himmelsgeborenen), alle mit mindestens 3:1 gegen das Panel; die Stücke trennt eine Fuge in Panelfarbe.
 */
export const RACE_COLORS: Record<number, string> = {
  1: "#5b9cf5", // Mensch: Blau
  2: "#e5533d", // Orc: Rot
  3: "#e3a33b", // Zwerg: Bernstein
  4: "#a77ef0", // Nachtelf: Violett
  5: "#7fd18b", // Untoter: Grün
  6: "#b98a62", // Tauren: Braun
  7: "#f27fc4", // Gnom: Rosa
  8: "#3fc1c9", // Troll: Türkis
  95: "#ece3cf", // Himmelsgeborener des Hohen Ordens (Allianz): Elfenbein
  96: "#c6e35a", // Himmelsgeborener der Windformer (Horde): Limette
};
const FALLBACK_COLORS = ["#d8cfba", "#9fb3c8", "#c8b29f"];

export function raceColor(raceId: number): string {
  return RACE_COLORS[raceId] ?? FALLBACK_COLORS[raceId % FALLBACK_COLORS.length];
}

function percent(share: number): string {
  return `${(share * 100).toLocaleString(numberLocale(), { maximumFractionDigits: 0 })} %`;
}

/** So weit rückt das gewählte Stück aus der Mitte (in SVG-Einheiten, Radius 92). */
const PULL = 7;

interface RacePieProps {
  /** Aktive Mitglieder, schon nach Gilde, Klasse und Level gefiltert (Kreuzfilter ohne die Volksachse). */
  members: MemberRow[];
  /** Gewähltes Volk der gemeinsamen Auswahl; es wird hervorgehoben, die anderen Stücke gedimmt. */
  raceId: number | null;
  /** Klick auf ein Stück oder eine Legendenzeile: dasselbe Volk noch einmal hebt die Wahl auf. */
  onRace(raceId: number): void;
  /** Name eines Volks, falls das gewählte gerade herausgefiltert ist. */
  raceName(raceId: number): string | null;
  /** Hinweis auf die Auswahlen der anderen Diagramme, ersetzt den Spruch im Kopf. */
  note?: string | null;
}

/**
 * Torte der Völker mit Tabelle als Legende und für Screenreader. Ein Klick auf ein Stück oder eine Legendenzeile
 * wählt das Volk für den Kreuzfilter; per Tastatur und Screenreader über die Schalter in der Legende.
 */
export function RacePie({ members, raceId, onRace, raceName, note }: RacePieProps) {
  const { t } = useSprache();
  const [hover, setHover] = useState<number | null>(null);
  const slices = useMemo(
    () =>
      keepSelected(raceDistribution(members, { classId: null, band: null }), raceId, (s) => s.raceId, (id) => {
        const name = raceName(id);
        return name === null ? null : { raceId: id, raceName: name, count: 0, share: 0 };
      }),
    [members, raceId, raceName],
  );
  const total = slices.reduce((sum, s) => sum + s.count, 0);
  const arcs = pieArcs(slices.map((s) => s.count), 100, 100, 92);
  // Gedimmt wird beim Überfahren alles außer dem überfahrenen Volk, sonst alles außer dem gewählten.
  const focus = hover ?? raceId;

  return (
    <div className="panel race-panel">
      <header className="panel-header stat-theme-header">
        <h2 className="panel-title">{t(T.titel)}</h2>
        <p className="stat-theme-blurb">{note ?? t(T.spruch)}</p>
      </header>

      {total === 0 ? (
        <div className="state state-empty race-empty" role="status">
          {t(T.leer)}
        </div>
      ) : (
        <>
          <p className="race-top" aria-live="polite">
            <TopSaying slices={slices} />
          </p>
          <div className="race-body">
            <svg
              className="race-pie"
              viewBox="0 0 200 200"
              role="img"
              aria-label={`${t(T.torte)}: ${slices
                .filter((s) => s.count > 0)
                .map((s) => `${s.raceName} ${s.count} (${percent(s.share)})`)
                .join(", ")}`}
              data-picked={raceId !== null ? "" : undefined}
            >
              {slices.map((s, i) => {
                const arc = arcs[i];
                if (!arc.path) return null;
                const mid = (arc.start + arc.end) / 2;
                const whole = arc.end - arc.start >= 2 * Math.PI - 1e-9;
                const pulled = s.raceId === raceId && !whole;
                return (
                  <path
                    key={s.raceId}
                    className="race-slice"
                    d={arc.path}
                    fill={raceColor(s.raceId)}
                    data-dim={focus !== null && focus !== s.raceId ? "" : undefined}
                    data-selected={s.raceId === raceId ? "" : undefined}
                    transform={pulled ? `translate(${(Math.sin(mid) * PULL).toFixed(2)} ${(-Math.cos(mid) * PULL).toFixed(2)})` : undefined}
                    onMouseEnter={() => setHover(s.raceId)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => onRace(s.raceId)}
                  >
                    <title>{`${s.raceName}: ${s.count} (${percent(s.share)})`}</title>
                  </path>
                );
              })}
            </svg>
            <table className="race-legend" data-picked={raceId !== null ? "" : undefined}>
              <caption className="sr-only">{t(T.titel)}</caption>
              <thead>
                <tr>
                  <th scope="col">{t(T.volk)}</th>
                  <th scope="col" className="num">
                    {t(T.anzahl)}
                  </th>
                  <th scope="col" className="num">
                    {t(T.anteil)}
                  </th>
                </tr>
              </thead>
              <tbody>
                {slices.map((s) => (
                  <tr
                    key={s.raceId}
                    data-active={hover === s.raceId ? "" : undefined}
                    data-selected={s.raceId === raceId ? "" : undefined}
                    onMouseEnter={() => setHover(s.raceId)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => onRace(s.raceId)}
                  >
                    <th scope="row">
                      <button
                        type="button"
                        className="race-pick"
                        aria-pressed={s.raceId === raceId}
                        onClick={(e) => {
                          // Die Zeile selbst ist für die Maus auch klickbar; nicht doppelt umschalten.
                          e.stopPropagation();
                          onRace(s.raceId);
                        }}
                      >
                        <span className="race-swatch" style={{ background: raceColor(s.raceId) }} aria-hidden="true" />
                        {s.raceName}
                      </button>
                    </th>
                    <td className="num">{s.count}</td>
                    <td className="num">{percent(s.share)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function TopSaying({ slices }: { slices: RaceSlice[] }) {
  const { t } = useSprache();
  const [first, second] = slices;
  if (second && second.count === first.count) return <>{t(GLEICHSTAND)(first.raceName, second.raceName)}</>;
  const fixed = VORNE[first.raceId];
  return <>{fixed ? t(fixed) : t(VORNE_SONST)(first.raceName)}</>;
}
