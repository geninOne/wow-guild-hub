// Checks the text colors of the "Wappen" (coat of arms) design against WCAG AA (4.5:1 for normal text).
// Usage: node scripts/contrast.mjs   (values as in web/src/styles/theme.css and web/src/lib/wow.ts)
// Also checks the text colors of the weekly newspaper (design "Wappen bei Nacht").
import { CLASS_COLORS, QUALITY_COLORS } from "../web/src/lib/wow.ts";

const STEEL_3 = "#262a34"; // lightest panel color (top of the gradient)
const STEEL_2 = "#1c1f27";
const TOOLTIP = "#0c0d11";
const SEGMENT = "#0b0c10";

const PAIRS = [
  ["Text on panel", "#ece3cf", STEEL_3],
  ["Muted on panel", "#a59c8a", STEEL_3],
  ["Muted on segmented control", "#a59c8a", SEGMENT],
  ["Gold on panel", "#f2c95a", STEEL_3],
  ["Table header gold 2 on panel", "#c9952e", STEEL_3],
  ["Error on panel", "#e8867a", STEEL_3],
  ["Text on gold (dark end)", "#10121a", "#c9952e"],
  ["Text on gold (light end)", "#10121a", "#ffe08a"],
  ["White on Alliance blue (light)", "#ffffff", "#2f6ae0"],
  ["White on Alliance blue", "#ffffff", "#1f4fb8"],
  ["White on Horde red (light, pennant)", "#ffffff", "#cc2a31"],
  ["White on Horde red", "#ffffff", "#b3202a"],
  ...Object.entries(CLASS_COLORS).map(([id, color]) => [`Class ${id} on panel`, color, STEEL_3]),
  ...Object.entries(QUALITY_COLORS)
    .filter(([name]) => name !== "POOR")
    .flatMap(([name, color]) => [
      [`Quality ${name} on panel`, color, STEEL_2],
      [`Quality ${name} in tooltip`, color, TOOLTIP],
    ]),
];

/** Newspaper variants: A Wappen bei Nacht, B tabloid, C petrol pinboard. Background is the lightest spot each time. */
const NEWSPAPER = [
  ["Newspaper A: text on panel", "#ece3cf", STEEL_3],
  ["Newspaper A: card text on panel", "#d8cfba", STEEL_3],
  ["Newspaper A: meta on panel", "#a59c8a", STEEL_3],
  ["Newspaper A: gold on panel", "#f2c95a", STEEL_3],
  ["Newspaper A: section white on Horde red", "#ffffff", "#b3202a"],
  ["Newspaper A: section white on Alliance blue", "#ffffff", "#1f4fb8"],
  ["Newspaper A: saying on gold", "#10121a", "#c9952e"],
  ["Newspaper B: black on paper", "#111111", "#ffffff"],
  ["Newspaper B: signal red on paper (names)", "#d4111b", "#ffffff"],
  ["Newspaper B: white on signal red (masthead)", "#ffffff", "#d4111b"],
  ["Newspaper B: white on black (section bar)", "#ffffff", "#111111"],
  ["Newspaper B: yellow on black", "#ffd400", "#111111"],
  ["Newspaper B: black on yellow (number, ticker)", "#111111", "#ffd400"],
  ...["#ffffff", "#d7f2e6", "#d6e8fb", "#fbd5dc", "#ffe66d"].flatMap((paper) => [
    [`Newspaper C: navy on note ${paper}`, "#14213d", paper],
    [`Newspaper C: cherry red on note ${paper}`, "#b3263a", paper],
  ]),
  ["Newspaper C: white on navy", "#ffffff", "#14213d"],
  ["Newspaper C: lemon on navy", "#ffe66d", "#14213d"],
  ["Newspaper C: sky on navy", "#d6e8fb", "#14213d"],
  ["Newspaper C: light mint on navy", "#9ff3e8", "#14213d"],
];
PAIRS.push(...NEWSPAPER);

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

let failures = 0;
for (const [name, foreground, background] of PAIRS) {
  const ratio = contrast(foreground, background);
  const ok = ratio >= 4.5;
  if (!ok) failures++;
  console.log(`${ok ? "ok      " : "TOO LOW "} ${ratio.toFixed(2).padStart(5)}:1  ${name} (${foreground} on ${background})`);
}
process.exit(failures ? 1 : 0);
