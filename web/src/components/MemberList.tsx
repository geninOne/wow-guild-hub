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
  close: { de: "Schließen", en: "Close", schwaebisch: "Zumache", bayrisch: "Zuamacha" },
  search: { de: "Nach Namen suchen", en: "Search by name", schwaebisch: "Nach Name sucha", bayrisch: "Nach Nama suacha" },
  searchPlaceholder: { de: "Name …", en: "Name …", schwaebisch: "Name …", bayrisch: "Nama …" },
  value: { de: "Wert", en: "Value", schwaebisch: "Wert", bayrisch: "Wert" },
  name: { de: "Name", en: "Name", schwaebisch: "Name", bayrisch: "Nama" },
  class: { de: "Klasse", en: "Class", schwaebisch: "Klass", bayrisch: "Klass" },
  race: { de: "Volk", en: "Race", schwaebisch: "Volk", bayrisch: "Voik" },
  level: { de: "Level", en: "Level", schwaebisch: "Level", bayrisch: "Level" },
  unknown: { de: "Unbekannt", en: "Unknown", schwaebisch: "Unbekannt", bayrisch: "Unbekannt" },
  former: { de: "ehemalig", en: "former", schwaebisch: "ehemalig", bayrisch: "ehemalig" },
  nobody: {
    de: "Hier steht niemand drin.",
    en: "Nobody here.",
    schwaebisch: "Do stoht koiner drin.",
    bayrisch: "Do steht koana drin.",
  },
  noMatch: {
    de: "Kein Name passt zur Suche.",
    en: "No name matches the search.",
    schwaebisch: "Koi Name passt zur Such.",
    bayrisch: "Koa Nama passt zur Suach.",
  },
  count: {
    de: (n: number) => (n === 1 ? "1 Mitglied" : `${n} Mitglieder`),
    en: (n: number) => (n === 1 ? "1 member" : `${n} members`),
    schwaebisch: (n: number) => (n === 1 ? "1 Mitglied" : `${n} Mitglieder`),
    bayrisch: (n: number) => (n === 1 ? "1 Mitglied" : `${n} Mitglieder`),
  },
  sortBy: {
    de: (column: string) => `Nach ${column} sortieren`,
    en: (column: string) => `Sort by ${column}`,
    schwaebisch: (column: string) => `Nach ${column} sortiera`,
    bayrisch: (column: string) => `Nach ${column} sortiern`,
  },
  list: { de: "Mitgliederliste", en: "Member list", schwaebisch: "Mitgliederlischt", bayrisch: "Mitgliederlistn" },
  viewAll: { de: "Alle ansehen", en: "View all", schwaebisch: "Älle aagucke", bayrisch: "Olle oschaun" },
  listOf: {
    de: (what: string) => `Liste: ${what}`,
    en: (what: string) => `List: ${what}`,
    schwaebisch: (what: string) => `Lischt: ${what}`,
    bayrisch: (what: string) => `Listn: ${what}`,
  },
} satisfies Record<string, Fassungen<unknown>>;

const fmt = (n: number) => n.toLocaleString(numberLocale());

/** A set of members with a label and value column; the dialog can switch between several sets. */
export interface MemberSet {
  key: string;
  /** Name of the set in the picker, e.g. "Tode durch Stürze". */
  label: string;
  /** Heading of the value column; null without a value column. */
  valueLabel: string | null;
  entries: readonly MemberEntry[];
  /** How values are shown, e.g. as a date; the default is numbers with thousands separators. */
  formatValue?: (value: number) => string;
  /** Values are text (e.g. "7 Tode"): left-aligned instead of as a number. */
  textValue?: boolean;
  /** Highlighted members, e.g. all holders of a title, with a short badge. */
  highlight?: { ids: number[]; label: string };
}

export interface MemberListDialogProps {
  /** Heading of the dialog, e.g. the card title. */
  title: string;
  /** Subtitle, e.g. the period. */
  subtitle?: string;
  /** Sets to show; null while they are still loading. */
  sets: MemberSet[] | null;
  /** Error while loading the sets. */
  error?: ApiError | null;
  /** Initially selected guild (the page's Horde/Alliance switcher), null for all. */
  guild: string | null;
  /** Already loaded member data; without it the dialog loads `/api/guild` itself. */
  guildView?: GuildView | null;
  /** true when the sets are already filtered by guild; the dialog then has no switcher of its own. */
  fixedGuild?: boolean;
  onClose(): void;
}

