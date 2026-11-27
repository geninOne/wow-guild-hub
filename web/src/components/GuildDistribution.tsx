import { useCallback, useMemo, useState } from "react";
import type { GuildView } from "../../../src/api/types";
import { useApi } from "../lib/api";
import {
  crossFilter,
  EMPTY_SELECTION,
  isEmptySelection,
  keepSelected,
  matchesSelection,
  memberFigures,
  toggleSelection,
  type Axis,
  type Selection,
} from "../lib/crossfilter";
import { formatDateTime } from "../lib/format";
import { classDistribution, LEVEL_BANDS, levelDistribution } from "../lib/members";
import { useLanguage, type Translations } from "../lib/language";
import { classColor } from "../lib/wow";
import { ClassName } from "./ClassName";
import { DataState } from "./DataState";
import { FigureTile } from "./FigureTile";
import { GuildFilter } from "./GuildFilter";
import { bandLabel, fullLabel, LEVEL_TO, LevelColumns } from "./LevelColumns";
import { useMemberList } from "./MemberList";
import { RacePie } from "./RacePie";
import { SelectionBar } from "./SelectionBar";

const T = {
  active: { de: "Aktive Mitglieder", en: "Active Members", schwaebisch: "Aktive Mitglieder", bayrisch: "Aktive Mitglieder" },
  asOf: { de: "Stand", en: "As of", schwaebisch: "Stand", bayrisch: "Stand" },
  members: { de: "Mitglieder", en: "Members", schwaebisch: "Mitglieder", bayrisch: "Mitglieder" },
  level60: { de: "Auf Level 60", en: "At Level 60", schwaebisch: "Auf Level 60", bayrisch: "Auf Level 60" },
  classDistribution: { de: "Klassenverteilung", en: "Class Distribution", schwaebisch: "Klasseverteilung", bayrisch: "Klassnverteilung" },
  classSaying: {
    de: "Wer schwingt was? Ein Klick auf eine Klasse filtert Level und Völker.",
    en: "Who wields what? Click a class to filter levels and races.",
    schwaebisch: "Wer schwingt was? Klick auf a Klass, no siehsch ihre Level ond Völker.",
    bayrisch: "Wer schwingt wos? Klick auf a Klass, nacha siagst eana Level und Völker.",
  },
  levelDistribution: { de: "Levelverteilung", en: "Level Distribution", schwaebisch: "Levelverteilung", bayrisch: "Levelverteilung" },
  levelSaying: {
    de: "Vom Frischling bis zur Sechzig. Ein Klick auf eine Säule filtert Klassen und Völker.",
    en: "From fresh recruit to sixty. Click a column to filter classes and races.",
    schwaebisch: "Vom Frischling bis zur Sechzge. Klick auf a Säule, no siehsch d'Klasse ond Völker drzua.",
    bayrisch: "Vom Frischling bis zur Sechzg. Klick auf a Säuln, nacha siagst de Klassn und Völker dazua.",
  },
  peak60: {
    de: "Die meisten stehen schon auf der Sechzig. Respekt vor so viel Sitzfleisch.",
    en: "Most are already at sixty. Respect for that kind of stamina.",
    schwaebisch: "D'meischte send scho auf Sechzge. Respekt vor so viel Sitzfleisch.",
    bayrisch: "De meistn san scho auf Sechzg. Respekt vor so vui Sitzfleisch.",
  },
} satisfies Record<string, Translations>;

const PEAK: Translations<(range: string) => string> = {
  de: (range) => `Die meisten tummeln sich bei ${range}. Weiterleveln, die Sechzig wartet!`,
  en: (range) => `Most are hanging out at ${range}. Keep leveling, sixty awaits!`,
  schwaebisch: (range) => `D'meischte hocket bei ${range}. Weiterlevla, d'Sechzge wartet!`,
  bayrisch: (range) => `De meistn hocka bei ${range}. Weiterlevln, de Sechzg wart scho!`,
};

