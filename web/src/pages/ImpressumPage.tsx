import { Link } from "react-router";
import { Anschrift, EmailLink, impressum, RechtstextHinweis } from "../components/Kontakt";

/**
 * Platzhalter für das Impressum. Name, Anschrift und E-Mail kommen aus `WEBSITE_IMPRINT_…`; die übrigen Texte muss
 * jeder Betreiber selbst verfassen. Eigene Rechtstexte setzt ein Modul über `impressumSeite` ein
 * (docs/extensions.md).
 */
export function ImpressumPage() {
  const { name, email } = impressum();
  return (
    <section className="page">
      <header className="page-header">
        <h1 className="page-title">Impressum</h1>
        <RechtstextHinweis />
      </header>
      <div className="panel legal">
        <p className="legal-platzhalter">
          [Platzhalter: Dieses Impressum ist eine Vorlage und muss vom Betreiber der Seite vervollständigt und geprüft
          werden.]
        </p>

        <h2>Angaben nach § 5 DDG</h2>
        <Anschrift />

        {email && (
          <>
            <h2>Kontakt</h2>
            <p>
              E-Mail: <EmailLink />
            </p>
          </>
        )}

        <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
        <p>{name}, Anschrift wie oben.</p>

        <h2>Über diese Seite</h2>
        <p>[Platzhalter: kurze Beschreibung der Gilde und der Seite.]</p>

        <h2>Hinweis zu Blizzard</h2>
        <p>
          Dies ist eine inoffizielle Fanseite. Sie ist nicht mit Blizzard Entertainment verbunden und wird von
          Blizzard weder unterstützt noch geprüft. World of Warcraft und Blizzard Entertainment sind Marken oder
          eingetragene Marken von Blizzard Entertainment, Inc. Die Spieldaten stammen aus der Blizzard-API, die
          Bilder aus dem Spiel gehören Blizzard Entertainment.
        </p>

        <h2>Haftung für Links</h2>
        <p>[Platzhalter: Hinweis zur Haftung für verlinkte fremde Seiten.]</p>

        <p className="legal-more">
          Wie die Seite mit Daten umgeht, steht in der <Link to="/datenschutz">Datenschutzerklärung</Link>.
        </p>
      </div>
    </section>
  );
}
