// Prüft die Textfarben der Gestaltung "Wappen" gegen WCAG AA (4,5:1 für normalen Text).
// Aufruf: node scripts/kontrast.mjs   (Werte wie in web/src/styles/theme.css und web/src/lib/wow.ts)
// Dazu die Textfarben der Wochenzeitung (Gestaltung "Wappen bei Nacht").
import { CLASS_COLORS, QUALITY_COLORS } from "../web/src/lib/wow.ts";

const STAHL_3 = "#262a34"; // hellste Panelfarbe (oben im Verlauf)
const STAHL_2 = "#1c1f27";
const TOOLTIP = "#0c0d11";
const SEGMENT = "#0b0c10";

const PAARE = [
  ["Text auf Panel", "#ece3cf", STAHL_3],
  ["Gedämpft auf Panel", "#a59c8a", STAHL_3],
  ["Gedämpft auf Segmentsteuerung", "#a59c8a", SEGMENT],
  ["Gold auf Panel", "#f2c95a", STAHL_3],
  ["Tabellenkopf Gold 2 auf Panel", "#c9952e", STAHL_3],
  ["Fehler auf Panel", "#e8867a", STAHL_3],
  ["Text auf Gold (dunkles Ende)", "#10121a", "#c9952e"],
  ["Text auf Gold (helles Ende)", "#10121a", "#ffe08a"],
  ["Weiß auf Allianz-Blau (hell)", "#ffffff", "#2f6ae0"],
  ["Weiß auf Allianz-Blau", "#ffffff", "#1f4fb8"],
  ["Weiß auf Horde-Rot (hell, Wimpel)", "#ffffff", "#cc2a31"],
  ["Weiß auf Horde-Rot", "#ffffff", "#b3202a"],
  ...Object.entries(CLASS_COLORS).map(([id, farbe]) => [`Klasse ${id} auf Panel`, farbe, STAHL_3]),
  ...Object.entries(QUALITY_COLORS)
    .filter(([name]) => name !== "POOR")
    .flatMap(([name, farbe]) => [
      [`Qualität ${name} auf Panel`, farbe, STAHL_2],
      [`Qualität ${name} im Tooltip`, farbe, TOOLTIP],
    ]),
];

/** Zeitungsvarianten: A Wappen bei Nacht, B Boulevard, C Pinnwand Petrol. Hintergrund jeweils die hellste Stelle. */
const ZEITUNG = [
  ["Zeitung A: Text auf Panel", "#ece3cf", STAHL_3],
  ["Zeitung A: Kartentext auf Panel", "#d8cfba", STAHL_3],
  ["Zeitung A: Meta auf Panel", "#a59c8a", STAHL_3],
  ["Zeitung A: Gold auf Panel", "#f2c95a", STAHL_3],
  ["Zeitung A: Rubrik Weiß auf Hordenrot", "#ffffff", "#b3202a"],
  ["Zeitung A: Rubrik Weiß auf Allianzblau", "#ffffff", "#1f4fb8"],
  ["Zeitung A: Spruch auf Gold", "#10121a", "#c9952e"],
  ["Zeitung B: Schwarz auf Papier", "#111111", "#ffffff"],
  ["Zeitung B: Signalrot auf Papier (Namen)", "#d4111b", "#ffffff"],
  ["Zeitung B: Weiß auf Signalrot (Kopf)", "#ffffff", "#d4111b"],
  ["Zeitung B: Weiß auf Schwarz (Rubrikbalken)", "#ffffff", "#111111"],
  ["Zeitung B: Gelb auf Schwarz", "#ffd400", "#111111"],
  ["Zeitung B: Schwarz auf Gelb (Zahl, Laufband)", "#111111", "#ffd400"],
  ...["#ffffff", "#d7f2e6", "#d6e8fb", "#fbd5dc", "#ffe66d"].flatMap((papier) => [
    [`Zeitung C: Marine auf Zettel ${papier}`, "#14213d", papier],
    [`Zeitung C: Kirschrot auf Zettel ${papier}`, "#b3263a", papier],
  ]),
  ["Zeitung C: Weiß auf Marine", "#ffffff", "#14213d"],
  ["Zeitung C: Zitrone auf Marine", "#ffe66d", "#14213d"],
  ["Zeitung C: Himmel auf Marine", "#d6e8fb", "#14213d"],
  ["Zeitung C: Mint hell auf Marine", "#9ff3e8", "#14213d"],
];
PAARE.push(...ZEITUNG);

function luminanz(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function kontrast(a, b) {
  const [hell, dunkel] = [luminanz(a), luminanz(b)].sort((x, y) => y - x);
  return (hell + 0.05) / (dunkel + 0.05);
}

let fehler = 0;
for (const [name, vorne, hinten] of PAARE) {
  const wert = kontrast(vorne, hinten);
  const ok = wert >= 4.5;
  if (!ok) fehler++;
  console.log(`${ok ? "ok    " : "ZU WENIG"} ${wert.toFixed(2).padStart(5)}:1  ${name} (${vorne} auf ${hinten})`);
}
process.exit(fehler ? 1 : 0);
