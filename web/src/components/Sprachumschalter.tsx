import { angeboteneSprachen, SPRACH_NAMEN, useSprache, type Fassungen } from "../lib/sprache";

const BESCHRIFTUNG: Fassungen = { de: "Sprache", en: "Language", schwaebisch: "Sproch", bayrisch: "Sprach" };

/** Auswahl der angebotenen Sprachen; die Wahl merkt sich der Browser. Bei nur einer Sprache unsichtbar. */
export function Sprachumschalter({ className }: { className?: string }) {
  const { sprache, setSprache, t } = useSprache();
  const sprachen = angeboteneSprachen();
  if (sprachen.length < 2) return null;
  return (
    <label className={`sprachumschalter${className ? ` ${className}` : ""}`}>
      <span className="sprachumschalter-beschriftung">{t(BESCHRIFTUNG)}</span>
      <select
        value={sprache}
        aria-label={t(BESCHRIFTUNG)}
        onChange={(e) => {
          const neu = sprachen.find((s) => s === e.target.value);
          if (neu) setSprache(neu);
        }}
      >
        {sprachen.map((s) => (
          <option key={s} value={s}>
            {SPRACH_NAMEN[s]}
          </option>
        ))}
      </select>
    </label>
  );
}
