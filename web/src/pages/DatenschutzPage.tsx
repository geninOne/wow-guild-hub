import { Anschrift, RechtstextHinweis } from "../components/Kontakt";
import { OBERFLAECHEN_ERWEITERUNGEN } from "../erweiterungen";
import { site } from "../lib/site";

/** Ein Abschnitt der Vorlage: Überschrift und Hinweis, was der Betreiber dort beschreiben muss. */
function Platzhalter({ titel, inhalt }: { titel: string; inhalt: string }) {
  return (
    <>
      <h2>{titel}</h2>
      <p className="legal-platzhalter">[Platzhalter: {inhalt}]</p>
    </>
  );
}

/**
 * Platzhalter für die Datenschutzerklärung. Sie nennt nur, welche Abschnitte nötig sind; den Text muss jeder
 * Betreiber selbst verfassen und prüfen lassen. Eigene Rechtstexte setzt ein Modul über `datenschutzSeite` ein
 * (docs/extensions.md). Abschnitte von Modulen (`datenschutz`) erscheinen weiter.
 */
export function DatenschutzPage() {
  const { umami, discord } = site();
  return (
    <section className="page">
      <header className="page-header">
        <h1 className="page-title">Datenschutzerklärung</h1>
        <RechtstextHinweis />
      </header>
      <div className="panel legal">
        <p className="legal-platzhalter">
          [Platzhalter: Diese Datenschutzerklärung ist eine Vorlage. Der Betreiber der Seite muss jeden Abschnitt
          selbst ausformulieren und prüfen.]
        </p>

        <h2>Verantwortlich</h2>
        <Anschrift mitEmail />

        <Platzhalter
          titel="Hosting"
          inhalt="Anbieter des Hostings (z. B. Netlify), welche Zugriffsdaten dabei anfallen, Rechtsgrundlage, Übermittlung in Drittländer."
        />
        {umami && (
          <Platzhalter
            titel="Besucherstatistik mit Umami"
            inhalt="Welche Daten Umami erfasst, dass keine Cookies gesetzt werden, Rechtsgrundlage, Widerspruch."
          />
        )}
        <Platzhalter
          titel="Bilder von Blizzard"
          inhalt="Charakterbilder und Symbole lädt der Browser direkt von render.worldofwarcraft.com; welche Daten Blizzard dabei erhält."
        />
        <Platzhalter
          titel="Spieldaten der Gildenmitglieder"
          inhalt="Welche Spieldaten aus der Blizzard-API gezeigt und gespeichert werden, wie lange, Rechtsgrundlage, Widerspruch."
        />
        <Platzhalter
          titel="Gespeicherte Einstellungen im Browser"
          inhalt="Die gewählte Sprache steht im lokalen Speicher des Browsers und wird nicht übertragen."
        />

        {OBERFLAECHEN_ERWEITERUNGEN.map(({ id, datenschutz: Abschnitt }) => Abschnitt && <Abschnitt key={id} />)}

        <Platzhalter
          titel="Links zu anderen Seiten"
          inhalt={`Externe Links${discord ? " (z. B. Discord)" : ""} und wann Daten an deren Anbieter gehen.`}
        />
        <Platzhalter titel="Kontakt per E-Mail" inhalt="Umgang mit Nachrichten, Rechtsgrundlage, Löschung." />
        <Platzhalter
          titel="Eure Rechte"
          inhalt="Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch, Beschwerde bei einer Aufsichtsbehörde."
        />
      </div>
    </section>
  );
}
