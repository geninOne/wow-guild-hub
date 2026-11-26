import { Link } from "react-router";
import type { CharacterRef } from "../../../src/api/types";
import { classColor } from "../lib/wow";

/** Name in Klassenfarbe mit Link zur Charakterseite; unbekannte Charaktere ohne Link. */
export function CharacterLink({ character, children }: { character: CharacterRef; children?: React.ReactNode }) {
  const label = children ?? character.name;
  if (character.classId === 0) return <span className="character-link">{label}</span>;
  return (
    <Link to={`/charakter/${character.slug}`} className="character-link" style={{ color: classColor(character.classId) }}>
      {label}
    </Link>
  );
}
