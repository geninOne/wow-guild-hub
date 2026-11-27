import { useId, type CSSProperties } from "react";
import type { PlacedTalent, SpecLayout, TalentView } from "../../../src/api/types";
import type { CharacterSpec, TalentNode } from "../../../src/model";
import {
  arrowsFor,
  nodeState,
  pointsLabel,
  rankDescription,
  talentName,
  talentRanks,
  visibleUnplaced,
} from "../lib/talents";
import { useSprache, type Fassungen } from "../lib/sprache";
import { Icon } from "./Icon";
import { Tooltip } from "./Tooltip";

const T = {
  rank: { de: "Rang", en: "Rank", schwaebisch: "Rang", bayrisch: "Rang" },
  nextRank: { de: "Nächster Rang", en: "Next rank", schwaebisch: "Nächschter Rang", bayrisch: "Nächster Rang" },
  talentTree: { de: "Talentbaum", en: "Talent tree", schwaebisch: "Talentbaum", bayrisch: "Talentbaam" },
  otherTalents: { de: "Weitere Talente", en: "Other talents", schwaebisch: "No meh Talente", bayrisch: "Weitere Talente" },
  pointsSpent: { de: "Verteilte Punkte", en: "Points spent", schwaebisch: "Verteilte Pünktle", bayrisch: "Verteilte Punkterl" },
  noPoints: {
    de: "Noch keine Talentpunkte verteilt",
    en: "No talent points spent yet",
    schwaebisch: "No koine Talentpunkt verteilt",
    bayrisch: "No koane Talentpunkte verteilt",
  },
} satisfies Record<string, Fassungen>;

const POINTS: Fassungen<(points: number) => string> = {
  de: pointsLabel,
  en: (points) => (points === 1 ? "1 point" : `${points} points`),
};

/* Fixed grid sizes in pixels so that the arrows in the SVG sit exactly on the nodes. */
const CELL = 44;
const GAP_X = 26;
const GAP_Y = 22;
const COLS = 4;
/** Gap between the arrowhead and the target icon. */
const TIP_GAP = 3;

const cellX = (col: number) => (col - 1) * (CELL + GAP_X);
const cellY = (row: number) => (row - 1) * (CELL + GAP_Y);

/** SVG path from source to target: vertical, horizontal (same row) or as an angle. */
function arrowPath(from: PlacedTalent, to: PlacedTalent): string {
  const fx = cellX(from.gridCol);
  const fy = cellY(from.gridRow);
  const tx = cellX(to.gridCol);
  const ty = cellY(to.gridRow);
  const mid = CELL / 2;

  if (from.gridRow === to.gridRow) {
    const right = to.gridCol > from.gridCol;
    const x1 = right ? fx + CELL : fx;
    const x2 = right ? tx - TIP_GAP : tx + CELL + TIP_GAP;
    return `M ${x1} ${fy + mid} H ${x2}`;
  }

  const down = to.gridRow > from.gridRow;
  const y2 = down ? ty - TIP_GAP : ty + CELL + TIP_GAP;
  if (from.gridCol === to.gridCol) {
    return `M ${fx + mid} ${down ? fy + CELL : fy} V ${y2}`;
  }
  // Different column and row: sideways out of the source, then vertically into the target.
  const right = to.gridCol > from.gridCol;
  return `M ${right ? fx + CELL : fx} ${fy + mid} H ${tx + mid} V ${y2}`;
}

function TalentTip({ node, rank }: { node: TalentNode; rank: number }) {
  const { t } = useSprache();
  const current = rankDescription(node, Math.max(rank, 1));
  const next = rank > 0 && rank < node.maxRank ? rankDescription(node, rank + 1) : "";
  return (
    <div className="talent-tip">
      <p className="talent-tip-name">{talentName(node)}</p>
      <p className="talent-tip-rank">
        {t(T.rank)} {rank}/{node.maxRank}
      </p>
      {current && <p className="talent-tip-desc">{current}</p>}
      {next && (
        <>
          <p className="talent-tip-next">{t(T.nextRank)}:</p>
          <p className="talent-tip-desc">{next}</p>
        </>
      )}
    </div>
  );
}

interface NodeProps {
  node: TalentNode;
  rank: number;
  icon: string | null | undefined;
  style?: CSSProperties;
}

