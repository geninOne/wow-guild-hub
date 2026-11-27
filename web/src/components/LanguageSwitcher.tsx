import { offeredLanguages, LANGUAGE_NAMES, useLanguage, type Translations } from "../lib/language";

const LABEL: Translations = { de: "Sprache", en: "Language", schwaebisch: "Sproch", bayrisch: "Sprach" };

/** Picker for the offered languages; the browser remembers the choice. Hidden when only one language is offered. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { language, setLanguage, t } = useLanguage();
  const languages = offeredLanguages();
  if (languages.length < 2) return null;
  return (
    <label className={`sprachumschalter${className ? ` ${className}` : ""}`}>
      <span className="sprachumschalter-beschriftung">{t(LABEL)}</span>
      <select
        value={language}
        aria-label={t(LABEL)}
        onChange={(e) => {
          const next = languages.find((s) => s === e.target.value);
          if (next) setLanguage(next);
        }}
      >
        {languages.map((s) => (
          <option key={s} value={s}>
            {LANGUAGE_NAMES[s]}
          </option>
        ))}
      </select>
    </label>
  );
}
