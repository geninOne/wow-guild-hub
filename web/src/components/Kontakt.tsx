import { site, type Imprint } from "../lib/site";
import { useSprache, type Fassungen } from "../lib/sprache";

/** Hinweis über Rechtstexten: In den anderen Sprachen bleibt der Rechtstext Deutsch. */
export const RECHTSTEXT_HINWEIS: Fassungen<string | null> = {
  de: null,
  en: "The legal notice is in German on purpose, as German law requires.",
  schwaebisch: "Des Rechtliche schtoht do mit Absicht auf Hochdeutsch, gell.",
  bayrisch: "Des Rechtliche steht do mit Absicht auf Hochdeitsch, gell.",
};

/** Kurzer Hinweis, nur in den anderen Sprachen sichtbar. */
export function RechtstextHinweis() {
  const { t } = useSprache();
  const text = t(RECHTSTEXT_HINWEIS);
  return text ? <p className="muted small">{text}</p> : null;
}

/** Angaben aus `WEBSITE_IMPRINT_…`; die Rechtsseiten erscheinen nur, wenn ein Name gesetzt ist. */
export function impressum(): Imprint {
  return site().imprint ?? { name: "", address: [], email: null };
}

/** Name und Anschrift, auf Wunsch mit E-Mail. */
export function Anschrift({ mitEmail = false }: { mitEmail?: boolean }) {
  const { name, address, email } = impressum();
  return (
    <address className="legal-address">
      {name}
      {address.map((zeile) => (
        <span key={zeile}>
          <br />
          {zeile}
        </span>
      ))}
      {mitEmail && email && (
        <>
          <br />
          E-Mail: <EmailLink />
        </>
      )}
    </address>
  );
}

/** E-Mail-Adresse als mailto-Link. */
export function EmailLink() {
  const { email } = impressum();
  return email ? <a href={`mailto:${email}`}>{email}</a> : null;
}
