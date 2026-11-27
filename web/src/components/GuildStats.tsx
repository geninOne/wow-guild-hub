import type { StatsPeriodKind, StatsView } from "../../../src/api/types";
import { useApi } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { formatPlainDate, formatPlainDayMonth, monthLabel, weekLabel } from "../lib/fun";
import { useSprache, type Fassungen, type Sprache } from "../lib/sprache";
import { DataState } from "./DataState";
import { GuildFilter } from "./GuildFilter";
import { StatWall, statsBase } from "./StatCards";

export const PERIODS: { id: StatsPeriodKind; label: Fassungen }[] = [
  { id: "woche", label: { de: "Woche", en: "Week", schwaebisch: "Woch", bayrisch: "Woch" } },
  { id: "monat", label: { de: "Monat", en: "Month", schwaebisch: "Monat", bayrisch: "Monat" } },
  { id: "gesamt", label: { de: "Gesamt", en: "All Time", schwaebisch: "Gsamt", bayrisch: "Gsamt" } },
];

const T = {
  allTime: { de: "Gesamt", en: "All Time", schwaebisch: "Gsamt", bayrisch: "Gsamt" },
  allTimeSince: {
    de: (date: string) => `Gesamt seit dem Serverstart am ${date}`,
    en: (date: string) => `All time since the server launch on ${date}`,
    schwaebisch: (date: string) => `Gsamt seit em Serverstart am ${date}`,
    bayrisch: (date: string) => `Gsamt seit'm Serverstart am ${date}`,
  },
  nothingYet: {
    de: "Noch nichts gesammelt. Der Sammler legt jede Woche einen Stand an, die ersten Zahlen erscheinen nach seinem nächsten Lauf.",
    en: "Nothing collected yet. The collector takes a snapshot every week; the first numbers appear after its next run.",
    schwaebisch:
      "Nix gsammelt bis jetzt. Dr Sammler legt jede Woch en Stand a, die erschte Zahle kommet nach seim nächschte Lauf.",
    bayrisch:
      "No nix gsammelt. Da Sammler legt jede Woch an Stand o, de erstn Zahln kemman nach seim nächstn Lauf.",
  },
  weekMissing: {
    de: "Nur Geduld: Für diese Woche fehlt noch der Stand der Vorwoche, deshalb gibt es hier noch keinen Wochenvergleich.",
    en: "Patience: the snapshot from the previous week is still missing, so there is no weekly comparison yet.",
    schwaebisch:
      "Gemach, gemach: Für die Woch fehlt no dr Stand vo dr Vorwoch, drom gibt's do no koin Wochevergleich.",
    bayrisch:
      "Obacht, ned so gschwind: Für de Woch fehlt no da Stand vo da Vorwoch, drum gibt's do no koan Wochnvergleich.",
  },
  firstWeek: {
    de: (date: string) => ` Die ersten Wochenzahlen gibt es in der Woche bis zum ${date}`,
    en: (date: string) => ` The first weekly numbers arrive in the week ending ${date}`,
    schwaebisch: (date: string) => ` Die erschte Wochezahle gibt's in dr Woch bis zum ${date}`,
    bayrisch: (date: string) => ` De erstn Wochnzahln gibt's in da Woch bis zum ${date}`,
  },
  untilThen: {
    de: " Bis dahin zeigt Gesamt alles seit dem Serverstart.",
    en: " Until then, All Time shows everything since the server launch.",
    schwaebisch: " Bis dahin zeigt Gsamt alles seit em Serverstart.",
    bayrisch: " Bis dahi zeigt Gsamt ois seit'm Serverstart.",
  },
  monthMissing: {
    de: "Nur Geduld: Für diesen Monat fehlt noch der Stand vom Ende des Vormonats, deshalb gibt es hier noch keinen Monatsvergleich. Gesamt zeigt alles seit dem Serverstart.",
    en: "Patience: the snapshot from the end of last month is still missing, so there is no monthly comparison yet. All Time shows everything since the server launch.",
    schwaebisch:
      "Gemach, gemach: Für den Monat fehlt no dr Stand vom End vom Vormonat, drom gibt's do no koin Monatsvergleich. Gsamt zeigt alles seit em Serverstart.",
    bayrisch:
      "Obacht, ned so gschwind: Für den Monat fehlt no da Stand vom End vom Vormonat, drum gibt's do no koan Monatsvergleich. Gsamt zeigt ois seit'm Serverstart.",
  },
  period: { de: "Zeitraum", en: "Period" },
  asOf: { de: "Stand", en: "As of", schwaebisch: "Stand", bayrisch: "Stand" },
  characters: {
    de: (n: number) => (n === 1 ? "1 Charakter" : `${n} Charaktere`),
    en: (n: number) => (n === 1 ? "1 character" : `${n} characters`),
    schwaebisch: (n: number) => (n === 1 ? "1 Charakter" : `${n} Charaktere`),
    bayrisch: (n: number) => (n === 1 ? "1 Charakter" : `${n} Charaktere`),
  },
  intro: {
    de: "Das Kuriositätenkabinett der Gilde: wer am meisten angelt, isst, winkt und leider auch stirbt. Korrekt gezählt, mit Augenzwinkern erzählt.",
    en: "The guild's cabinet of curiosities: who fishes, eats, waves and, sadly, dies the most. Counted correctly, told with a wink.",
    schwaebisch:
      "Des Kuriositätekabinett vo dr Gilde: wer am meischte anglet, vesperet, winkt ond leider au stirbt. Korrekt zählt, mit Augezwinkre verzählt.",
    bayrisch:
      "Des Kuriositätnkabinett vo da Gilde: wer am meistn angelt, Brotzeit macht, winkt und leider a stirbt. Gscheid zählt, mit am Augnzwinkern dazählt.",
  },
  backfilled: {
    de: "In dieser Woche lief kein Sammler, die Werte stammen aus der Woche davor.",
    en: "The collector did not run this week; the values come from the week before.",
    schwaebisch: "In dere Woch isch koi Sammler gloffe, d'Werte stammet aus dr Woch davor.",
    bayrisch: "De Woch is koa Sammler glaffa, de Werte san aus da Woch davor.",
  },
  source: {
    de: "Zahlen aus der Charakterstatistik von Blizzard, als Zuwachs im gewählten Zeitraum. Der Sammler hält jede Woche von Sonntag bis Samstag einen Stand fest, der Serverstart zählt als Stand mit lauter Nullen. Wer neu in die Gilde kommt, zählt bei Woche und Monat ab seiner zweiten Woche. Horde gegen Allianz vergleicht immer beide Gilden.",
    en: "Numbers from Blizzard's character statistics, as growth within the chosen period. The collector records a snapshot every week from Sunday to Saturday; the server launch counts as a snapshot of all zeros. New guild members count toward week and month from their second week. Horde versus Alliance always compares both guilds.",
    schwaebisch:
      "Zahle aus dr Charakterstatistik vo Blizzard, als Zuwachs im gwählte Zeitraum. Dr Sammler hält jede Woch vo Sonndig bis Samschdig en Stand fescht, dr Serverstart zählt als Stand mit lauter Nuller. Wer neu en d'Gilde kommt, zählt bei Woch ond Monat erscht ab seiner zwoite Woch. Horde gege Allianz vergleicht immer beide Gilde.",
    bayrisch:
      "Zahln aus da Charakterstatistik vo Blizzard, als Zuwachs im gwählten Zeitraum. Da Sammler hoit jede Woch vo Sonntag bis Samstag an Stand fest, da Serverstart zählt ois Stand mit lauter Nuller. Wer neu in d'Gilde kimmt, zählt bei Woch und Monat erst ab seina zwoatn Woch. Horde gega Allianz vergleicht oiwei beide Gildn.",
  },
} satisfies Record<string, Fassungen<unknown>>;

