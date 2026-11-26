import { Link } from "react-router";
import { useSprache, type Fassungen } from "../lib/sprache";

const T = {
  titel: { de: "Seite nicht gefunden", en: "Page not found", schwaebisch: "Seite net gfonda", bayrisch: "Seitn ned gfundn" },
  text: {
    de: "Diese Seite gibt es nicht oder nicht mehr.",
    en: "This page does not exist, or no longer does.",
    schwaebisch: "Die Seite gibt's net, oder nemme.",
    bayrisch: "De Seitn gibt's ned, oder nimmer.",
  },
  zurUebersicht: {
    de: "Zur Gildenübersicht",
    en: "Back to the guild overview",
    schwaebisch: "Zrück zur Gildenübersicht",
    bayrisch: "Zruck zur Gildnübersicht",
  },
} satisfies Record<string, Fassungen>;

export function NotFoundPage() {
  const { t } = useSprache();
  return (
    <section className="page">
      <header className="page-header">
        <h1 className="page-title">{t(T.titel)}</h1>
      </header>
      <div className="panel">
        <p>{t(T.text)}</p>
        <p>
          <Link to="/">{t(T.zurUebersicht)}</Link>
        </p>
      </div>
    </section>
  );
}
