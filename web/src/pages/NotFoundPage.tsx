import { Link } from "react-router";
import { useLanguage, type Translations } from "../lib/language";

const T = {
  title: { de: "Seite nicht gefunden", en: "Page not found", schwaebisch: "Seite net gfonda", bayrisch: "Seitn ned gfundn" },
  text: {
    de: "Diese Seite gibt es nicht oder nicht mehr.",
    en: "This page does not exist, or no longer does.",
    schwaebisch: "Die Seite gibt's net, oder nemme.",
    bayrisch: "De Seitn gibt's ned, oder nimmer.",
  },
  toOverview: {
    de: "Zur Gildenübersicht",
    en: "Back to the guild overview",
    schwaebisch: "Zrück zur Gildenübersicht",
    bayrisch: "Zruck zur Gildnübersicht",
  },
} satisfies Record<string, Translations>;

export function NotFoundPage() {
  const { t } = useLanguage();
  return (
    <section className="page">
      <header className="page-header">
        <h1 className="page-title">{t(T.title)}</h1>
      </header>
      <div className="panel">
        <p>{t(T.text)}</p>
        <p>
          <Link to="/">{t(T.toOverview)}</Link>
        </p>
      </div>
    </section>
  );
}
