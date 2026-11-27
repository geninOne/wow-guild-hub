import { useMemo, useState } from "react";
import { Link } from "react-router";
import type { GuildView } from "../../../src/api/types";
import { ClassName } from "../components/ClassName";
import { DataState } from "../components/DataState";
import { FactionCrest } from "../components/FactionCrest";
import { GuildFilter } from "../components/GuildFilter";
import { useApi } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { filterMembers, parseRankValue, rankGroups, sortMembers, type SortKey } from "../lib/members";
import { useLanguage, type Translations } from "../lib/language";
import { factionName } from "../lib/wow";

/** Placeholder for missing values; in the dialects the same as in German, so the table stays calm. */
const NA: Translations = { de: "k. A.", en: "n/a" };

const T = {
  title: { de: "Gildenübersicht", en: "Guild Overview", schwaebisch: "Gildenübersicht", bayrisch: "Gildnübersicht" },
  members: {
    de: (n: number) => `${n} Mitglieder`,
    en: (n: number) => `${n} members`,
    schwaebisch: (n: number) => `${n} Mitglieder`,
    bayrisch: (n: number) => `${n} Mitglieder`,
  },
  asOf: { de: "Stand", en: "As of", schwaebisch: "Stand", bayrisch: "Stand" },
  searchName: { de: "Name suchen", en: "Search name", schwaebisch: "Name sucha", bayrisch: "Nam suachn" },
  class: { de: "Klasse", en: "Class", schwaebisch: "Klasse", bayrisch: "Klass" },
  allClasses: { de: "Alle Klassen", en: "All classes", schwaebisch: "Älle Klassa", bayrisch: "Olle Klassn" },
  rank: { de: "Rang", en: "Rank", schwaebisch: "Rang", bayrisch: "Rang" },
  allRanks: { de: "Alle Ränge", en: "All ranks", schwaebisch: "Älle Räng", bayrisch: "Olle Räng" },
  showFormer: { de: "Ehemalige anzeigen", en: "Show former members", schwaebisch: "Ehemalige zoiga", bayrisch: "Ehemalige ozoagn" },
  former: { de: "ehemalig", en: "former", schwaebisch: "ehemalig", bayrisch: "ehemalig" },
  noProfile: {
    de: "Details erst ab Level 10",
    en: "Details from level 10",
    schwaebisch: "Details erscht ab Level 10",
    bayrisch: "Details erst ab Level 10",
  },
  noMembers: {
    de: "Keine Mitglieder gefunden.",
    en: "No members found.",
    schwaebisch: "Koine Mitglieder gfonda.",
    bayrisch: "Koane Mitglieder gfundn.",
  },
} satisfies Record<string, Translations | Translations<(n: number) => string>>;

/** Faction names; German and dialects via factionName, English as in the game client. */
const FACTION: Translations<(faction: string) => string> = {
  de: factionName,
  en: (faction) => (faction === "HORDE" ? "Horde" : faction === "ALLIANCE" ? "Alliance" : faction),
};

const COLUMNS: { key: SortKey; label: Translations; numeric: boolean }[] = [
  { key: "name", label: { de: "Name", en: "Name", schwaebisch: "Name", bayrisch: "Nam" }, numeric: false },
  { key: "guildName", label: { de: "Gilde", en: "Guild", schwaebisch: "Gilde", bayrisch: "Gilde" }, numeric: false },
  { key: "className", label: { de: "Klasse", en: "Class", schwaebisch: "Klasse", bayrisch: "Klass" }, numeric: false },
  { key: "level", label: { de: "Level", en: "Level", schwaebisch: "Level", bayrisch: "Level" }, numeric: true },
  {
    key: "itemLevel",
    label: { de: "Gegenstandsstufe", en: "Item Level", schwaebisch: "Gegenstandsstufe", bayrisch: "Gegenstandsstufn" },
    numeric: true,
  },
  { key: "mainSpecName", label: { de: "Hauptbaum", en: "Main spec", schwaebisch: "Hauptbaum", bayrisch: "Hauptbaam" }, numeric: false },
  { key: "rank", label: { de: "Rang", en: "Rank", schwaebisch: "Rang", bayrisch: "Rang" }, numeric: false },
];

