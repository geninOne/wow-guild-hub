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
import { useSprache, type Fassungen } from "../lib/sprache";
import { classColor } from "../lib/wow";
import { ClassName } from "./ClassName";
import { DataState } from "./DataState";
import { FigureTile } from "./FigureTile";
import { GuildFilter } from "./GuildFilter";
import { bandLabel, fullLabel, LEVEL_BIS, LevelColumns } from "./LevelColumns";
import { useMemberList } from "./MemberList";
import { RacePie } from "./RacePie";
import { SelectionBar } from "./SelectionBar";

const T = {
  aktive: { de: "Aktive Mitglieder", en: "Active Members", schwaebisch: "Aktive Mitglieder", bayrisch: "Aktive Mitglieder" },
  stand: { de: "Stand", en: "As of", schwaebisch: "Stand", bayrisch: "Stand" },
  mitglieder: { de: "Mitglieder", en: "Members", schwaebisch: "Mitglieder", bayrisch: "Mitglieder" },
  level60: { de: "Auf Level 60", en: "At Level 60", schwaebisch: "Auf Level 60", bayrisch: "Auf Level 60" },
  klassenverteilung: { de: "Klassenverteilung", en: "Class Distribution", schwaebisch: "Klasseverteilung", bayrisch: "Klassnverteilung" },
  klassenSpruch: {
    de: "Wer schwingt was? Ein Klick auf eine Klasse filtert Level und Völker.",
    en: "Who wields what? Click a class to filter levels and races.",
    schwaebisch: "Wer schwingt was? Klick auf a Klass, no siehsch ihre Level ond Völker.",
    bayrisch: "Wer schwingt wos? Klick auf a Klass, nacha siagst eana Level und Völker.",
  },
  levelverteilung: { de: "Levelverteilung", en: "Level Distribution", schwaebisch: "Levelverteilung", bayrisch: "Levelverteilung" },
  levelSpruch: {
    de: "Vom Frischling bis zur Sechzig. Ein Klick auf eine Säule filtert Klassen und Völker.",
    en: "From fresh recruit to sixty. Click a column to filter classes and races.",
    schwaebisch: "Vom Frischling bis zur Sechzge. Klick auf a Säule, no siehsch d'Klasse ond Völker drzua.",
    bayrisch: "Vom Frischling bis zur Sechzg. Klick auf a Säuln, nacha siagst de Klassn und Völker dazua.",
  },
  gipfel60: {
    de: "Die meisten stehen schon auf der Sechzig. Respekt vor so viel Sitzfleisch.",
    en: "Most are already at sixty. Respect for that kind of stamina.",
    schwaebisch: "D'meischte send scho auf Sechzge. Respekt vor so viel Sitzfleisch.",
    bayrisch: "De meistn san scho auf Sechzg. Respekt vor so vui Sitzfleisch.",
  },
} satisfies Record<string, Fassungen>;

const GIPFEL: Fassungen<(stufe: string) => string> = {
  de: (stufe) => `Die meisten tummeln sich bei ${stufe}. Weiterleveln, die Sechzig wartet!`,
  en: (stufe) => `Most are hanging out at ${stufe}. Keep leveling, sixty awaits!`,
  schwaebisch: (stufe) => `D'meischte hocket bei ${stufe}. Weiterlevla, d'Sechzge wartet!`,
  bayrisch: (stufe) => `De meistn hocka bei ${stufe}. Weiterlevln, de Sechzg wart scho!`,
};

const LEER_KLASSEN: Fassungen = {
  de: "Hier schwingt keiner was. Diese Mischung gibt es noch nicht.",
  en: "Nobody wields anything here. This combination does not exist yet.",
  schwaebisch: "Do schwingt koiner ebbes. Die Mischung gibt's no net.",
  bayrisch: "Do schwingt koana wos. De Mischung gibt's no ned.",
};

const LEER_LEVEL: Fassungen = {
  de: "Leere Säulen. Für diese Auswahl hat noch niemand gelevelt.",
  en: "Empty columns. Nobody has leveled for this selection yet.",
  schwaebisch: "Leere Säule. Für die Auswahl hot no koiner glevelt.",
  bayrisch: "Laare Säuln. Für de Auswahl hod no koana glevelt.",
};

/** Hinweis im Kopf eines Diagramms, nach welchen Auswahlen der anderen es gefiltert ist. */
const NUR: Fassungen<(teile: string) => string> = {
  de: (teile) => `Nur ${teile}.`,
  en: (teile) => `Only ${teile}.`,
  schwaebisch: (teile) => `Bloß ${teile}.`,
  bayrisch: (teile) => `Bloß ${teile}.`,
};