/** API path for a period, optional week (Saturday) or month and optional guild. */
export function statsPath(kind: StatsPeriodKind, id: string | null, guild: string | null = null): string {
  const base = statsBase(kind, id);
  return guild === null ? base : `${base}?guild=${encodeURIComponent(guild)}`;
}

const sunday = (saturday: string) => {
  const d = new Date(`${saturday}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 6);
  return d.toISOString().slice(0, 10);
};

const nextSaturday = (saturday: string) => {
  const d = new Date(`${saturday}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
};

function periodLabel(view: StatsView, language: Sprache): string {
  if (view.kind === "woche" && view.id) return weekLabel(sunday(view.id), view.id, language);
  if (view.kind === "monat" && view.id) return monthLabel(view.id, language);
  return view.serverStart ? T.allTimeSince[language](formatPlainDate(view.serverStart)) : T.allTime[language];
}

/** Friendly hint when there are no reliable numbers for the period yet. */
function NotYet({ view }: { view: StatsView }) {
  const { t } = useSprache();
  let text: string;
  if (view.status === "keine") {
    text = t(T.nothingYet);
  } else if (view.kind === "woche") {
    const latest = view.id !== null && view.id === view.weeks[0];
    text =
      t(T.weekMissing) +
      (latest && view.id ? t(T.firstWeek)(formatPlainDayMonth(nextSaturday(view.id))) : "") +
      t(T.untilThen);
  } else {
    text = t(T.monthMissing);
  }
  return (
    <div className="state state-empty" role="status">
      <p>{text}</p>
    </div>
  );
}

interface StatsProps {
  onSelect(kind: StatsPeriodKind, id: string | null): void;
  onGuild(guild: string | null): void;
}

function StatsContent({ view, onSelect, onGuild }: StatsProps & { view: StatsView }) {
  const { t, sprache } = useSprache();
  const options = view.kind === "woche" ? view.weeks : view.kind === "monat" ? view.months : [];
  return (
    <>
      <div className="stats-period">
        <GuildFilter guilds={view.guilds} value={view.guild} onChange={onGuild} />
        <div className="segmented" role="radiogroup" aria-label={t(T.period)}>
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={p.id === view.kind}
              className="segmented-option"
              onClick={() => onSelect(p.id, null)}
            >
              {t(p.label)}
            </button>
          ))}
        </div>
        {options.length > 1 && (
          <select
            className="filter-input"
            aria-label={view.kind === "woche" ? "Woche" : "Monat"}
            value={view.id ?? ""}
            onChange={(e) => onSelect(view.kind, e.target.value)}
          >
            {options.map((o) => (
              <option key={o} value={o}>
                {view.kind === "woche" ? weekLabel(sunday(o), o, sprache) : monthLabel(o, sprache)}
              </option>
            ))}
          </select>
        )}
      </div>
      <p className="page-subtitle muted">
        {periodLabel(view, sprache)}
        {view.takenAt && ` · ${t(T.asOf)}: ${formatDateTime(view.takenAt)}`}
        {view.status === "ok" && ` · ${t(T.characters)(view.characters)}`}
      </p>
      <p className="stat-intro">{t(T.intro)}</p>
      {view.nachgeholt && <p className="muted small">{t(T.backfilled)}</p>}
      {view.status === "ok" ? <StatWall view={view} subtitle={periodLabel(view, sprache)} /> : <NotYet view={view} />}
      <p className="muted small">{t(T.source)}</p>
    </>
  );
}

/** Guild stats tab: wall of curiosities from the weekly snapshots, per period and guild. */
export function GuildStats({
  kind,
  id,
  guild,
  onSelect,
  onGuild,
}: StatsProps & { kind: StatsPeriodKind; id: string | null; guild: string | null }) {
  const { data, error, loading } = useApi<StatsView>(statsPath(kind, id, guild));
  return (
    <DataState loading={loading} error={error}>
      {data && <StatsContent view={data} onSelect={onSelect} onGuild={onGuild} />}
    </DataState>
  );
}
