/** Klassenfarben nach Klassen-ID (WoW Classic). */
export const CLASS_COLORS: Record<number, string> = {
  1: "#C69B6D",
  2: "#F48CBA",
  3: "#AAD372",
  4: "#FFF468",
  5: "#FFFFFF",
  7: "#4a92ff", // heller als im Spiel (#0070DD), damit der Name auf dunklem Stahl lesbar bleibt (WCAG AA)
  8: "#3FC7EB",
  9: "#8788EE",
  11: "#FF7C0A",
};

export function classColor(classId: number): string {
  return CLASS_COLORS[classId] ?? "var(--text)";
}

/** Qualitätsfarben der Gegenstände nach Blizzard-Qualitätstyp. */
export const QUALITY_COLORS: Record<string, string> = {
  POOR: "#9d9d9d",
  COMMON: "#ffffff",
  UNCOMMON: "#1eff00",
  RARE: "#4a92ff", // heller als im Spiel (#0070dd), für Kontrast auf Stahl
  EPIC: "#bb6ff5", // heller als im Spiel (#a335ee), für Kontrast auf Stahl
  LEGENDARY: "#ff8000",
  ARTIFACT: "#e6cc80",
  HEIRLOOM: "#00ccff",
};

export function qualityColor(quality: string): string {
  return QUALITY_COLORS[quality] ?? QUALITY_COLORS.COMMON;
}

/** Anordnung der Ausrüstungsplätze: links und rechts vom Charakterbild, Waffen darunter. */
export const SLOT_LAYOUT = {
  left: ["HEAD", "NECK", "SHOULDER", "BACK", "CHEST", "SHIRT", "TABARD", "WRIST"],
  right: ["HANDS", "WAIST", "LEGS", "FEET", "FINGER_1", "FINGER_2", "TRINKET_1", "TRINKET_2"],
  bottom: ["MAIN_HAND", "OFF_HAND", "RANGED", "AMMO"],
};

export const SLOT_NAMES_DE: Record<string, string> = {
  HEAD: "Kopf",
  NECK: "Hals",
  SHOULDER: "Schultern",
  BACK: "Rücken",
  CHEST: "Brust",
  SHIRT: "Hemd",
  TABARD: "Wappenrock",
  WRIST: "Handgelenke",
  HANDS: "Hände",
  WAIST: "Taille",
  LEGS: "Beine",
  FEET: "Füße",
  FINGER_1: "Ring 1",
  FINGER_2: "Ring 2",
  TRINKET_1: "Schmuck 1",
  TRINKET_2: "Schmuck 2",
  MAIN_HAND: "Waffenhand",
  OFF_HAND: "Schildhand",
  RANGED: "Distanzwaffe",
  AMMO: "Munition",
};

/** Einmaliger Rückfall: manche Icons liegen nur unter forever-us (forever-eu liefert 403). */
export function fallbackIconUrl(src: string): string | null {
  return src.includes("/forever-eu/") ? src.replace("/forever-eu/", "/forever-us/") : null;
}

export function factionName(faction: string, englisch = false): string {
  if (faction === "HORDE") return "Horde";
  if (faction === "ALLIANCE") return englisch ? "Alliance" : "Allianz";
  return faction;
}
