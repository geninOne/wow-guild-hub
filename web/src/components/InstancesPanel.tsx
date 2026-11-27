import { useState, type CSSProperties, type ReactNode } from "react";
import type { InstancesView, KillRef, LevelRange } from "../../../src/api/types";
import { formatDate, formatDayMonth } from "../lib/format";
import { fassungIn, useSprache, type Fassungen, type Sprache } from "../lib/sprache";

const T = {
  malBesiegt: {
    de: (boss: string, n: number) => `${boss} ${n} Mal besiegt`,
    en: (boss: string, n: number) => `${boss} defeated ${n} times`,
    schwaebisch: (boss: string, n: number) => `${boss} ${n} Mol bsiegt`,
    bayrisch: (boss: string, n: number) => `${boss} ${n} Moi bsiegt`,
  },
  besiegt: {
    de: (boss: string) => `${boss} besiegt`,
    en: (boss: string) => `${boss} defeated`,
    schwaebisch: (boss: string) => `${boss} bsiegt`,
    bayrisch: (boss: string) => `${boss} bsiegt`,
  },
  zuletzt: { de: "zuletzt", en: "last", schwaebisch: "zletscht", bayrisch: "zletzt" },
  stufe: { de: "Stufe", en: "Level", schwaebisch: "Stufe", bayrisch: "Stufn" },
  bis: { de: "bis", en: "to", schwaebisch: "bis", bayrisch: "bis" },
  abgeschlossen: { de: "Abgeschlossen", en: "Completed", schwaebisch: "Gschafft", bayrisch: "Gschafft" },
  am: { de: "am", en: "on", schwaebisch: "am", bayrisch: "am" },
  mal: { de: "Mal", en: "times", schwaebisch: "Mol", bayrisch: "Moi" },
  aufAccount: { de: "Auf diesem Account", en: "On this account", schwaebisch: "Uff dem Account", bayrisch: "Auf dem Account" },
  aufAccountTitel: {
    de: "Blizzard meldet diesen Abschluss nur für den ganzen Account. Die Statistik dieses Charakters enthält keinen Sieg über den Endboss.",
    en: "Blizzard reports this completion for the whole account only. This character's statistics show no kill of the final boss.",
    schwaebisch: "Blizzard meldet den Abschluss bloß fürs ganze Account. En dr Statistik von dem Charakter stoht koi Sieg übern Endboss.",
    bayrisch: "Blizzard meldt den Abschluss nur fürs ganze Account. In da Statistik vo dem Charakter steht koa Sieg übern Endboss.",
  },
  nichtBesucht: { de: "Noch nicht besucht", en: "Not visited yet", schwaebisch: "No net bsuacht", bayrisch: "No ned bsuacht" },
  bosse: { de: "Bosse", en: "Bosses", schwaebisch: "Bosse", bayrisch: "Bosse" },
  vonBossen: {
    de: (n: number, alle: number) => `${n} von ${alle} Bossen`,
    en: (n: number, alle: number) => `${n} of ${alle} bosses`,
    schwaebisch: (n: number, alle: number) => `${n} vo ${alle} Bosse`,
    bayrisch: (n: number, alle: number) => `${n} vo ${alle} Bossn`,
  },
  nichtVerfuegbar: {
    de: "Dungeon- und Raiddaten werden gerade zusammengetragen. Schau bald wieder vorbei.",
    en: "Dungeon and raid data is being gathered right now. Check back soon.",
    schwaebisch: "Dungeon- ond Raiddaten werdet grad zammatraga. Schau bald wieder vorbei, gell.",
    bayrisch: "Dungeon- und Raiddatn wern grad zammtragn. Schau boid wieder vorbei, gell.",
  },
  dungeons: { de: "Dungeons", en: "Dungeons", schwaebisch: "Dungeons", bayrisch: "Dungeons" },
  raids: { de: "Raids", en: "Raids", schwaebisch: "Raids", bayrisch: "Raids" },
  weitereSiege: { de: "Weitere Boss-Siege", en: "Other boss kills", schwaebisch: "No meh Boss-Siege", bayrisch: "Weitere Boss-Sieg" },
} satisfies Record<string, Fassungen | Fassungen<(...a: never[]) => string>>;

type Dungeon = InstancesView["dungeonTiers"][number]["dungeons"][number];
type Raid = InstancesView["raids"][number];

/**
 * Zustand einer Karte: abgeschlossen (mit Datum und Anzahl, falls bekannt), begonnen, nur auf dem Account erledigt
 * (accountweiter Erfolg ohne eigenen Sieg) oder offen.
 */
