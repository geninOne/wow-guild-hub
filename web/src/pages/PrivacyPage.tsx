import { PostalAddress, LegalTextNotice } from "../components/Contact";
import { registeredUiExtensions } from "../extensions/registry";
import { site } from "../lib/site";

/** One section of the template: heading and a note on what the operator has to describe there. */
function Placeholder({ title, content }: { title: string; content: string }) {
  return (
    <>
      <h2>{title}</h2>
      <p className="legal-platzhalter">[Platzhalter: {content}]</p>
    </>
  );
}

/**
 * Placeholder for the privacy policy. It only names which sections are needed; every operator
 * has to write the text themselves and have it checked. A module provides its own legal texts via `privacyPage`
 * (docs/extensions.md). Sections from modules (`privacy`) still appear.
 */
export function PrivacyPage() {
  const { umami, discord } = site();
  return (
    <section className="page">
      <header className="page-header">
        <h1 className="page-title">Datenschutzerklärung</h1>
        <LegalTextNotice />
      </header>
      <div className="panel legal">
        <p className="legal-platzhalter">
          [Platzhalter: Diese Datenschutzerklärung ist eine Vorlage. Der Betreiber der Seite muss jeden Abschnitt
          selbst ausformulieren und prüfen.]
        </p>

        <h2>Verantwortlich</h2>
        <PostalAddress withEmail />

        <Placeholder
          title="Hosting"
          content="Anbieter des Hostings (z. B. Netlify), welche Zugriffsdaten dabei anfallen, Rechtsgrundlage, Übermittlung in Drittländer."
        />
        {umami && (
          <Placeholder
            title="Besucherstatistik mit Umami"
            content="Welche Daten Umami erfasst, dass keine Cookies gesetzt werden, Rechtsgrundlage, Widerspruch."
          />
        )}
        <Placeholder
          title="Bilder von Blizzard"
          content="Charakterbilder und Symbole lädt der Browser direkt von render.worldofwarcraft.com; welche Daten Blizzard dabei erhält."
        />
        <Placeholder
          title="Spieldaten der Gildenmitglieder"
          content="Welche Spieldaten aus der Blizzard-API gezeigt und gespeichert werden, wie lange, Rechtsgrundlage, Widerspruch."
        />
        <Placeholder
          title="Gespeicherte Einstellungen im Browser"
          content="Die gewählte Sprache steht im lokalen Speicher des Browsers und wird nicht übertragen."
        />

        {registeredUiExtensions().map(({ id, privacy: Section }) => Section && <Section key={id} />)}

        <Placeholder
          title="Links zu anderen Seiten"
          content={`Externe Links${discord ? " (z. B. Discord)" : ""} und wann Daten an deren Anbieter gehen.`}
        />
        <Placeholder title="Kontakt per E-Mail" content="Umgang mit Nachrichten, Rechtsgrundlage, Löschung." />
        <Placeholder
          title="Eure Rechte"
          content="Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch, Beschwerde bei einer Aufsichtsbehörde."
        />
      </div>
    </section>
  );
}
