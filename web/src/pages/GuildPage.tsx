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
import { useSprache, type Fassungen } from "../lib/sprache";
import { factionName } from "../lib/wow";

/** Platzhalter für fehlende Werte; in den Dialekten wie auf Deutsch, damit die Tabelle ruhig bleibt. */
const NA: Fassungen = { de: "k. A.", en: "n/a" };

const T = {
  titel: { de: "Gildenübersicht", en: "Guild Overview", schwaebisch: "Gildenübersicht", bayrisch: "Gildnübersicht" },
  mitglieder: {
    de: (n: number) => `${n} Mitglieder`,
    en: (n: number) => `${n} members`,
    schwaebisch: (n: number) => `${n} Mitglieder`,
    bayrisch: (n: number) => `${n} Mitglieder`,
  },
  stand: { de: "Stand", en: "As of", schwaebisch: "Stand", bayrisch: "Stand" },
  nameSuchen: { de: "Name suchen", en: "Search name", schwaebisch: "Name sucha", bayrisch: "Nam suachn" },
  klasse: { de: "Klasse", en: "Class", schwaebisch: "Klasse", bayrisch: "Klass" },
  alleKlassen: { de: "Alle Klassen", en: "All classes", schwaebisch: "Älle Klassa", bayrisch: "Olle Klassn" },
  rang: { de: "Rang", en: "Rank", schwaebisch: "Rang", bayrisch: "Rang" },
  alleRaenge: { de: "Alle Ränge", en: "All ranks", schwaebisch: "Älle Räng", bayrisch: "Olle Räng" },
  ehemaligeAnzeigen: { de: "Ehemalige anzeigen", en: "Show former members", schwaebisch: "Ehemalige zoiga", bayrisch: "Ehemalige ozoagn" },
  ehemalig: { de: "ehemalig", en: "former", schwaebisch: "ehemalig", bayrisch: "ehemalig" },
  ohneProfil: {
    de: "Details erst ab Level 10",
    en: "Details from level 10",
    schwaebisch: "Details erscht ab Level 10",
    bayrisch: "Details erst ab Level 10",
  },
  keineMitglieder: {
    de: "Keine Mitglieder gefunden.",
    en: "No members found.",
    schwaebisch: "Koine Mitglieder gfonda.",
    bayrisch: "Koane Mitglieder gfundn.",
  },
} satisfies Record<string, Fassungen | Fassungen<(n: number) => string>>;

/** Fraktionsnamen; Deutsch und Dialekte über factionName, Englisch wie im Spielclient. */
const FRAKTION: Fassungen<(faction: string) => string> = {
  de: factionName,
  en: (faction) => (faction === "HORDE" ? "Horde" : faction === "ALLIANCE" ? "Alliance" : faction),
};

const COLUMNS: { key: SortKey; label: Fassungen; numeric: boolean }[] = [
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
  const { t } = useSprache();
  const [text, setText] = useState("");
  const [classId, setClassId] = useState<number | null>(null);
  const [rankValue, setRankValue] = useState("");
  const [showFormer, setShowFormer] = useState(false);
  const [guildSlug, setGuildSlug] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "level", dir: "desc" });

  const rankChoices = useMemo(() => rankGroups(guild.ranks, guild.guilds, guildSlug), [guild.ranks, guild.guilds, guildSlug]);
  // Gilde gewechselt und der Rang gibt es dort nicht mehr: Filter fällt auf "Alle Ränge" zurück.
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
                {t(FRAKTION)(g.faction)} · {t(T.mitglieder)(g.memberCount)}
              </span>
            </span>
          </span>
        ))}
      </div>
      <p className="page-subtitle muted">
        {guild.rulesetName} · {t(T.stand)}: {formatDateTime(guild.fetchedAt)}
      </p>

      <GuildFilter guilds={guild.guilds} value={guildSlug} onChange={setGuildSlug} />

      <div className="panel panel-flush">
        <div className="filter-bar">
          <input
            type="search"
            className="filter-input"
            placeholder={t(T.nameSuchen)}
            aria-label={t(T.nameSuchen)}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <select
            className="filter-input"
            aria-label={t(T.klasse)}
            value={classId ?? ""}
            onChange={(e) => setClassId(e.target.value === "" ? null : Number(e.target.value))}
          >
            <option value="">{t(T.alleKlassen)}</option>
            {guild.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            className="filter-input"
            aria-label={t(T.rang)}
            value={activeRankValue}
            onChange={(e) => setRankValue(e.target.value)}
          >
            <option value="">{t(T.alleRaenge)}</option>
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
            {t(T.ehemaligeAnzeigen)}
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
                      <span className="hint" title={t(T.ohneProfil)} aria-label={t(T.ohneProfil)}>
                        {" "}
                        ⓘ
                      </span>
                    )}
                    {m.former && <span className="badge badge-muted former-badge">{t(T.ehemalig)}</span>}
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
                    {t(T.keineMitglieder)}
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
  const { t } = useSprache();
  const { data, error, loading } = useApi<GuildView>("/api/guild");
  return (
    <section className="page">
      <header className="page-header">
        <h1 className="page-title">{t(T.titel)}</h1>
      </header>
      <DataState loading={loading} error={error}>
        {data && <GuildContent guild={data} />}
      </DataState>
    </section>
  );
}
