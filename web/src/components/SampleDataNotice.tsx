import { useLanguage, type Translations } from "../lib/language";

const NOTICE: Translations = {
  de: "Beispieldaten für die lokale Entwicklung. Diese Werte sind erfunden.",
  en: "Sample data for local development. These values are made up.",
  schwaebisch: "Beispieldaten fürs lokale Entwickla. Die Werte sin erfonda.",
  bayrisch: "Beispieldatn fia de lokale Entwicklung. De Werte san erfundn.",
};

/** Notice shown when local sample data is displayed. */
export function SampleDataNotice({ show }: { show: boolean }) {
  const { t } = useLanguage();
  if (!show) return null;
  return (
    <p className="testdaten-hint" role="note">
      {t(NOTICE)}
    </p>
  );
}
