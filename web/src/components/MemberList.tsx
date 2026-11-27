import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import type { GuildRef, GuildView } from "../../../src/api/types";
import { useApi, type ApiError } from "../lib/api";
import {
  defaultDirection,
  filterMemberList,
  MEMBER_SEARCH_FROM,
  resolveMembers,
  sortMemberList,
  type MemberEntry,
  type MemberListSortKey,
} from "../lib/member-list";
import { useSprache, type Fassungen } from "../lib/sprache";
import { CharacterLink } from "./CharacterLink";
import { ClassName } from "./ClassName";
import { DataState } from "./DataState";
import { GuildFilter } from "./GuildFilter";
import { numberLocale } from "../lib/format";

const T = {
  schliessen: { de: "Schließen", en: "Close", schwaebisch: "Zumache", bayrisch: "Zuamacha" },
  suchen: { de: "Nach Namen suchen", en: "Search by name", schwaebisch: "Nach Name sucha", bayrisch: "Nach Nama suacha" },
  suchePlatzhalter: { de: "Name …", en: "Name …", schwaebisch: "Name …", bayrisch: "Nama …" },
  wert: { de: "Wert", en: "Value", schwaebisch: "Wert", bayrisch: "Wert" },
  name: { de: "Name", en: "Name", schwaebisch: "Name", bayrisch: "Nama" },
  klasse: { de: "Klasse", en: "Class", schwaebisch: "Klass", bayrisch: "Klass" },
  volk: { de: "Volk", en: "Race", schwaebisch: "Volk", bayrisch: "Voik" },
  level: { de: "Level", en: "Level", schwaebisch: "Level", bayrisch: "Level" },
  unbekannt: { de: "Unbekannt", en: "Unknown", schwaebisch: "Unbekannt", bayrisch: "Unbekannt" },
  ehemalig: { de: "ehemalig", en: "former", schwaebisch: "ehemalig", bayrisch: "ehemalig" },
  keiner: {
    de: "Hier steht niemand drin.",
    en: "Nobody here.",
    schwaebisch: "Do stoht koiner drin.",
    bayrisch: "Do steht koana drin.",
  },
  keinTreffer: {
    de: "Kein Name passt zur Suche.",
    en: "No name matches the search.",
    schwaebisch: "Koi Name passt zur Such.",
    bayrisch: "Koa Nama passt zur Suach.",
  },
  anzahl: {
    de: (n: number) => (n === 1 ? "1 Mitglied" : `${n} Mitglieder`),
    en: (n: number) => (n === 1 ? "1 member" : `${n} members`),
    schwaebisch: (n: number) => (n === 1 ? "1 Mitglied" : `${n} Mitglieder`),
    bayrisch: (n: number) => (n === 1 ? "1 Mitglied" : `${n} Mitglieder`),
  },
  sortieren: {
    de: (spalte: string) => `Nach ${spalte} sortieren`,
    en: (spalte: string) => `Sort by ${spalte}`,
    schwaebisch: (spalte: string) => `Nach ${spalte} sortiera`,
    bayrisch: (spalte: string) => `Nach ${spalte} sortiern`,
  },
  liste: { de: "Mitgliederliste", en: "Member list", schwaebisch: "Mitgliederlischt", bayrisch: "Mitgliederlistn" },
  ansehen: { de: "Alle ansehen", en: "View all", schwaebisch: "Älle aagucke", bayrisch: "Olle oschaun" },
  listeZu: {
    de: (was: string) => `Liste: ${was}`,
    en: (was: string) => `List: ${was}`,
    schwaebisch: (was: string) => `Lischt: ${was}`,
    bayrisch: (was: string) => `Listn: ${was}`,
  },
} satisfies Record<string, Fassungen<unknown>>;

const fmt = (n: number) => n.toLocaleString(numberLocale());