/**
 * Dialog with the member list behind a number: name (to the character page), class in class color, race, level and
 * the card's value. Sortable, with search from 15 entries, with its own guild switcher that starts with the page's
 * choice. Escape, the close button and a click outside close it; focus returns to the trigger.
 * Reusable from anywhere: cards, pie slices, bars. Easiest via `useMemberList`.
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
          <button type="button" className="member-dialog-close" onClick={onClose} aria-label={t(T.close)} data-autofocus>
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

  const all = useMemo(() => resolveMembers(set?.entries ?? [], members, t(T.unknown)), [set, members, t]);
  const inGuild = useMemo(() => filterMemberList(all, guildSlug, ""), [all, guildSlug]);
  const shown = useMemo(
    () => sortMemberList(filterMemberList(inGuild, null, text), sort.key === "value" && !hasValue ? "name" : sort.key, sort.dir),
    [inGuild, text, sort, hasValue],
  );
  const searchable = inGuild.length >= MEMBER_SEARCH_FROM;

  const columns: { key: MemberListSortKey; label: string; num?: boolean; wide?: boolean }[] = [
    { key: "name", label: t(T.name) },
    { key: "className", label: t(T.class), wide: true },
    { key: "raceName", label: t(T.race), wide: true },
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
            <span className="member-dialog-field-label">{t(T.value)}</span>
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
            <span className="sr-only">{t(T.search)}</span>
            <input
              id={searchId}
              type="search"
              className="filter-input"
              placeholder={t(T.searchPlaceholder)}
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoComplete="off"
            />
          </label>
        )}
      </div>
      <p className="muted small member-dialog-count" role="status" aria-live="polite">
        {t(T.count)(shown.length)}
      </p>
      {shown.length === 0 ? (
        <p className="muted">{inGuild.length === 0 ? t(T.nobody) : t(T.noMatch)}</p>
      ) : (
        <div className="member-dialog-scroll">
          <table className="table member-table" aria-label={set?.label ?? t(T.list)}>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    className={`${c.num ? "num" : ""}${c.wide ? " member-col-wide" : ""}`}
                    aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                  >
                    <button type="button" className="sort-button" onClick={() => sortBy(c.key)} aria-label={t(T.sortBy)(c.label)}>
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
                      {r.known && r.former && <span className="badge badge-muted member-former">{t(T.former)}</span>}
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

/** What a trigger needs to open the dialog; `sets` may be null when `load` fetches the sets only on opening. */
export interface MemberListRequest {
  title: string;
  subtitle?: string;
  sets: MemberSet[] | null;
  error?: ApiError | null;
  /** Sets are already filtered by the page's guild (see `MemberListDialogProps.fixedGuild`). */
  fixedGuild?: boolean;
}

/**
 * State for one dialog: `open(request)` opens it, `dialog` renders it anywhere.
 * Example for a pie slice: `onClick={() => list.open({ title: "Orcs", sets: [{ key: "orc", label: "Orcs", valueLabel: null, entries: ids }] })}`.
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
 * Recognizable trigger for a list: small button with a people icon, e.g. "Alle 12 ansehen".
 * `aria-haspopup="dialog"` tells screen readers that a dialog opens.
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
 * Key figure as a clickable tile (like `.fun-fact`) that opens a member list: the whole tile is a button, with a
 * people icon and "Alle ansehen", so it is immediately recognizable as clickable. Without `onClick` a plain tile.
 */
export function MemberFact({ label, value, onClick }: { label: string; value: ReactNode; onClick?: () => void }) {
  const { t } = useSprache();
  if (!onClick) {
    // Without a set (e.g. nobody at level 60) it stays a plain number.
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
          <span className="sr-only">{t(T.listOf)(label)}, </span>
          {t(T.viewAll)}
        </span>
      </button>
    </li>
  );
}

/** "Alle ansehen" in the selected language, for custom triggers. */
export const VIEW_ALL: Fassungen = T.viewAll;
