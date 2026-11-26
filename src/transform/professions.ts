/** Deutsche Berufsnamen nach Berufs-ID. Die API liefert die Namen trotz de_DE englisch. */
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

/** URL-Kürzel aus dem deutschen Namen: klein, Umlaute ausgeschrieben, Leerzeichen als Bindestrich. */
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
