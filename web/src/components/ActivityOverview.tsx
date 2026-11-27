import { useState } from "react";
import type { ActivityView } from "../../../src/api/types";
import { useApi } from "../lib/api";
import { dayTotals, formatRange, hourRange, peak, weekdayNames } from "../lib/fun";
import { useSprache, type Fassungen } from "../lib/sprache";
import { DataState } from "./DataState";
import { GuildFilter } from "./GuildFilter";
import { Heatmap } from "./Heatmap";
import { MemberFact, useMemberList } from "./MemberList";
import { SampleDataNotice } from "./SampleDataNotice";

const T = {
  lastWeeks: {
    de: (n: number) => `Letzte ${n} Wochen`,
    en: (n: number) => `Last ${n} weeks`,
    schwaebisch: (n: number) => `Letzte ${n} Woche`,
    bayrisch: (n: number) => `De letztn ${n} Wochn`,
  },
  records: {
    de: (n: number) => `Aufzeichnungen aus ${n} ${n === 1 ? "Woche" : "Wochen"}`,
    en: (n: number) => `Records from ${n} ${n === 1 ? "week" : "weeks"}`,
    schwaebisch: (n: number) => `Aufzeichnunge aus ${n} ${n === 1 ? "Woch" : "Woche"}`,
    bayrisch: (n: number) => `Aufzeichnungen aus ${n} ${n === 1 ? "Woch" : "Wochn"}`,
  },
  empty: {
    de: "Noch keine Anmeldungen aufgezeichnet. Der Sammler schaut jede Stunde nach.",
    en: "No logins recorded yet. The collector checks every hour.",
    schwaebisch: "No koine Anmeldunge aufzeichnet. Dr Sammler guckt jede Stond nach.",
    bayrisch: "No koane Anmeldungen aufzeichnet. Da Sammler schaut jede Stund nach.",
  },
  busiestHour: { de: "Stärkste Stunde", en: "Busiest Hour", schwaebisch: "Stärkschte Stond", bayrisch: "Stärkste Stund" },
  busiestDay: { de: "Stärkster Tag", en: "Busiest Day", schwaebisch: "Stärkschter Tag", bayrisch: "Stärksta Tag" },
  logins: { de: "Anmeldungen", en: "Logins", schwaebisch: "Anmeldunge", bayrisch: "Anmeldungen" },
  characters: { de: "Charaktere", en: "Characters", schwaebisch: "Charaktere", bayrisch: "Charaktere" },
  notAvailable: { de: "k. A.", en: "n/a", schwaebisch: "k. A.", bayrisch: "k. A." },
  when: { de: "Wann ist die Gilde online?", en: "When is the guild online?", schwaebisch: "Wann isch d'Gilde online?", bayrisch: "Wann is d'Gilde online?" },
  hint: {
    de: "Gezählt werden Anmeldungen, nicht die Spielzeit: Blizzard verrät nur, wann sich ein Charakter zuletzt angemeldet hat. Wer sich in einer Stunde mehrmals anmeldet, zählt einmal. Zeiten in deutscher Zeit.",
    en: "Logins are counted, not playtime: Blizzard only reveals when a character last logged in. Several logins within one hour count once. Times are in German time (CET/CEST).",
    schwaebisch:
      "Zählt werdet Anmeldunge, net d'Spielzeit: Blizzard verrät bloß, wann sich en Charakter zletzt agmeldet hot. Wer sich in oiner Stond öfter ameldet, zählt oimol. Zeite in deutscher Zeit.",
    bayrisch:
      "Zählt wern Anmeldungen, ned de Spielzeit: Blizzard verrat bloß, wann si a Charakter zletzt ogmeldt hod. Wer si in oana Stund öfter omeldt, zählt oamoi. Zeitn in deutscher Zeit.",
  },
} satisfies Record<string, Fassungen<unknown>>;

function ActivityContent({ view }: { view: ActivityView }) {
  const { t, sprache } = useSprache();
  const days = weekdayNames(sprache);
  const [guildSlug, setGuildSlug] = useState<string | null>(null);
  const data = guildSlug === null ? view.all : (view.byGuild[guildSlug] ?? view.all);
  const hourPeak = peak(data.cells);
  const dayPeak = peak(dayTotals(data.cells));
  const total = data.cells.reduce((a, b) => a + b, 0);
  const list = useMemberList(guildSlug);
  const openList = () =>
    list.open({
      title: t(T.characters),
      subtitle: `${t(T.lastWeeks)(view.weeks.length)}, ${formatRange(view.from, view.to, sprache)}`,
      sets: [{ key: "logins", label: t(T.characters), valueLabel: t(T.logins), entries: view.logins ?? [] }],
    });

  return (
    <>
      <p className="page-subtitle muted">
        {t(T.lastWeeks)(view.weeks.length)}, {formatRange(view.from, view.to, sprache)}
        {view.weeksWithData < view.weeks.length && ` · ${t(T.records)(view.weeksWithData)}`}
      </p>
      <SampleDataNotice show={view.testdaten} />
      <GuildFilter guilds={view.guilds} value={guildSlug} onChange={setGuildSlug} />

      {total === 0 ? (
        <div className="state state-empty" role="status">
          <p>{t(T.empty)}</p>
        </div>
      ) : (
        <>
          <ul className="fun-facts">
            <li className="fun-fact">
              <span className="fun-fact-label">{t(T.busiestHour)}</span>
              <strong className="fun-fact-value">
                {hourPeak ? `${days[Math.floor(hourPeak.index / 24)]}, ${hourRange(hourPeak.index % 24, sprache)}` : t(T.notAvailable)}
              </strong>
            </li>
            <li className="fun-fact">
              <span className="fun-fact-label">{t(T.busiestDay)}</span>
              <strong className="fun-fact-value">{dayPeak ? days[dayPeak.index] : t(T.notAvailable)}</strong>
            </li>
            <li className="fun-fact">
              <span className="fun-fact-label">{t(T.logins)}</span>
              <strong className="fun-fact-value num">{total}</strong>
            </li>
            <MemberFact label={t(T.characters)} value={data.characters} onClick={openList} />
          </ul>
          <div className="panel">
            <header className="panel-header">
              <h2 className="panel-title">{t(T.when)}</h2>
            </header>
            <Heatmap cells={data.cells} />
          </div>
        </>
      )}
      <p className="muted small">{t(T.hint)}</p>
      {list.dialog}
    </>
  );
}

/** Activity tab of the stats page: logins of the last weeks as a heatmap. */
export function ActivityOverview() {
  const { data, error, loading } = useApi<ActivityView>("/api/activity");
  return (
    <DataState loading={loading} error={error}>
      {data && <ActivityContent view={data} />}
    </DataState>
  );
}