const JE_KLASSE: Fassungen = { de: "Mitglieder je Klasse", en: "Members per class" };

/** Beschriftung einer Levelstufe: "10 bis 19" oder "Level 60". */
function bandName(bandIndex: number, bis: string): string {
  return bandLabel(LEVEL_BANDS[bandIndex], bis);
}

function DistributionContent({ guild }: { guild: GuildView }) {
  const { t } = useSprache();
  const [guildSlug, setGuildSlug] = useState<string | null>(null);
  // Gemeinsame Auswahl aus Volk, Klasse und Levelstufe für den Kreuzfilter.
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION);
  const toggle = (axis: Axis, value: number | null) => setSelection((s) => toggleSelection(s, axis, value));

  // Namen für Volk und Klasse aus allen Mitgliedern, auch wenn die Auswahl sie gerade herausfiltert.
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
  // Höchste Säule; bei Gleichstand die höhere Stufe.
  const peak = levels.reduce<(typeof levels)[number] | null>((best, d) => (d.count > 0 && d.count >= (best?.count ?? 0) ? d : best), null);

  const parts = {
    race: selection.raceId === null ? null : (names.races.get(selection.raceId) ?? null),
    class: selection.classId === null ? null : (names.classes.get(selection.classId) ?? null),
    level: selection.bandIndex === null ? null : bandName(selection.bandIndex, t(LEVEL_BIS)),
  };
  /** Hinweis für das Diagramm einer Achse aus den Auswahlen der beiden anderen; null ohne Filter. */
  const note = (skip: Axis): string | null => {
    const others = (["race", "class", "level"] as const).filter((a) => a !== skip).map((a) => parts[a]).filter((p) => p !== null);
    return others.length === 0 ? null : t(NUR)(others.join(" · "));
  };
  const pickedClass = classes.find((d) => d.classId === selection.classId) ?? null;

  // Listen enthalten alle Gilden (gefiltert nach der Auswahl); der Umschalter im Dialog startet mit der Wahl hier.
  const list = useMemberList(guildSlug, guild);
  const filteredTitle = (label: string) => {
    const chosen = [parts.race, parts.class, parts.level].filter((p) => p !== null);
    return chosen.length === 0 ? label : `${label}: ${chosen.join(" · ")}`;
  };
  const openList = (label: string, minLevel: number) => {
    const title = filteredTitle(label);
    const entries = guild.members.filter((m) => !m.former && m.level >= minLevel && matchesSelection(m, selection)).map((m) => m.id);
    list.open({ title, sets: [{ key: "alle", label: title, valueLabel: null, entries }] });
  };

  return (
    <>
      <p className="page-subtitle muted">
        {t(T.aktive)} · {t(T.stand)}: {formatDateTime(guild.fetchedAt)}
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
          onMembers={figures.members > 0 ? () => openList(t(T.mitglieder), 1) : undefined}
          onCapped={figures.capped > 0 ? () => openList(t(T.level60), 60) : undefined}
        />
      </div>

      <div className="stats-columns dist-grid">
        <div className="panel dist-class">
          <header className="panel-header stat-theme-header">
            <h2 className="panel-title">{t(T.klassenverteilung)}</h2>
            <p className="stat-theme-blurb">{note("class") ?? t(T.klassenSpruch)}</p>
          </header>
          {filtered.forClasses.length === 0 && (
            <p className="state state-empty dist-empty" role="status">
              {t(LEER_KLASSEN)}
            </p>
          )}
          <ul className="class-bars" aria-label={t(JE_KLASSE)} data-picked={pickedClass ? "" : undefined}>
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
            <h2 className="panel-title">{t(T.levelverteilung)}</h2>
            <p className="stat-theme-blurb">{note("level") ?? t(T.levelSpruch)}</p>
          </header>
          <p className="level-top" aria-live="polite">
            {peak ? (peak.from === 60 ? t(T.gipfel60) : t(GIPFEL)(fullLabel(peak, t(LEVEL_BIS)))) : t(LEER_LEVEL)}
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

/** Reiter Allgemein der Statistikseite: Klassen-, Level- und Völkerverteilung der aktiven Mitglieder. */
export function GuildDistribution() {
  const { data, error, loading } = useApi<GuildView>("/api/guild");
  return (
    <DataState loading={loading} error={error}>
      {data && <DistributionContent guild={data} />}
    </DataState>
  );
}
