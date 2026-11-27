/**
 * German faction names that Blizzard delivers only in English, even in the static directory.
 * Takes precedence over the name from `static/reputation-factions`; unknown ones stay as they come.
 */
export const FACTION_NAMES_DE: Record<number, string> = {
  // Horde
  76: "Orgrimmar",
  68: "Unterstadt",
  81: "Donnerfels",
  530: "Dunkelspeertrolle",
  2798: "Dunkelspeer-Räuber",
  // Alliance
  72: "Sturmwind",
  47: "Eisenschmiede",
  69: "Darnassus",
  54: "Gnomeregangnome",
  // Steamwheedle Cartel
  169: "Dampfdruckkartell",
  21: "Beutebucht",
  369: "Gadgetzan",
  470: "Ratschet",
  577: "Ewige Warte",
  // Battlegrounds
  730: "Sturmlanzengarde",
  890: "Schildwachen der Silberschwingen",
};