function GuildContent({ guild }: { guild: GuildView }) {
  const { t } = useLanguage();
  const [text, setText] = useState("");
  const [classId, setClassId] = useState<number | null>(null);
  const [rankValue, setRankValue] = useState("");
  const [showFormer, setShowFormer] = useState(false);
  const [guildSlug, setGuildSlug] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "level", dir: "desc" });

  const rankChoices = useMemo(() => rankGroups(guild.ranks, guild.guilds, guildSlug), [guild.ranks, guild.guilds, guildSlug]);
  // Guild switched and the rank no longer exists there: the filter falls back to "Alle Ränge".
  const activeRankValue = rankChoices.some((g) => g.options.some((o) => o.value === rankValue)) ? rankValue : "";
  const { rank, rankGuildSlug } = parseRankValue(activeRankValue);
  const rows = useMemo(
    () => sortMembers(filterMembers(guild.members, { text, classId, rank, rankGuildSlug, guildSlug, showFormer }), sort.key, sort.dir),
    [guild.members, text, classId, rank, rankGuildSlug, guildSlug, showFormer, sort],
  );

  function sortBy(key: SortKey, numeric: boolean) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: numeric ? "desc" : "asc" }));
  }

  return (
    <>
      <div className="guild-heads">
        {guild.guilds.map((g) => (
          <span key={g.slug} className="guild-head">
            <FactionCrest faction={g.faction} size={22} />
            <span>
              <strong className="guild-head-name">{g.name}</strong>
              <span className="muted small">
                {" "}
                {t(FACTION)(g.faction)} · {t(T.members)(g.memberCount)}
              </span>
            </span>
          </span>
        ))}
      </div>
      <p className="page-subtitle muted">
        {guild.rulesetName} · {t(T.asOf)}: {formatDateTime(guild.fetchedAt)}
      </p>

      <GuildFilter guilds={guild.guilds} value={guildSlug} onChange={setGuildSlug} />

      <div className="panel panel-flush">
        <div className="filter-bar">
          <input
            type="search"
            className="filter-input"
            placeholder={t(T.searchName)}
            aria-label={t(T.searchName)}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <select
            className="filter-input"
            aria-label={t(T.class)}
            value={classId ?? ""}
            onChange={(e) => setClassId(e.target.value === "" ? null : Number(e.target.value))}
          >
            <option value="">{t(T.allClasses)}</option>
            {guild.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            className="filter-input"
            aria-label={t(T.rank)}
            value={activeRankValue}
            onChange={(e) => setRankValue(e.target.value)}
          >
            <option value="">{t(T.allRanks)}</option>
            {rankChoices.map((g) =>
              g.label === null ? (
                g.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))
              ) : (
                <optgroup key={g.label} label={g.label}>
                  {g.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              ),
            )}
          </select>
          <label className="toggle">
            <input type="checkbox" checked={showFormer} onChange={(e) => setShowFormer(e.target.checked)} />
            {t(T.showFormer)}
          </label>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {COLUMNS.map((c) => {
                  const active = sort.key === c.key;
                  return (
                    <th
                      key={c.key}
                      className={c.numeric ? "num" : undefined}
                      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                    >
                      <button type="button" className="sort-button" onClick={() => sortBy(c.key, c.numeric)}>
                        {t(c.label)}
                        <span aria-hidden="true">{active ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}</span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td>
                    <Link to={`/charakter/${m.slug}`}>{m.surname ? `${m.name} ${m.surname}` : m.name}</Link>
                    {!m.hasProfile && (
                      <span className="hint" title={t(T.noProfile)} aria-label={t(T.noProfile)}>
                        {" "}
                        ⓘ
                      </span>
                    )}
                    {m.former && <span className="badge badge-muted former-badge">{t(T.former)}</span>}
                  </td>
                  <td>
                    <span className="guild-cell">
                      <FactionCrest faction={guild.guilds.find((g) => g.slug === m.guildSlug)?.faction ?? ""} />
                      {m.guildName}
                    </span>
                  </td>
                  <td>
                    <ClassName classId={m.classId} name={m.className} />
                  </td>
                  <td className="num">{m.level}</td>
                  <td className="num">{m.itemLevel ?? t(NA)}</td>
                  <td>{m.mainSpecName ?? t(NA)}</td>
                  <td>{m.rankName}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length} className="muted">
                    {t(T.noMembers)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export function GuildPage() {
  const { t } = useLanguage();
  const { data, error, loading } = useApi<GuildView>("/api/guild");
  return (
    <section className="page">
      <header className="page-header">
        <h1 className="page-title">{t(T.title)}</h1>
      </header>
      <DataState loading={loading} error={error}>
        {data && <GuildContent guild={data} />}
      </DataState>
    </section>
  );
}
