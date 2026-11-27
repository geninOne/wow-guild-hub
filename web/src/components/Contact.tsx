import { site, type Imprint } from "../lib/site";
import { useSprache, type Fassungen } from "../lib/sprache";

/** Notice above legal texts: in the other languages the legal text stays German. */
export const LEGAL_TEXT_NOTICE: Fassungen<string | null> = {
  de: null,
  en: "The legal notice is in German on purpose, as German law requires.",
  schwaebisch: "Des Rechtliche schtoht do mit Absicht auf Hochdeutsch, gell.",
  bayrisch: "Des Rechtliche steht do mit Absicht auf Hochdeitsch, gell.",
};

/** Short notice, only visible in the other languages. */
export function LegalTextNotice() {
  const { t } = useSprache();
  const text = t(LEGAL_TEXT_NOTICE);
  return text ? <p className="muted small">{text}</p> : null;
}

/** Details from `WEBSITE_IMPRINT_…`; the legal pages only appear when a name is set. */
export function imprintDetails(): Imprint {
  return site().imprint ?? { name: "", address: [], email: null };
}

/** Name and address, optionally with email. */
export function PostalAddress({ withEmail = false }: { withEmail?: boolean }) {
  const { name, address, email } = imprintDetails();
  return (
    <address className="legal-address">
      {name}
      {address.map((line) => (
        <span key={line}>
          <br />
          {line}
        </span>
      ))}
      {withEmail && email && (
        <>
          <br />
          E-Mail: <EmailLink />
        </>
      )}
    </address>
  );
}

/** Email address as a mailto link. */
export function EmailLink() {
  const { email } = imprintDetails();
  return email ? <a href={`mailto:${email}`}>{email}</a> : null;
}