type CardStatus =
  | { kind: "done"; at: string | null; times: number }
  | { kind: "started"; defeated: number; total: number }
  | { kind: "account" }
  | { kind: "open" };

function killText(k: KillRef, sprache: Sprache): string {
  const when = k.lastAt ? formatDate(k.lastAt) : null;
  if (k.quantity > 1) {
    return `${fassungIn(T.malBesiegt, sprache)(k.boss, k.quantity)}${when ? ` (${fassungIn(T.zuletzt, sprache)} ${when})` : ""}`;
  }
  return `${fassungIn(T.besiegt, sprache)(k.boss)}${when ? ` (${when})` : ""}`;
}

function levelText(levels: LevelRange | null, sprache: Sprache): string | null {
  if (!levels) return null;
  const stufe = fassungIn(T.stufe, sprache);
  return levels.min === levels.max ? `${stufe} ${levels.min}` : `${stufe} ${levels.min} ${fassungIn(T.bis, sprache)} ${levels.max}`;
}

/** Ruhige Grundtöne für Orte ohne Bild, passend zur Wappen-Palette (Gold, Horde, Allianz, Grünspan, Arkan). */
const ART_TINTS = ["242 201 90", "224 57 63", "47 106 224", "92 168 140", "160 112 224"];

function tintOf(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0;
  return ART_TINTS[hash % ART_TINTS.length];
}