const EMPTY_CLASSES: Translations = {
  de: "Hier schwingt keiner was. Diese Mischung gibt es noch nicht.",
  en: "Nobody wields anything here. This combination does not exist yet.",
  schwaebisch: "Do schwingt koiner ebbes. Die Mischung gibt's no net.",
  bayrisch: "Do schwingt koana wos. De Mischung gibt's no ned.",
};

const EMPTY_LEVELS: Translations = {
  de: "Leere Säulen. Für diese Auswahl hat noch niemand gelevelt.",
  en: "Empty columns. Nobody has leveled for this selection yet.",
  schwaebisch: "Leere Säule. Für die Auswahl hot no koiner glevelt.",
  bayrisch: "Laare Säuln. Für de Auswahl hod no koana glevelt.",
};

/** Note in a chart's header saying which selections of the other charts filter it. */
const ONLY: Translations<(parts: string) => string> = {
  de: (parts) => `Nur ${parts}.`,
  en: (parts) => `Only ${parts}.`,
  schwaebisch: (parts) => `Bloß ${parts}.`,
  bayrisch: (parts) => `Bloß ${parts}.`,
};

const PER_CLASS: Translations = { de: "Mitglieder je Klasse", en: "Members per class" };

/** Label of a level range: "10 bis 19" or "Level 60". */
function bandName(bandIndex: number, toWord: string): string {
  return bandLabel(LEVEL_BANDS[bandIndex], toWord);
}

