import { angeboteneSprachen, SPRACH_NAMEN, useSprache, type Fassungen } from "../lib/sprache";

const LABEL: Fassungen = { de: "Sprache", en: "Language", schwaebisch: "Sproch", bayrisch: "Sprach" };

/** Picker for the offered languages; the browser remembers the choice. Hidden when only one language is offered. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { sprache, setSprache, t } = useSprache();
  const languages = angeboteneSprachen();
  if (languages.length < 2) return null;
  return (
    <label className={`sprachumschalter${className ? ` ${className}` : ""}`}>
      <span className="sprachumschalter-beschriftung">{t(LABEL)}</span>
      <select
        value={sprache}
        aria-label={t(LABEL)}
        onChange={(e) => {
          const next = languages.find((s) => s === e.target.value);
          if (next) setSprache(next);
        }}
      >
        {languages.map((s) => (
          <option key={s} value={s}>
            {SPRACH_NAMEN[s]}
          </option>
        ))}
      </select>
    </label>
  );
}
