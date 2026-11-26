/**
 * Deutsche Fraktionsnamen, die Blizzard auch im statischen Verzeichnis nur englisch liefert.
 * Geht vor dem Namen aus `static/reputation-factions`; unbekannte bleiben, wie sie kommen.
 */
export const FACTION_NAMES_DE: Record<number, string> = {
  // Horde
  76: "Orgrimmar",
  68: "Unterstadt",
  81: "Donnerfels",
  530: "Dunkelspeertrolle",
  2798: "Dunkelspeer-Räuber",
  // Allianz
  72: "Sturmwind",
  47: "Eisenschmiede",
  69: "Darnassus",
  54: "Gnomeregangnome",
  // Dampfdruckkartell
  169: "Dampfdruckkartell",
  21: "Beutebucht",
  369: "Gadgetzan",
  470: "Ratschet",
  577: "Ewige Warte",
  // Schlachtfelder
  730: "Sturmlanzengarde",
  890: "Schildwachen der Silberschwingen",
};