/** Eine Menge von Mitgliedern mit Beschriftung und Wertspalte; mehrere Mengen lassen sich im Dialog umschalten. */
export interface MemberSet {
  key: string;
  /** Name der Menge in der Auswahl, etwa "Tode durch Stürze". */
  label: string;
  /** Überschrift der Wertspalte; null ohne Wertspalte. */
  valueLabel: string | null;
  entries: readonly MemberEntry[];
  /** Darstellung der Werte, etwa als Datum; Standard sind Zahlen mit Tausenderpunkt. */
  formatValue?: (value: number) => string;
  /** Werte sind Text (etwa "7 Tode"): linksbündig statt als Zahl. */
  textValue?: boolean;
  /** Hervorgehobene Mitglieder, etwa alle Inhaber eines Titels, mit kurzem Abzeichen. */
  highlight?: { ids: number[]; label: string };
}

export interface MemberListDialogProps {
  /** Überschrift des Dialogs, etwa der Kartentitel. */
  title: string;
  /** Unterzeile, etwa der Zeitraum. */
  subtitle?: string;
  /** Mengen zum Zeigen; null, solange sie noch laden. */
  sets: MemberSet[] | null;
  /** Fehler beim Nachladen der Mengen. */
  error?: ApiError | null;
  /** Anfangs gewählte Gilde (Horde/Allianz-Umschalter der Seite), null für alle. */
  guild: string | null;
  /** Bereits geladene Mitgliederdaten; ohne lädt der Dialog `/api/guild` selbst. */
  guildView?: GuildView | null;
  /** true, wenn die Mengen schon nach Gilde gefiltert sind; dann gibt es im Dialog keinen eigenen Umschalter. */
  fixedGuild?: boolean;
  onClose(): void;
}

/**
 * Dialog mit der Mitgliederliste hinter einer Zahl: Name (zur Charakterseite), Klasse in Klassenfarbe, Volk, Level und
 * der Wert der Karte. Sortierbar, ab 15 Einträgen mit Suche, mit eigenem Gildenumschalter, der mit der Wahl der Seite
 * startet. Escape, der Schließen-Knopf und ein Klick daneben schließen; der Fokus kehrt zum Auslöser zurück.
 * Wiederverwendbar von überall: Karten, Tortenstücke, Balken. Am einfachsten über `useMemberList`.
 */
export function MemberListDialog({ title, subtitle, sets, error = null, guild, guildView, fixedGuild = false, onClose }: MemberListDialogProps) {
  const { t } = useSprache();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const loaded = useApi<GuildView>(guildView ? null : "/api/guild");
  const view = guildView ?? loaded.data;

  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (dialog && typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog?.setAttribute("open", "");
    }
    dialog?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => {
      if (dialog?.open && typeof dialog.close === "function") dialog.close();
      opener?.focus();
    };
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  }

  function onBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <dialog
      ref={ref}
      className="member-dialog"
      aria-labelledby={titleId}
      aria-modal="true"
      onKeyDown={onKeyDown}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={onBackdrop}
    >
      <div className="member-dialog-inner panel">
        <header className="member-dialog-header">
          <div>
            <h2 className="panel-title member-dialog-title" id={titleId}>
              {title}
            </h2>
            {subtitle && <p className="muted small member-dialog-subtitle">{subtitle}</p>}
          </div>
          <button type="button" className="member-dialog-close" onClick={onClose} aria-label={t(T.schliessen)} data-autofocus>
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <DataState loading={(!view && !loaded.error) || (sets === null && !error)} error={error ?? loaded.error}>
          {view && sets && (
            <MemberListBody sets={sets} guild={guild} guilds={fixedGuild ? [] : view.guilds} members={view.members} />
          )}
        </DataState>
      </div>
    </dialog>
  );
}

