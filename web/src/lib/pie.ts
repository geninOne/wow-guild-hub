/** Ein Tortenstück als SVG-Pfad, Winkel im Uhrzeigersinn ab zwölf Uhr. */
export interface PieArc {
  start: number;
  end: number;
  path: string;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

function point(cx: number, cy: number, r: number, angle: number): string {
  return `${round(cx + r * Math.sin(angle))} ${round(cy - r * Math.cos(angle))}`;
}

/**
 * Teilt einen Kreis nach den Werten in Stücke. Ein Wert allein ergibt einen vollen Kreis (zwei Halbbögen,
 * weil ein einzelner SVG-Bogen mit gleichem Start und Ende nichts zeichnet). Nullwerte ergeben leere Pfade.
 */
export function pieArcs(values: number[], cx: number, cy: number, r: number): PieArc[] {
  const total = values.reduce((sum, v) => sum + v, 0);
  let angle = 0;
  return values.map((v) => {
    const start = angle;
    const sweep = total === 0 ? 0 : (v / total) * 2 * Math.PI;
    angle += sweep;
    const end = angle;
    if (sweep === 0) return { start, end, path: "" };
    if (sweep >= 2 * Math.PI - 1e-9) {
      return {
        start,
        end,
        path: `M ${point(cx, cy, r, 0)} A ${r} ${r} 0 1 1 ${point(cx, cy, r, Math.PI)} A ${r} ${r} 0 1 1 ${point(cx, cy, r, 0)} Z`,
      };
    }
    const large = sweep > Math.PI ? 1 : 0;
    return {
      start,
      end,
      path: `M ${cx} ${cy} L ${point(cx, cy, r, start)} A ${r} ${r} 0 ${large} 1 ${point(cx, cy, r, end)} Z`,
    };
  });
}
