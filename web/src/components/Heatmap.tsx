import { hourRange, heatLevel, weekdayNames, weekdayNamesShort } from "../lib/fun";
import { useLanguage, type Translations } from "../lib/language";

const HOURS = Array.from({ length: 24 }, (_, h) => h);

const T = {
  logins: {
    de: (n: number) => (n === 1 ? "1 Anmeldung" : `${n} Anmeldungen`),
    en: (n: number) => (n === 1 ? "1 login" : `${n} logins`),
    schwaebisch: (n: number) => (n === 1 ? "1 Anmeldung" : `${n} Anmeldunge`),
    bayrisch: (n: number) => (n === 1 ? "1 Anmeldung" : `${n} Anmeldungen`),
  },
  few: { de: "wenig", en: "few", schwaebisch: "wenig", bayrisch: "weng" },
  grid: { de: "Anmeldungen nach Wochentag und Stunde", en: "Logins by weekday and hour" },
  weekday: { de: "Wochentag", en: "Weekday" },
  hour: { de: (h: number) => `${h} Uhr`, en: (h: number) => `${h}:00` },
  many: { de: "viel", en: "many", schwaebisch: "viel", bayrisch: "vui" },
} satisfies Record<string, Translations<unknown>>;

/** Grid of weekday by hour, 168 values starting Monday 0:00. */
export function Heatmap({ cells }: { cells: number[] }) {
  const { t, language } = useLanguage();
  const short = weekdayNamesShort(language);
  const max = Math.max(0, ...cells);
  return (
    <div className="heatmap" role="table" aria-label={t(T.grid)}>
      <div className="heatmap-row heatmap-hours" role="row">
        <span className="heatmap-corner" role="columnheader" aria-label={t(T.weekday)} />
        {HOURS.map((h) => (
          <span key={h} className="heatmap-hour" role="columnheader" aria-label={t(T.hour)(h)}>
            {h % 3 === 0 ? h : ""}
          </span>
        ))}
      </div>
      {weekdayNames(language).map((day, d) => (
        <div key={day} className="heatmap-row" role="row">
          <span className="heatmap-day" role="rowheader" aria-label={day}>
            {short[d]}
          </span>
          {HOURS.map((h) => {
            const value = cells[d * 24 + h] ?? 0;
            const label = `${day}, ${hourRange(h, language)}: ${t(T.logins)(value)}`;
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
        <span>{t(T.few)}</span>
        {[0, 1, 2, 3, 4, 5].map((l) => (
          <span key={l} className={`heatmap-cell heat-${l}`} />
        ))}
        <span>{t(T.many)}</span>
      </div>
    </div>
  );
}