function DistributionContent({ guild }: { guild: GuildView }) {
  const { t } = useLanguage();
  const [guildSlug, setGuildSlug] = useState<string | null>(null);
  // Shared selection of race, class and level range for the crossfilter.
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION);
  const toggle = (axis: Axis, value: number | null) => setSelection((s) => toggleSelection(s, axis, value));

  // Names for race and class from all members, even if the selection currently filters them out.
  const names = useMemo(() => {
    const races = new Map<number, string>();
    const classes = new Map<number, string>();
    for (const m of guild.members) {
      races.set(m.raceId, m.raceName);
      classes.set(m.classId, m.className);
    }
    return { races, classes };
  }, [guild.members]);
  const raceName = useCallback((id: number) => names.races.get(id) ?? null, [names]);

  const inGuild = useMemo(
    () => guild.members.filter((m) => guildSlug === null || m.guildSlug === guildSlug),
    [guild.members, guildSlug],
  );
  const filtered = useMemo(() => crossFilter(inGuild, selection), [inGuild, selection]);
  const classes = useMemo(
    () =>
      keepSelected(classDistribution(filtered.forClasses), selection.classId, (d) => d.classId, (id) => {
        const className = names.classes.get(id);
        return className === undefined ? null : { classId: id, className, count: 0 };
      }),
    [filtered.forClasses, selection.classId, names],
  );
  const levels = useMemo(() => levelDistribution(filtered.forLevels), [filtered.forLevels]);
  const figures = memberFigures(filtered.selected);
  const maxClass = Math.max(1, ...classes.map((d) => d.count));
  // Highest column; on a tie the higher range.
  const peak = levels.reduce<(typeof levels)[number] | null>((best, d) => (d.count > 0 && d.count >= (best?.count ?? 0) ? d : best), null);

  const parts = {
    race: selection.raceId === null ? null : (names.races.get(selection.raceId) ?? null),
    class: selection.classId === null ? null : (names.classes.get(selection.classId) ?? null),
    level: selection.bandIndex === null ? null : bandName(selection.bandIndex, t(LEVEL_TO)),
  };
  /** Note for one axis' chart from the selections of the other two; null without a filter. */
  const note = (skip: Axis): string | null => {
    const others = (["race", "class", "level"] as const).filter((a) => a !== skip).map((a) => parts[a]).filter((p) => p !== null);
    return others.length === 0 ? null : t(ONLY)(others.join(" · "));
  };
  const pickedClass = classes.find((d) => d.classId === selection.classId) ?? null;

  // Lists contain all guilds (filtered by the selection); the switcher in the dialog starts with the choice made here.
  const list = useMemberList(guildSlug, guild);
  const filteredTitle = (label: string) => {
    const chosen = [parts.race, parts.class, parts.level].filter((p) => p !== null);
    return chosen.length === 0 ? label : `${label}: ${chosen.join(" · ")}`;
  };
  const openList = (label: string, minLevel: number) => {
    const title = filteredTitle(label);
    const entries = guild.members.filter((m) => !m.former && m.level >= minLevel && matchesSelection(m, selection)).map((m) => m.id);
    list.open({ title, sets: [{ key: "all", label: title, valueLabel: null, entries }] });
  };

  return (
    <>
      <p className="page-subtitle muted">
        {t(T.active)} · {t(T.asOf)}: {formatDateTime(guild.fetchedAt)}
      </p>
      <div className="dist-top">
        <div className="dist-guild">
          <GuildFilter guilds={guild.guilds} value={guildSlug} onChange={setGuildSlug} />
        </div>
        <SelectionBar
          race={parts.race}
          classId={selection.classId}
          classLabel={parts.class}
          level={parts.level}
          onRemove={(axis) => toggle(axis, null)}
          onReset={() => setSelection(EMPTY_SELECTION)}
        />
        <FigureTile
          filtered={!isEmptySelection(selection)}
          figures={figures}
          onMembers={figures.members > 0 ? () => openList(t(T.members), 1) : undefined}
          onCapped={figures.capped > 0 ? () => openList(t(T.level60), 60) : undefined}
        />
      </div>

      <div className="stats-columns dist-grid">
        <div className="panel dist-class">
          <header className="panel-header stat-theme-header">
            <h2 className="panel-title">{t(T.classDistribution)}</h2>
            <p className="stat-theme-blurb">{note("class") ?? t(T.classSaying)}</p>
          </header>
          {filtered.forClasses.length === 0 && (
            <p className="state state-empty dist-empty" role="status">
              {t(EMPTY_CLASSES)}
            </p>
          )}
          <ul className="class-bars" aria-label={t(PER_CLASS)} data-picked={pickedClass ? "" : undefined}>
            {classes.map((d) => (
              <li key={d.classId}>
                <button
                  type="button"
                  className="class-bar class-bar-pick"
                  aria-pressed={d.classId === selection.classId}
                  onClick={() => toggle("class", d.classId)}
                >
                  <span className="class-bar-label">
                    <ClassName classId={d.classId} name={d.className} />
                  </span>
                  <span className="class-bar-track">
                    <span
                      className="class-bar-fill"
                      style={{ width: `${(d.count / maxClass) * 100}%`, background: classColor(d.classId) }}
                    />
                  </span>
                  <span className="num class-bar-count">{d.count}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel dist-level">
          <header className="panel-header stat-theme-header">
            <h2 className="panel-title">{t(T.levelDistribution)}</h2>
            <p className="stat-theme-blurb">{note("level") ?? t(T.levelSaying)}</p>
          </header>
          <p className="level-top" aria-live="polite">
            {peak ? (peak.from === 60 ? t(T.peak60) : t(PEAK)(fullLabel(peak, t(LEVEL_TO)))) : t(EMPTY_LEVELS)}
          </p>
          <LevelColumns
            columns={levels}
            selected={selection.bandIndex}
            onSelect={(i) => toggle("level", i)}
            color={pickedClass ? classColor(pickedClass.classId) : undefined}
          />
        </div>

        <RacePie
          members={filtered.forRaces}
          raceId={selection.raceId}
          onRace={(id) => toggle("race", id)}
          raceName={raceName}
          note={note("race")}
        />
      </div>
      {list.dialog}
    </>
  );
}

/** General tab of the stats page: class, level and race distribution of the active members. */
export function GuildDistribution() {
  const { data, error, loading } = useApi<GuildView>("/api/guild");
  return (
    <DataState loading={loading} error={error}>
      {data && <DistributionContent guild={data} />}
    </DataState>
  );
}