function MemberListBody({
  sets,
  guild,
  guilds,
  members,
}: {
  sets: MemberSet[];
  guild: string | null;
  guilds: GuildRef[];
  members: GuildView["members"];
}) {
  const { t } = useSprache();
  const [setKey, setSetKey] = useState(sets[0]?.key ?? "");
  const [guildSlug, setGuildSlug] = useState(guild);
  const [text, setText] = useState("");
  const set = sets.find((s) => s.key === setKey) ?? sets[0];
  const hasValue = set?.valueLabel != null;
  const [sort, setSort] = useState<{ key: MemberListSortKey; dir: "asc" | "desc" }>(
    hasValue ? { key: "value", dir: "desc" } : { key: "name", dir: "asc" },
  );
  const searchId = useId();
  const selectId = useId();

  const all = useMemo(() => resolveMembers(set?.entries ?? [], members, t(T.unbekannt)), [set, members, t]);
  const inGuild = useMemo(() => filterMemberList(all, guildSlug, ""), [all, guildSlug]);
  const shown = useMemo(
    () => sortMemberList(filterMemberList(inGuild, null, text), sort.key === "value" && !hasValue ? "name" : sort.key, sort.dir),
    [inGuild, text, sort, hasValue],
  );
  const searchable = inGuild.length >= MEMBER_SEARCH_FROM;

  const columns: { key: MemberListSortKey; label: string; num?: boolean; wide?: boolean }[] = [
    { key: "name", label: t(T.name) },
    { key: "className", label: t(T.klasse), wide: true },
    { key: "raceName", label: t(T.volk), wide: true },
    { key: "level", label: t(T.level), num: true },
    ...(hasValue ? [{ key: "value" as const, label: set!.valueLabel!, num: !set!.textValue }] : []),
  ];

  function sortBy(key: MemberListSortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: defaultDirection(key) }));
  }

  return (
    <>
      <div className="member-dialog-tools">
        <GuildFilter guilds={guilds} value={guildSlug} onChange={setGuildSlug} />
        {sets.length > 1 && (
          <label className="member-dialog-field" htmlFor={selectId}>
            <span className="member-dialog-field-label">{t(T.wert)}</span>
            <select
              id={selectId}
              className="filter-input"
              value={set?.key}
              onChange={(e) => {
                setSetKey(e.target.value);
                setSort({ key: "value", dir: "desc" });
              }}
            >
              {sets.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {searchable && (
          <label className="member-dialog-field" htmlFor={searchId}>
            <span className="sr-only">{t(T.suchen)}</span>
            <input
              id={searchId}
              type="search"
              className="filter-input"
              placeholder={t(T.suchePlatzhalter)}
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoComplete="off"
            />
          </label>
        )}
      </div>
      <p className="muted small member-dialog-count" role="status" aria-live="polite">
        {t(T.anzahl)(shown.length)}
      </p>
      {shown.length === 0 ? (
        <p className="muted">{inGuild.length === 0 ? t(T.keiner) : t(T.keinTreffer)}</p>
      ) : (
        <div className="member-dialog-scroll">
          <table className="table member-table" aria-label={set?.label ?? t(T.liste)}>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    className={`${c.num ? "num" : ""}${c.wide ? " member-col-wide" : ""}`}
                    aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                  >
                    <button type="button" className="sort-button" onClick={() => sortBy(c.key)} aria-label={t(T.sortieren)(c.label)}>
                      {c.label}
                      <SortMark active={sort.key === c.key} dir={sort.dir} />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className={set?.highlight?.ids.includes(r.id) ? "member-row-highlight" : undefined}>
                  <td>
                    <span className="member-name">
                      {r.known ? (
                        <CharacterLink
                          character={{ id: r.id, name: r.name, surname: null, slug: r.slug, classId: r.classId, former: r.former, guildSlug: r.guildSlug }}
                        />
                      ) : (
                        <span className="muted">{r.name}</span>
                      )}
                      {r.known && r.former && <span className="badge badge-muted member-former">{t(T.ehemalig)}</span>}
                      {set?.highlight?.ids.includes(r.id) && <span className="badge member-highlight">{set.highlight.label}</span>}
                    </span>
                    {r.known && (
                      <span className="member-narrow small">
                        <ClassName classId={r.classId} name={r.className} /> · {r.raceName}
                      </span>
                    )}
                  </td>
                  <td className="member-col-wide">{r.known ? <ClassName classId={r.classId} name={r.className} /> : null}</td>
                  <td className="member-col-wide">{r.raceName}</td>
                  <td className="num">{r.level ?? ""}</td>
                  {hasValue && (
                    <td className={set?.textValue ? "member-value-text" : "num"}>
                      {r.value === null ? "" : (set?.formatValue ?? fmt)(r.value)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function SortMark({ active, dir }: { active: boolean; dir: "asc" | "desc" }): ReactNode {
  if (!active) return null;
  return (
    <span className="member-sort-mark" aria-hidden="true">
      {dir === "asc" ? " ▲" : " ▼"}
    </span>
  );
}

/** Was ein Auslöser zum Öffnen braucht; `sets` darf null sein, wenn `load` die Mengen erst beim Öffnen holt. */
export interface MemberListRequest {
  title: string;
  subtitle?: string;
  sets: MemberSet[] | null;
  error?: ApiError | null;
  /** Mengen sind schon nach der Gilde der Seite gefiltert (siehe `MemberListDialogProps.fixedGuild`). */
  fixedGuild?: boolean;
}

/**
 * Zustand für einen Dialog: `open(request)` öffnet ihn, `dialog` rendert ihn an beliebiger Stelle.
 * Beispiel für ein Tortenstück: `onClick={() => list.open({ title: "Orcs", sets: [{ key: "orc", label: "Orcs", valueLabel: null, entries: ids }] })}`.
 */
export function useMemberList(guild: string | null, guildView?: GuildView | null) {
  const [request, setRequest] = useState<MemberListRequest | null>(null);
  const dialog = request ? (
    <MemberListDialog
      title={request.title}
      subtitle={request.subtitle}
      sets={request.sets}
      error={request.error}
      guild={guild}
      guildView={guildView}
      fixedGuild={request.fixedGuild}
      onClose={() => setRequest(null)}
    />
  ) : null;
  return { open: setRequest, close: () => setRequest(null), isOpen: request !== null, dialog };
}

/**
 * Erkennbarer Auslöser für eine Liste: kleiner Knopf mit Personen-Symbol, etwa "Alle 12 ansehen".
 * `aria-haspopup="dialog"` sagt Screenreadern, dass ein Dialog aufgeht.
 */
export function MemberListTrigger({
  onClick,
  children,
  label,
  className = "",
}: {
  onClick(): void;
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <button type="button" className={`member-trigger ${className}`.trim()} aria-haspopup="dialog" aria-label={label} onClick={onClick}>
      <PeopleIcon />
      <span>{children}</span>
    </button>
  );
}

export function PeopleIcon() {
  return (
    <svg className="member-trigger-icon" viewBox="0 0 20 16" aria-hidden="true">
      <circle cx="7" cy="4.5" r="3" fill="currentColor" />
      <path d="M1 15c0-3.6 2.7-6 6-6s6 2.4 6 6z" fill="currentColor" />
      <circle cx="14.5" cy="5" r="2.4" fill="currentColor" opacity="0.7" />
      <path d="M13.6 9.3c3 .1 5.4 2.3 5.4 5.7h-4.6c0-2.2-.3-4-.8-5.7z" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

/**
 * Kennzahl als klickbare Kachel (wie `.fun-fact`), die eine Mitgliederliste öffnet: ganze Kachel ist ein Knopf, mit
 * Personen-Symbol und "Alle ansehen", damit man sie sofort als klickbar erkennt. Ohne `onClick` eine normale Kachel.
 */
export function MemberFact({ label, value, onClick }: { label: string; value: ReactNode; onClick?: () => void }) {
  const { t } = useSprache();
  if (!onClick) {
    // Ohne Menge (etwa niemand auf Level 60) bleibt es eine reine Zahl.
    return (
      <li className="fun-fact">
        <span className="fun-fact-label">{label}</span>
        <strong className="fun-fact-value num">{value}</strong>
      </li>
    );
  }
  return (
    <li className="fun-fact fun-fact-clickable">
      <button type="button" className="fun-fact-button" aria-haspopup="dialog" onClick={onClick}>
        <span className="fun-fact-label">{label}</span>
        <strong className="fun-fact-value num">{value}</strong>
        <span className="member-hint small">
          <PeopleIcon />
          <span className="sr-only">{t(T.listeZu)(label)}, </span>
          {t(T.ansehen)}
        </span>
      </button>
    </li>
  );
}

/** "Alle ansehen" in der gewählten Sprache, für eigene Auslöser. */
export const ALLE_ANSEHEN: Fassungen = T.ansehen;
