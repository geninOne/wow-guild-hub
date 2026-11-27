import { useState, type CSSProperties, type ReactNode } from "react";
import type { InstancesView, KillRef, LevelRange } from "../../../src/api/types";
import { formatDate, formatDayMonth } from "../lib/format";
import { translationIn, useLanguage, type Translations, type Language } from "../lib/language";

const T = {
  defeatedTimes: {
    de: (boss: string, n: number) => `${boss} ${n} Mal besiegt`,
    en: (boss: string, n: number) => `${boss} defeated ${n} times`,
    schwaebisch: (boss: string, n: number) => `${boss} ${n} Mol bsiegt`,
    bayrisch: (boss: string, n: number) => `${boss} ${n} Moi bsiegt`,
  },
  defeated: {
    de: (boss: string) => `${boss} besiegt`,
    en: (boss: string) => `${boss} defeated`,
    schwaebisch: (boss: string) => `${boss} bsiegt`,
    bayrisch: (boss: string) => `${boss} bsiegt`,
  },
  last: { de: "zuletzt", en: "last", schwaebisch: "zletscht", bayrisch: "zletzt" },
  level: { de: "Stufe", en: "Level", schwaebisch: "Stufe", bayrisch: "Stufn" },
  to: { de: "bis", en: "to", schwaebisch: "bis", bayrisch: "bis" },
  completed: { de: "Abgeschlossen", en: "Completed", schwaebisch: "Gschafft", bayrisch: "Gschafft" },
  on: { de: "am", en: "on", schwaebisch: "am", bayrisch: "am" },
  times: { de: "Mal", en: "times", schwaebisch: "Mol", bayrisch: "Moi" },
  onAccount: { de: "Auf diesem Account", en: "On this account", schwaebisch: "Uff dem Account", bayrisch: "Auf dem Account" },
  onAccountTitle: {
    de: "Blizzard meldet diesen Abschluss nur für den ganzen Account. Die Statistik dieses Charakters enthält keinen Sieg über den Endboss.",
    en: "Blizzard reports this completion for the whole account only. This character's statistics show no kill of the final boss.",
    schwaebisch: "Blizzard meldet den Abschluss bloß fürs ganze Account. En dr Statistik von dem Charakter stoht koi Sieg übern Endboss.",
    bayrisch: "Blizzard meldt den Abschluss nur fürs ganze Account. In da Statistik vo dem Charakter steht koa Sieg übern Endboss.",
  },
  onAccountUntracked: {
    de: "Blizzard meldet diesen Abschluss nur für den ganzen Account und führt den Endboss dieses Dungeons nicht in der Statistik. Ob dieser Charakter ihn geschafft hat, ist deshalb nicht bekannt.",
    en: "Blizzard reports this completion for the whole account only and does not track this dungeon's final boss in the statistics, so it is unknown whether this character cleared it.",
    schwaebisch: "Blizzard meldet den Abschluss bloß fürs ganze Account ond führt den Endboss vo dem Dungeon net en dr Statistik. Ob der Charakter den gschafft hot, woiß mr deshalb net.",
    bayrisch: "Blizzard meldt den Abschluss nur fürs ganze Account und führt an Endboss vo dem Dungeon ned in da Statistik. Ob da Charakter eam gschafft hod, woaß ma deshoib ned.",
  },
  notVisited: { de: "Noch nicht besucht", en: "Not visited yet", schwaebisch: "No net bsuacht", bayrisch: "No ned bsuacht" },
  bosses: { de: "Bosse", en: "Bosses", schwaebisch: "Bosse", bayrisch: "Bosse" },
  bossesOf: {
    de: (n: number, total: number) => `${n} von ${total} Bossen`,
    en: (n: number, total: number) => `${n} of ${total} bosses`,
    schwaebisch: (n: number, total: number) => `${n} vo ${total} Bosse`,
    bayrisch: (n: number, total: number) => `${n} vo ${total} Bossn`,
  },
  unavailable: {
    de: "Dungeon- und Raiddaten werden gerade zusammengetragen. Schau bald wieder vorbei.",
    en: "Dungeon and raid data is being gathered right now. Check back soon.",
    schwaebisch: "Dungeon- ond Raiddaten werdet grad zammatraga. Schau bald wieder vorbei, gell.",
    bayrisch: "Dungeon- und Raiddatn wern grad zammtragn. Schau boid wieder vorbei, gell.",
  },
  dungeons: { de: "Dungeons", en: "Dungeons", schwaebisch: "Dungeons", bayrisch: "Dungeons" },
  raids: { de: "Raids", en: "Raids", schwaebisch: "Raids", bayrisch: "Raids" },
  otherKills: { de: "Weitere Boss-Siege", en: "Other boss kills", schwaebisch: "No meh Boss-Siege", bayrisch: "Weitere Boss-Sieg" },
} satisfies Record<string, Translations | Translations<(...a: never[]) => string>>;

type Dungeon = InstancesView["dungeonTiers"][number]["dungeons"][number];
type Raid = InstancesView["raids"][number];

/**
 * State of a card: completed (with date and count if known), started, done only on the account
 * (account-wide achievement without an own kill) or open.
 */
