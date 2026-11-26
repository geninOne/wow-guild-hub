import { hourRange, heatLevel, wochentage, wochentageKurz } from "../lib/fun";
import { useSprache, type Fassungen } from "../lib/sprache";

const HOURS = Array.from({ length: 24 }, (_, h) => h);

const T = {
  anmeldungen: {
    de: (n: number) => (n === 1 ? "1 Anmeldung" : `${n} Anmeldungen`),
    en: (n: number) => (n === 1 ? "1 login" : `${n} logins`),
    schwaebisch: (n: number) => (n === 1 ? "1 Anmeldung" : `${n} Anmeldunge`),
    bayrisch: (n: number) => (n === 1 ? "1 Anmeldung" : `${n} Anmeldungen`),
  },
  wenig: { de: "wenig", en: "few", schwaebisch: "wenig", bayrisch: "weng" },
  raster: { de: "Anmeldungen nach Wochentag und Stunde", en: "Logins by weekday and hour" },
  wochentag: { de: "Wochentag", en: "Weekday" },
  stunde: { de: (h: number) => `${h} Uhr`, en: (h: number) => `${h}:00` },
  viel: { de: "viel", en: "many", schwaebisch: "viel", bayrisch: "vui" },
} satisfies Record<string, Fassungen<unknown>>;

/** Raster Wochentag mal Stunde, 168 Werte ab Montag 0 Uhr. */
export function Heatmap({ cells }: { cells: number[] }) {
  const { t, sprache } = useSprache();
  const kurz = wochentageKurz(sprache);
  const max = Math.max(0, ...cells);
  return (
    <div className="heatmap" role="table" aria-label={t(T.raster)}>
      <div className="heatmap-row heatmap-hours" role="row">
        <span className="heatmap-corner" role="columnheader" aria-label={t(T.wochentag)} />
        {HOURS.map((h) => (
          <span key={h} className="heatmap-hour" role="columnheader" aria-label={t(T.stunde)(h)}>
            {h % 3 === 0 ? h : ""}
          </span>
        ))}
      </div>
      {wochentage(sprache).map((day, d) => (
        <div key={day} className="heatmap-row" role="row">
          <span className="heatmap-day" role="rowheader" aria-label={day}>
            {kurz[d]}
          </span>
          {HOURS.map((h) => {
            const value = cells[d * 24 + h] ?? 0;
            const label = `${day}, ${hourRange(h, sprache)}: ${t(T.anmeldungen)(value)}`;
            return (
              <span
                key={h}
                className={`heatmap-cell heat-${heatLevel(value, max)}`}
                role="cell"
                title={label}
                aria-label={label}
              />
            );
          })}
        </div>
      ))}
      <div className="heatmap-legend" aria-hidden="true">
        <span>{t(T.wenig)}</span>
        {[0, 1, 2, 3, 4, 5].map((l) => (
          <span key={l} className={`heatmap-cell heat-${l}`} />
        ))}
        <span>{t(T.viel)}</span>
      </div>
    </div>
  );
}
