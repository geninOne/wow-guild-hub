import { useNavigate, useParams, useSearchParams } from "react-router";
import type { StatsPeriodKind } from "../../../src/api/types";
import { ActivityOverview } from "../components/ActivityOverview";
import { DungeonOverview } from "../components/DungeonOverview";
import { GuildDistribution } from "../components/GuildDistribution";
import { GuildStats, PERIODS } from "../components/GuildStats";
import { registeredUiExtensions } from "../extensions/registry";
import type { StatsTab } from "../extensions/types";
import { useLanguage, type Translations } from "../lib/language";
import { NotFoundPage } from "./NotFoundPage";

const TABS = [
  { id: "allgemein", label: { de: "Allgemein", en: "General", schwaebisch: "Allgemei", bayrisch: "Allgemein" }, path: "/statistik" },
  { id: "aktivitaet", label: { de: "Aktivität", en: "Activity", schwaebisch: "Aktivität", bayrisch: "Aktivität" }, path: "/statistik/aktivitaet" },
  { id: "gilde", label: { de: "Gildenstatistik", en: "Guild Statistics", schwaebisch: "Gildestatistik", bayrisch: "Gildnstatistik" }, path: "/statistik/gilde" },
  { id: "dungeons", label: { de: "Dungeons und Raids", en: "Dungeons and Raids", schwaebisch: "Dungeons ond Raids", bayrisch: "Dungeons und Raids" }, path: "/statistik/dungeons" },
] as const satisfies readonly { id: string; label: Translations; path: string }[];

type Tab = { id: string; label: Translations; path: string; Component?: StatsTab["Component"] };

/** Tabs of the core, followed by those of the extensions. */
function allTabs(): Tab[] {
  const extra = registeredUiExtensions().flatMap((e) => e.statsTabs ?? []).filter((r) => !TABS.some((t) => t.id === r.id));
  return [...TABS, ...extra.map((r) => ({ id: r.id, label: r.label, path: `/statistik/${r.id}`, Component: r.Component }))];
}

const SECTIONS: Translations = { de: "Bereiche", en: "Sections" };

const TITLE: Translations = { de: "Statistik", en: "Statistics", schwaebisch: "Statistik", bayrisch: "Statistik" };

const DEFAULT_PERIOD: StatsPeriodKind = "gesamt";

function isPeriod(value: string | null): value is StatsPeriodKind {
  return PERIODS.some((p) => p.id === value);
}

/** Stats page with tabs: General at `/statistik`, otherwise `/statistik/<reiter>`. */
export function StatsPage() {
  const { t: text } = useLanguage();
  const { reiter: tabId } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tabs = allTabs();
  const tab = tabs.find((t) => t.id === (tabId ?? "allgemein"));
  if (!tab) return <NotFoundPage />;

  const requested = params.get("zeitraum");
  const kind: StatsPeriodKind = isPeriod(requested) ? requested : DEFAULT_PERIOD;
  const id = kind === "gesamt" ? null : params.get(kind);
  const guild = params.get("gilde");

  function update(next: StatsPeriodKind, nextId: string | null, nextGuild: string | null) {
    const query = new URLSearchParams();
    if (next !== DEFAULT_PERIOD) query.set("zeitraum", next);
    if (next !== "gesamt" && nextId) query.set(next, nextId);
    if (nextGuild !== null) query.set("gilde", nextGuild);
    setParams(query, { replace: true });
  }

  function selectTab(id: string) {
    const target = tabs.find((t) => t.id === id)!;
    navigate(target.path + (guild !== null && id !== "allgemein" && id !== "aktivitaet" ? `?gilde=${encodeURIComponent(guild)}` : ""), {
      replace: true,
    });
  }

  return (
    <section className="page">
      <header className="page-header">
        <h1 className="page-title">{text(TITLE)}</h1>
      </header>
      <div className="tabs" role="tablist" aria-label={text(SECTIONS)}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`reiter-${t.id}`}
            aria-selected={t.id === tab.id}
            aria-controls="reiter-inhalt"
            className="tab"
            onClick={() => selectTab(t.id)}
          >
            {text(t.label)}
          </button>
        ))}
      </div>
      <div id="reiter-inhalt" role="tabpanel" aria-labelledby={`reiter-${tab.id}`} className="stats-tab">
        {tab.id === "allgemein" && <GuildDistribution />}
        {tab.id === "aktivitaet" && <ActivityOverview />}
        {tab.id === "dungeons" && <DungeonOverview guild={guild} onGuild={(nextGuild) => update(kind, null, nextGuild)} />}
        {tab.Component && <tab.Component guild={guild} onGuild={(nextGuild) => update(kind, null, nextGuild)} />}
        {tab.id === "gilde" && (
          <GuildStats
            kind={kind}
            id={id}
            guild={guild}
            onSelect={(next, nextId) => update(next, nextId, guild)}
            onGuild={(nextGuild) => update(kind, id, nextGuild)}
          />
        )}
      </div>
    </section>
  );
}