type CardStatus =
  | { kind: "done"; at: string | null; times: number }
  | { kind: "started"; defeated: number; total: number }
  | { kind: "account"; tracked: boolean }
  | { kind: "open" };

function killText(k: KillRef, language: Language): string {
  const when = k.lastAt ? formatDate(k.lastAt) : null;
  if (k.quantity > 1) {
    return `${translationIn(T.defeatedTimes, language)(k.boss, k.quantity)}${when ? ` (${translationIn(T.last, language)} ${when})` : ""}`;
  }
  return `${translationIn(T.defeated, language)(k.boss)}${when ? ` (${when})` : ""}`;
}

function levelText(levels: LevelRange | null, language: Language): string | null {
  if (!levels) return null;
  const label = translationIn(T.level, language);
  return levels.min === levels.max ? `${label} ${levels.min}` : `${label} ${levels.min} ${translationIn(T.to, language)} ${levels.max}`;
}

/** Calm tones for places without an image, matching the crest palette (gold, Horde, Alliance, verdigris, arcane). */
const ART_TINTS = ["242 201 90", "224 57 63", "47 106 224", "92 168 140", "160 112 224"];

function tintOf(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0;
  return ART_TINTS[hash % ART_TINTS.length];
}

/** Background image or, if Blizzard has none, an own background with a diamond grid and a glow. */
function CardArt({ image, name }: { image: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (image && !failed) {
    return <img className="instance-card-img" src={image} alt="" loading="lazy" onError={() => setFailed(true)} />;
  }
  return <div className="instance-card-art" aria-hidden="true" style={{ "--art-tint": tintOf(name) } as CSSProperties} />;
}

/** Fixed spot at the top right: a golden pennant when completed, otherwise a small, calm note. */
function StatusMark({ status }: { status: CardStatus }) {
  const { t } = useLanguage();
  if (status.kind === "done") {
    const title = [
      t(T.completed),
      status.at ? ` ${t(T.on)} ${formatDate(status.at)}` : "",
      status.times > 1 ? `, ${status.times} ${t(T.times)}` : "",
    ].join("");
    return (
      <p className="instance-pennant" title={title}>
        <span className="instance-pennant-star" aria-hidden="true">
          ✦
        </span>
        <span className="instance-pennant-label">{t(T.completed)}</span>
        {status.at && <span className="instance-pennant-date"> {formatDayMonth(status.at)}</span>}
        {status.times > 1 && <span className="instance-pennant-count"> {status.times}×</span>}
      </p>
    );
  }
  if (status.kind === "started") {
    return <p className="instance-card-note instance-card-note-started">{t(T.bossesOf)(status.defeated, status.total)}</p>;
  }
  if (status.kind === "account") {
    return (
      <p className="instance-card-note instance-card-note-account" title={t(status.tracked ? T.onAccountTitle : T.onAccountUntracked)}>
        {t(T.onAccount)}
      </p>
    );
  }
  return <p className="instance-card-note">{t(T.notVisited)}</p>;
}

/** Image card: name and level at the top left, status fixed at the top right, bosses at the bottom. */
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
  const { language } = useLanguage();
  const level = levelText(levels, language);
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
  return d.onAccount ? { kind: "account", tracked: d.tracked } : { kind: "open" };
}

/** Dungeon card: bosses for information only, the final boss subtly highlighted. */
function DungeonCard({ dungeon: d }: { dungeon: Dungeon }) {
  const { t } = useLanguage();
  const finals = new Set(d.finalBosses);
  return (
    <InstanceCard name={d.name} image={d.image} levels={d.levels} status={dungeonStatus(d)} className="instance-card-dungeon">
      {d.bosses && (
        <p className="instance-card-bosses">
          {t(T.bosses)}:{" "}
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
  return raid.onAccount ? { kind: "account", tracked: true } : { kind: "open" };
}

function bossText(b: Raid["bosses"][number]): string {
  if (!b.defeated) return b.name;
  return `✔ ${b.name}${b.lastAt ? ` (${formatDate(b.lastAt)})` : ""}`;
}

/** Raid card: bosses as chips, defeated ones green; no chips for single-boss raids like Onyxia. */
function RaidCard({ raid }: { raid: Raid }) {
  const { t } = useLanguage();
  const single = raid.bosses.length === 1 && raid.bosses[0].name === raid.name;
  return (
    <InstanceCard name={raid.name} image={raid.image} levels={raid.levels} status={raidStatus(raid)} className="instance-card-raid">
      {!single && (
        <ul className="instance-bosses" aria-label={t(T.bosses)}>
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

/** All dungeons in one list, by level range; those without a maintained level at the end in achievement order. */
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

/** A character's "Dungeons & Raids" as image cards: only its own progress, no comparison. */

export function InstancesPanel({ view }: { view: InstancesView }) {
  const { t, language } = useLanguage();
  if (!view.available) {
    return (
      <div className="state state-empty">
        <p>{t(T.unavailable)}</p>
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
            <h3 className="instance-others-title">{t(T.otherKills)}</h3>
            <ul className="instance-list">
              {view.otherKills.map((k, i) => (
                <li key={i} className="instance-row small">
                  ✔ {killText({ ...k, boss: k.instance ? `${k.boss} (${k.instance})` : k.boss }, language)}
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
