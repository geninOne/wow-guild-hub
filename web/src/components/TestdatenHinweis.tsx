import { useSprache, type Fassungen } from "../lib/sprache";

const HINWEIS: Fassungen = {
  de: "Beispieldaten für die lokale Entwicklung. Diese Werte sind erfunden.",
  en: "Sample data for local development. These values are made up.",
  schwaebisch: "Beispieldaten fürs lokale Entwickla. Die Werte sin erfonda.",
  bayrisch: "Beispieldatn fia de lokale Entwicklung. De Werte san erfundn.",
};

/** Hinweis, wenn lokale Beispieldaten angezeigt werden. */
export function TestdatenHinweis({ show }: { show: boolean }) {
  const { t } = useSprache();
  if (!show) return null;
  return (
    <p className="testdaten-hint" role="note">
      {t(HINWEIS)}
    </p>
  );
}