/** Hintergrundbild oder, wenn Blizzard keins hat, ein eigener Hintergrund mit Rautengitter und Lichtschein. */
function CardArt({ image, name }: { image: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (image && !failed) {
    return <img className="instance-card-img" src={image} alt="" loading="lazy" onError={() => setFailed(true)} />;
  }
  return <div className="instance-card-art" aria-hidden="true" style={{ "--art-tint": tintOf(name) } as CSSProperties} />;
}

/** Fester Platz oben rechts: goldener Wimpel bei Abschluss, sonst ein kleiner, ruhiger Hinweis. */
function StatusMark({ status }: { status: CardStatus }) {
  const { t } = useSprache();
  if (status.kind === "done") {
    const title = [
      t(T.abgeschlossen),
      status.at ? ` ${t(T.am)} ${formatDate(status.at)}` : "",
      status.times > 1 ? `, ${status.times} ${t(T.mal)}` : "",
    ].join("");
    return (
      <p className="instance-pennant" title={title}>
        <span className="instance-pennant-star" aria-hidden="true">
          ✦
        </span>
        <span className="instance-pennant-label">{t(T.abgeschlossen)}</span>
        {status.at && <span className="instance-pennant-date"> {formatDayMonth(status.at)}</span>}
        {status.times > 1 && <span className="instance-pennant-count"> {status.times}×</span>}
      </p>
    );
  }
  if (status.kind === "started") {
    return <p className="instance-card-note instance-card-note-started">{t(T.vonBossen)(status.defeated, status.total)}</p>;
  }
  if (status.kind === "account") {
    return (
      <p className="instance-card-note instance-card-note-account" title={t(T.aufAccountTitel)}>
        {t(T.aufAccount)}
      </p>
    );
  }
  return <p className="instance-card-note">{t(T.nichtBesucht)}</p>;
}

/** Bildkarte: Name und Stufe oben links, Status fest oben rechts, Bosse unten. */
function InstanceCard({
  name,
  image,
  levels,
  status,
  className,
  children,
}: {
  name: string;
  image: string | null;
  levels: LevelRange | null;
  status: CardStatus;
  className?: string;
  children?: ReactNode;
}) {
  const { sprache } = useSprache();
  const level = levelText(levels, sprache);
  return (
    <li className={["instance-card", `instance-card-${status.kind}`, className].filter(Boolean).join(" ")}>
      <CardArt image={image} name={name} />
      <div className="instance-card-shade" aria-hidden="true" />
      <div className="instance-card-content">
        <div className="instance-card-head">
          <StatusMark status={status} />
          <h4 className="instance-card-name">{name}</h4>
          {level && <p className="instance-card-level">{level}</p>}
        </div>
        {children}
      </div>
    </li>
  );
}

function dungeonStatus(d: Dungeon): CardStatus {
  if (d.completed) return { kind: "done", at: d.completedAt, times: d.timesCompleted };
  return d.onAccount ? { kind: "account" } : { kind: "open" };
}

/** Dungeon-Karte: Bosse nur als Info, der Endboss dezent hervorgehoben. */
function DungeonCard({ dungeon: d }: { dungeon: Dungeon }) {
  const { t } = useSprache();
  const finals = new Set(d.finalBosses);
  return (
    <InstanceCard name={d.name} image={d.image} levels={d.levels} status={dungeonStatus(d)} className="instance-card-dungeon">
      {d.bosses && (
        <p className="instance-card-bosses">
          {t(T.bosse)}:{" "}
          {d.bosses.map((b, i) => (
            <span key={b}>
              {i > 0 && ", "}
              {finals.has(b) ? <strong className="instance-final-boss">{b}</strong> : b}
            </span>
          ))}
        </p>
      )}
    </InstanceCard>
  );
}

function raidStatus(raid: Raid): CardStatus {
  const defeated = raid.bosses.filter((b) => b.defeated);
  if (raid.completed || (defeated.length > 0 && defeated.length === raid.bosses.length)) {
    const dates = defeated.map((b) => b.lastAt).filter((d): d is string => d !== null).sort();
    return { kind: "done", at: dates.at(-1) ?? null, times: 0 };
  }
  if (defeated.length > 0) return { kind: "started", defeated: defeated.length, total: raid.bosses.length };
  return raid.onAccount ? { kind: "account" } : { kind: "open" };
}

function bossText(b: Raid["bosses"][number]): string {
  if (!b.defeated) return b.name;
  return `✔ ${b.name}${b.lastAt ? ` (${formatDate(b.lastAt)})` : ""}`;
}

/** Raid-Karte: Bosse als Chips, besiegte grün; bei Einzelboss-Raids wie Onyxia keine Chips. */
function RaidCard({ raid }: { raid: Raid }) {
  const { t } = useSprache();
  const single = raid.bosses.length === 1 && raid.bosses[0].name === raid.name;
  return (
    <InstanceCard name={raid.name} image={raid.image} levels={raid.levels} status={raidStatus(raid)} className="instance-card-raid">
      {!single && (
        <ul className="instance-bosses" aria-label={t(T.bosse)}>
          {raid.bosses.map((b) => (
            <li key={b.name} className={b.defeated ? "instance-boss instance-boss-defeated" : "instance-boss"}>
              {bossText(b)}
            </li>
          ))}
        </ul>
      )}
    </InstanceCard>
  );
}

/** Alle Dungeons in einer Liste, nach Levelbereich; ohne gepflegte Stufe am Ende in der Reihenfolge der Erfolge. */
function sortedDungeons(view: InstancesView): Dungeon[] {
  const all = view.dungeonTiers.flatMap((t) => t.dungeons);
  return all
    .map((d, i) => ({ d, i }))
    .sort((a, b) => {
      const x = a.d.levels;
      const y = b.d.levels;
      if (x && y) return x.min - y.min || x.max - y.max || a.i - b.i;
      if (x) return -1;
      if (y) return 1;
      return a.i - b.i;
    })
    .map(({ d }) => d);
}

/** "Dungeons & Raids" eines Charakters als Bildkarten: nur eigener Fortschritt, kein Vergleich. */
export function InstancesPanel({ view }: { view: InstancesView }) {
  const { t, sprache } = useSprache();
  if (!view.available) {
    return (
      <div className="state state-empty">
        <p>{t(T.nichtVerfuegbar)}</p>
      </div>
    );
  }
  return (
    <div className="instances">
      <section className="instance-section" aria-labelledby="instanzen-dungeons">
        <h2 className="instance-section-title" id="instanzen-dungeons">
          {t(T.dungeons)}
        </h2>
        <ul className="instance-cards">
          {sortedDungeons(view).map((d) => (
            <DungeonCard key={d.criterionId} dungeon={d} />
          ))}
        </ul>
        {view.otherKills.length > 0 && (
          <div className="instance-others">
            <h3 className="instance-others-title">{t(T.weitereSiege)}</h3>
            <ul className="instance-list">
              {view.otherKills.map((k, i) => (
                <li key={i} className="instance-row small">
                  ✔ {killText({ ...k, boss: k.instance ? `${k.boss} (${k.instance})` : k.boss }, sprache)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      {view.raids.length > 0 && (
        <section className="instance-section" aria-labelledby="instanzen-raids">
          <h2 className="instance-section-title" id="instanzen-raids">
            {t(T.raids)}
          </h2>
          <ul className="instance-cards instance-cards-raids">
            {view.raids.map((raid) => (
              <RaidCard key={raid.achievementId} raid={raid} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
