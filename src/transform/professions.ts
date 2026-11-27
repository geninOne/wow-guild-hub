/** German profession names by profession ID. The API returns the names in English despite de_DE. */
export const PROFESSION_NAMES_DE: Record<number, string> = {
  171: "Alchemie",
  164: "Schmiedekunst",
  185: "Kochkunst",
  333: "Verzauberkunst",
  129: "Erste Hilfe",
  356: "Angeln",
  182: "Kräuterkunde",
  165: "Lederverarbeitung",
  186: "Bergbau",
  393: "Kürschnerei",
  197: "Schneiderei",
  202: "Ingenieurskunst",
};

/** URL slug from the German name: lowercase, umlauts spelled out, spaces as hyphens. */
export function professionSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