function TalentNodeView({ node, rank, icon, style }: NodeProps) {
  const state = nodeState(rank, node.maxRank);
  return (
    <div className={`talent-node talent-${state}`} style={{ width: CELL, height: CELL, ...style }}>
      <Tooltip content={<TalentTip node={node} rank={rank} />} className="talent-trigger">
        <Icon src={icon} alt="" size={CELL} />
        <span className="sr-only">{talentName(node)}</span>
        <span className="talent-rank">
          {rank}/{node.maxRank}
        </span>
      </Tooltip>
    </div>
  );
}

interface SpecProps {
  spec: SpecLayout;
  rows: number;
  points: number;
  ranks: Map<number, number>;
  icons: TalentView["icons"];
}

function SpecTree({ spec, rows, points, ranks, icons }: SpecProps) {
  const id = useId();
  const { t } = useSprache();
  const width = COLS * CELL + (COLS - 1) * GAP_X;
  const height = rows * CELL + (rows - 1) * GAP_Y;
  const rankOf = (node: TalentNode) => ranks.get(node.talentId) ?? 0;
  const extra = visibleUnplaced(spec, ranks);
  const gridStyle: CSSProperties = {
    gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`,
    gridTemplateRows: `repeat(${rows}, ${CELL}px)`,
    columnGap: GAP_X,
    rowGap: GAP_Y,
  };

  return (
    <section className="talent-spec" aria-labelledby={`${id}-name`}>
      <header className="talent-spec-head">
        <div>
          <span className="panel-kicker">{t(T.talentTree)}</span>
          <h2 id={`${id}-name`} className="talent-spec-name">
            {spec.name}
          </h2>
        </div>
        <span className={points > 0 ? "talent-spec-points gold" : "talent-spec-points muted"}>
          {t(POINTS)(points)}
        </span>
      </header>

      <div className="talent-board" style={{ width, height }}>
        <svg
          className="talent-arrows"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <marker id={`${id}-tip`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">
              <path d="M 0 0 L 8 4 L 0 8 z" className="talent-arrowhead" />
            </marker>
            <marker id={`${id}-tip-active`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">
              <path d="M 0 0 L 8 4 L 0 8 z" className="talent-arrowhead talent-arrowhead-active" />
            </marker>
          </defs>
          {arrowsFor(spec).map(({ from, to }) => {
            const active = rankOf(to) > 0;
            return (
              <path
                key={`${from.nodeId}-${to.nodeId}`}
                d={arrowPath(from, to)}
                className={active ? "talent-arrow talent-arrow-active" : "talent-arrow"}
                markerEnd={`url(#${active ? `${id}-tip-active` : `${id}-tip`})`}
              />
            );
          })}
        </svg>
        <div className="talent-grid" style={gridStyle}>
          {spec.nodes.map((node) => (
            <TalentNodeView
              key={node.nodeId}
              node={node}
              rank={rankOf(node)}
              icon={icons[String(node.spellId)]}
              style={{ gridRow: node.gridRow, gridColumn: node.gridCol }}
            />
          ))}
        </div>
      </div>

      {extra.length > 0 && (
        <div className="talent-extra">
          <h3 className="talent-extra-title">{t(T.otherTalents)}</h3>
          <div className="talent-extra-list">
            {extra.map((node) => (
              <TalentNodeView key={node.nodeId} node={node} rank={rankOf(node)} icon={icons[String(node.spellId)]} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

interface TalentTreeProps {
  view: TalentView;
  specs: CharacterSpec[];
}

/** The three talent trees of a class with the character's ranks. */

export function TalentTree({ view, specs }: TalentTreeProps) {
  const { t } = useSprache();
  const ranks = talentRanks(specs);
  const total = specs.reduce((sum, s) => sum + s.spentPoints, 0);
  const pointsOf = (specId: number) => specs.find((s) => s.specId === specId)?.spentPoints ?? 0;

  return (
    <div className="talents">
      <div className="talents-summary">
        <p className="talents-total">
          {t(T.pointsSpent)} {total}
        </p>
        {total === 0 && <p className="muted">{t(T.noPoints)}</p>}
      </div>
      <div className="talent-trees">
        {view.layout.specs.map((spec) => (
          <SpecTree
            key={spec.specId}
            spec={spec}
            rows={view.layout.rows}
            points={pointsOf(spec.specId)}
            ranks={ranks}
            icons={view.icons}
          />
        ))}
      </div>
    </div>
  );
}
