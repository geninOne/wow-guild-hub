import { useEffect, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import type { GuildRef, StatCardMembersView, StatCardView, StatEntryView, StatsPeriodKind, StatsView } from "../../../src/api/types";
import { useApi } from "../lib/api";
import { useLanguage, type Translations, type Language, translationIn } from "../lib/language";
import { classColor } from "../lib/wow";
import { CharacterLink } from "./CharacterLink";
import { FactionCrest } from "./FactionCrest";
import { VIEW_ALL, MemberListDialog, MemberListTrigger, type MemberSet } from "./MemberList";
import { numberLocale } from "../lib/format";

const fmt = (n: number) => n.toLocaleString(numberLocale());

const T = {
  honorFor: { de: "für", en: "for", schwaebisch: "für", bayrisch: "fia" },
  other: { de: "Sonstiges", en: "Other", schwaebisch: "Sonschtigs", bayrisch: "Sonstigs" },
  fish: { de: "Fisch", en: "fish", schwaebisch: "Fisch", bayrisch: "Fisch" },
  flame: { de: "Flamme", en: "flame", schwaebisch: "Flamm", bayrisch: "Flammerl" },
  together: { de: "Zusammen", en: "Together", schwaebisch: "Zamma", bayrisch: "Zamm" },
  friendlier: {
    de: (name: string, more: string, fewer: string) => `Freundlicher war ${name}: ${more} gegen ${fewer} Gesten.`,
    en: (name: string, more: string, fewer: string) => `${name} was friendlier: ${more} to ${fewer} emotes.`,
    schwaebisch: (name: string, more: string, fewer: string) => `Freundlicher war ${name}: ${more} gege ${fewer} Geschte.`,
    bayrisch: (name: string, more: string, fewer: string) => `Freindlicher war ${name}: ${more} gega ${fewer} Gestn.`,
  },
  tie: {
    de: (n: string) => `Unentschieden: beide ${n} Gesten.`,
    en: (n: string) => `It's a tie: ${n} emotes each.`,
    schwaebisch: (n: string) => `Unentschiede: beide ${n} Geschte. So isch's recht.`,
    bayrisch: (n: string) => `Unentschiedn: beide ${n} Gestn. Passt scho.`,
  },
  nobody: { de: "niemand", en: "nobody", schwaebisch: "koiner", bayrisch: "koana" },
  wanted: { de: "Gesucht", en: "Wanted", schwaebisch: "Gsucht", bayrisch: "Gsuacht" },
  more: {
    de: (n: string) => `und ${n} weitere`,
    en: (n: string) => `and ${n} more`,
    schwaebisch: (n: string) => `ond ${n} weitere`,
    bayrisch: (n: string) => `und ${n} weitere`,
  },
  victims: { de: "Opfer:", en: "Victims:", schwaebisch: "Opfer:", bayrisch: "Opfer:" },
  leading: { de: "vorne:", en: "leading:", schwaebisch: "vorna:", bayrisch: "vorn:" },
  average: {
    de: (n: string, what: string) => `Im Schnitt ${n} ${what} pro Charakter.`,
    en: (n: string, what: string) => `On average ${n} ${what} per character.`,
    schwaebisch: (n: string, what: string) => `Em Schnitt ${n} ${what} pro Charakter.`,
    bayrisch: (n: string, what: string) => `Im Schnitt ${n} ${what} pro Charakter, gell.`,
  },
  viewAllN: {
    de: (n: string) => `Alle ${n} ansehen`,
    en: (n: string) => `View all ${n}`,
    schwaebisch: (n: string) => `Älle ${n} aagucke`,
    bayrisch: (n: string) => `Olle ${n} oschaun`,
  },
  empty: {
    de: "Noch niemand. Wer traut sich?",
    en: "Nobody yet. Who dares?",
    schwaebisch: "No koiner. Wer traut sich?",
    bayrisch: "No koana. Wer traut si?",
  },
  topRanks: { de: (what: string) => `Spitzenreiter: ${what}`, en: (what: string) => `Top ranks: ${what}` },
  rank: { de: (n: number) => `Platz ${n}`, en: (n: number) => `Rank ${n}` },
  byCause: { de: (what: string) => `${what} nach Ursache`, en: (what: string) => `${what} by cause` },
  versus: { de: (a: string, b: string) => `${a} gegen ${b}`, en: (a: string, b: string) => `${a} versus ${b}` },
  chart: { de: (what: string) => `Hitparade: ${what}`, en: (what: string) => `Chart: ${what}` },
  percent: { de: (what: string, n: number) => `${what} ${n} Prozent`, en: (what: string, n: number) => `${what} ${n} percent` },
} satisfies Record<string, Translations<unknown>>;

/** English ordinal number: 1st, 2nd, 3rd, 4th, 11th, 21st. */
export function ordinalEn(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const suffix = ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}

/** Number with its unit in singular or plural; without a unit just the number. */
export function withUnit(value: number, unit: [string, string] | null): string {
  return unit ? `${fmt(value)} ${value === 1 ? unit[0] : unit[1]}` : fmt(value);
}

/** Label of a statistic: short name in the selected language, otherwise the official name. */
const labelIn = (language: Language) => (s: StatEntryView) => (s.short ? translationIn(s.short, language) : s.name);

/** Unit of a statistic in the selected language. */
const unitIn = (language: Language) => (s: StatEntryView) => (s.unit ? translationIn(s.unit, language) : null);

/** Label and unit in the current language. */
function useStatText() {
  const { t, language } = useLanguage();
  return { t, language, label: labelIn(language), unit: unitIn(language) };
}

/** Sequence number for staggered animations in CSS (`--i`). */
const idx = (i: number) => ({ "--i": i }) as CSSProperties;

function wantsMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Counts up from 0 to the value on appearance; with reduced motion the final value shows right away. */
function CountUp({ value, unit = null }: { value: number; unit?: [string, string] | null }) {
  const [shown, setShown] = useState(() => (wantsMotion() ? 0 : value));
  useEffect(() => {
    if (!wantsMotion()) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 1100);
      setShown(Math.round(value * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{withUnit(shown, unit)}</>;
}

const REST_COLOR = "#5b5547";

function Honor({ stat }: { stat: StatEntryView }) {
  const { t } = useLanguage();
  const first = stat.leaders[0];
  if (!stat.honor || !first) return null;
  return (
    <p className="stat-honor">
      <span className="stat-honor-badge">{t(stat.honor)}</span> {t(T.honorFor)} <CharacterLink character={first.character} />
    </p>
  );
}

function MiniLeaders({ stat, limit = 3 }: { stat: StatEntryView; limit?: number }) {
  const { t } = useLanguage();
  if (stat.leaders.length === 0) return null;
  return (
    <ol className="fun-mini-leaders" aria-label={t(T.topRanks)(stat.name)}>
      {stat.leaders.slice(0, limit).map((l, i) => (
        <li key={l.character.id}>
          <span className={`stat-rank stat-rank-${i + 1}`} aria-label={t(T.rank)(i + 1)}>
            {i + 1}
          </span>
          <CharacterLink character={l.character} />
          <span className="num muted">{fmt(l.value)}</span>
        </li>
      ))}
    </ol>
  );
}

/** Pie chart from SVG circles; `pathLength` 100 turns the dash lengths into percentages. */
function PieChart({ parts, label: ariaLabel }: { parts: { value: number; color: string }[]; label: string }) {
  const sum = parts.reduce((a, p) => a + p.value, 0) || 1;
  let offset = 0;
  const r = 8;
  const width = 16;
  return (
    <svg className="fun-pie" viewBox="0 0 42 42" role="img" aria-label={ariaLabel}>
      <circle cx="21" cy="21" r={r} fill="none" stroke={REST_COLOR} strokeWidth={width} opacity="0.35" />
      {parts.map((p, i) => {
        const share = (p.value / sum) * 100;
        const el = (
          <circle
            key={i}
            cx="21"
            cy="21"
            r={r}
            fill="none"
            stroke={p.color}
            strokeWidth={width}
            pathLength={100}
            strokeDasharray={`${share} ${100 - share}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 21 21)"
          />
        );
        offset += share;
        return el;
      })}
    </svg>
  );
}

/** Graveyard: total with the top three, below it one gravestone per cause, larger the more deaths. */
function GraveField({ card }: { card: StatCardView }) {
  const { t, label, unit } = useStatText();
  const [main, ...causes] = card.stats;
  const sorted = [...causes].sort((x, y) => y.total - x.total);
  const max = Math.max(1, ...sorted.map((s) => s.total));
  return (
    <div className="fun-graveyard">
      <div className="fun-graveyard-head">
        <strong className="fun-big num">
          <CountUp value={main.total} unit={unit(main)} />
        </strong>
        <MiniLeaders stat={main} />
        <Honor stat={main} />
      </div>
      <ul className="fun-graves-field" aria-label={t(T.byCause)(main.name)}>
        {sorted.map((s, i) => (
          <li key={s.id} className={`fun-gravestone${s.total === 0 ? " fun-gravestone-empty" : ""}`} style={idx(i)}>
            <span className="fun-gravestone-plot">
              <span className="fun-gravestone-stone" style={{ height: `${3.6 + Math.sqrt(s.total / max) * 5.4}rem` }}>
                <span className="fun-gravestone-cross" aria-hidden="true" />
                <strong className="num">{fmt(s.total)}</strong>
              </span>
            </span>
            <span className="fun-gravestone-label">{label(s)}</span>
            {s.honor && s.leaders[0] && (
              <span className="fun-gravestone-honor small">
                <span className="stat-honor-badge">{t(s.honor)}</span>
                <CharacterLink character={s.leaders[0].character} />
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const NICE = [1, 2, 5];

/** Smallest round step (1, 2, 5, 10, 20, 50 ...) that needs at most `max` icons. */
export function pictogramStep(total: number, max = 20): number {
  for (let exp = 0; ; exp++) {
    for (const n of NICE) {
      const step = n * 10 ** exp;
      if (Math.ceil(total / step) <= max) return step;
    }
  }
}

function FishIcon() {
  return (
    <svg viewBox="0 0 24 14" aria-hidden="true">
      <path d="M2 7c3-5 10-6 15-2l5-4v12l-5-4C12 13 5 12 2 7z" fill="currentColor" />
      <circle cx="6" cy="6" r="1" fill="#15171c" />
    </svg>
  );
}

function FlameIcon() {
  return (
    <svg viewBox="0 0 16 20" aria-hidden="true">
      <path d="M8 1c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 3-6 0 2 1 3 2 3 0-3-1-5 1-8z" fill="currentColor" />
    </svg>
  );
}

const SYMBOLS: Record<string, { icon: () => ReactNode; one: Translations }> = {
  fische: { icon: FishIcon, one: T.fish },
  lagerfeuer: { icon: FlameIcon, one: T.flame },
};

/** Pictogram row: one icon stands for a round step, the last one is only as full as the remainder. */
function Pictogram({ card }: { card: StatCardView }) {
  const { t, unit } = useStatText();
  const stat = card.stats[0];
  const u = unit(stat);
  const symbol = SYMBOLS[card.slug] ?? SYMBOLS.fische;
  const step = pictogramStep(stat.total);
  const full = Math.floor(stat.total / step);
  const part = (stat.total % step) / step;
  const Icon = symbol.icon;
  return (
    <>
      <strong className="fun-big num">
        <CountUp value={stat.total} unit={u} />
      </strong>
      <div className={`fun-pictos fun-pictos-${card.slug}`} role="img" aria-label={withUnit(stat.total, u)}>
        {Array.from({ length: full }, (_, i) => (
          <span key={i} className="fun-picto" style={idx(i)}>
            <Icon />
          </span>
        ))}
        {part > 0 && (
          <span className="fun-picto fun-picto-part" style={{ ...idx(full), "--o": 0.25 + part * 0.6 } as CSSProperties}>
            <Icon />
          </span>
        )}
      </div>
      {step > 1 && <p className="muted small">1 {t(symbol.one)} = {withUnit(step, u)}</p>}
      <Honor stat={stat} />
      <MiniLeaders stat={stat} />
    </>
  );
}

/** Scale: the heavier side sinks, by at most 14 degrees. */
function Scale({ card }: { card: StatCardView }) {
  const { label } = useStatText();
  const [left, right] = card.stats;
  const sum = left.total + right.total || 1;
  const tilt = ((right.total - left.total) / sum) * 14;
  return (
    <>
      <svg className="fun-scale" viewBox="0 0 200 110" role="img" aria-label={`${label(left)} ${left.total}, ${label(right)} ${right.total}`}>
        <path d="M100 26 L100 100 M80 104 H120" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <g className="fun-scale-swing">
        <g transform={`rotate(${tilt} 100 26)`}>
          <line x1="30" y1="26" x2="170" y2="26" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <g transform={`rotate(${-tilt} 30 26)`}>
            <path d="M30 26 L14 62 M30 26 L46 62" stroke="currentColor" strokeWidth="1" />
            <path d="M10 62 h40 a20 10 0 0 1 -40 0z" className="fun-scale-win" />
            <text x="30" y="88" textAnchor="middle" className="fun-scale-num">{fmt(left.total)}</text>
          </g>
          <g transform={`rotate(${-tilt} 170 26)`}>
            <path d="M170 26 L154 62 M170 26 L186 62" stroke="currentColor" strokeWidth="1" />
            <path d="M150 62 h40 a20 10 0 0 1 -40 0z" className="fun-scale-lose" />
            <text x="170" y="88" textAnchor="middle" className="fun-scale-num">{fmt(right.total)}</text>
          </g>
        </g>
        </g>
        <circle cx="100" cy="26" r="5" className="fun-scale-pivot" />
      </svg>
      <div className="fun-pair">
        <div>
          <p className="fun-pair-label">{label(left)}</p>
          <Honor stat={left} />
        </div>
        <div>
          <p className="fun-pair-label">{label(right)}</p>
          <Honor stat={right} />
        </div>
      </div>
    </>
  );
}

function convert(stat: StatEntryView, language: Language): string | null {
  if (!stat.conversion) return null;
  const value = stat.total / stat.conversion.per;
  const shown = value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
  const pair = translationIn(stat.conversion.unit, language);
  const unit = shown === 1 ? pair[0] : pair[1];
  return `${shown.toLocaleString(numberLocale())} ${unit}`;
}

/** Did you know? Each statistic converted into something tangible. */
function DidYouKnow({ card }: { card: StatCardView }) {
  const { t, language, unit } = useStatText();
  return (
    <ul className="fun-facts-list">
      {card.stats.map((s) => (
        <li key={s.id}>
          <strong className="fun-big num">{convert(s, language) ?? withUnit(s.total, unit(s))}</strong>
          <p className="muted small">
            {withUnit(s.total, unit(s))}
            {s.conversion ? `, ${t(s.conversion.text)}.` : "."}
          </p>
          <Honor stat={s} />
        </li>
      ))}
    </ul>
  );
}

/** Podium: rank 2 on the left, rank 1 in the middle and highest, rank 3 on the right. */
function Podium({ card }: { card: StatCardView }) {
  const { t, unit } = useStatText();
  const stat = card.stats[0];
  const places = [1, 0, 2].map((i) => ({ place: i + 1, leader: stat.leaders[i] })).filter((p) => p.leader);
  return (
    <>
      <ol className="fun-podium" aria-label={t(T.topRanks)(stat.name)}>
        {places.map(({ place, leader }) => (
          <li key={place} className={`fun-podium-step fun-podium-${place}`} style={{ order: place === 1 ? 2 : place === 2 ? 1 : 3 }}>
            <CharacterLink character={leader!.character} />
            <span className="num muted small">{fmt(leader!.value)}</span>
            <span className={`fun-podium-block stat-rank-${place}`} aria-label={t(T.rank)(place)} style={idx(4 - place)}>
              {place}
            </span>
          </li>
        ))}
      </ol>
      <p className="fun-podium-total">
        {t(T.together)} <strong className="num">{withUnit(stat.total, unit(stat))}</strong>
      </p>
      <Honor stat={stat} />
    </>
  );
}

/** Horde versus Alliance: opposing bars; with only one guild the chart of that guild. */
function FactionDuel({ card, guilds, filtered }: { card: StatCardView; guilds: GuildRef[]; filtered: boolean }) {
  const { t, label } = useStatText();
  if (filtered || guilds.length < 2) return <TopChart card={card} />;
  const [a, b] = guilds;
  const max = Math.max(1, ...card.stats.flatMap((s) => [s.perGuild[a.slug] ?? 0, s.perGuild[b.slug] ?? 0]));
  const sumA = card.stats.reduce((x, s) => x + (s.perGuild[a.slug] ?? 0), 0);
  const sumB = card.stats.reduce((x, s) => x + (s.perGuild[b.slug] ?? 0), 0);
  const winner = sumA === sumB ? null : sumA > sumB ? a : b;
  return (
    <>
      <div className="fun-duel-head">
        <span>
          <FactionCrest faction={a.faction} size={20} decorative /> {a.name}
        </span>
        <span>
          {b.name} <FactionCrest faction={b.faction} size={20} decorative />
        </span>
      </div>
      <ul className="fun-duel" aria-label={t(T.versus)(a.name, b.name)}>
        {card.stats.map((s, i) => {
          const va = s.perGuild[a.slug] ?? 0;
          const vb = s.perGuild[b.slug] ?? 0;
          return (
            <li key={s.id} className="fun-duel-row" style={idx(i)}>
              <span className="num fun-duel-num">{fmt(va)}</span>
              <span className="fun-duel-track fun-duel-left">
                <span className="fun-duel-bar" data-faction={a.faction} style={{ width: `${(va / max) * 100}%` }} />
              </span>
              <span className="fun-duel-label">{label(s)}</span>
              <span className="fun-duel-track">
                <span className="fun-duel-bar" data-faction={b.faction} style={{ width: `${(vb / max) * 100}%` }} />
              </span>
              <span className="num fun-duel-num">{fmt(vb)}</span>
            </li>
          );
        })}
      </ul>
      <p className="fun-duel-verdict">
        {winner
          ? t(T.friendlier)(winner.name, fmt(Math.max(sumA, sumB)), fmt(Math.min(sumA, sumB)))
          : t(T.tie)(fmt(sumA))}
      </p>
    </>
  );
}

function TopChart({ card }: { card: StatCardView }) {
  const { t, label } = useStatText();
  const sorted = [...card.stats].sort((x, y) => y.total - x.total);
  const max = Math.max(1, sorted[0]?.total ?? 0);
  return (
    <ol className="fun-hitparade" aria-label={t(T.chart)(t(card.title))}>
      {sorted.map((s, i) => (
        <li key={s.id} className="fun-hit" style={idx(i)}>
          <span className="fun-hit-rank num">{i + 1}.</span>
          <span className="fun-hit-label">{label(s)}</span>
          <span className="fun-hit-track">
            <span className="fun-hit-bar" style={{ width: `${(s.total / max) * 100}%` }} />
          </span>
          <span className="num">{fmt(s.total)}</span>
          <span className="fun-hit-who small">
            {s.leaders[0] ? <CharacterLink character={s.leaders[0].character} /> : <span className="muted">{t(T.nobody)}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Pie with shares in percent. */
function Pie({ card }: { card: StatCardView }) {
  const { t, label } = useStatText();
  const sum = card.stats.reduce((a, s) => a + s.total, 0) || 1;
  const colors = ["#f2c95a", "#c77dff", "#3fb58a", "#e0393f"];
  return (
    <div className="fun-pie-wrap">
      <PieChart
        parts={card.stats.map((s, i) => ({ value: s.total, color: colors[i % colors.length] }))}
        label={card.stats.map((s) => t(T.percent)(label(s), Math.round((s.total / sum) * 100))).join(", ")}
      />
      <ul className="fun-legend">
        {card.stats.map((s, i) => (
          <li key={s.id}>
            <span className="fun-dot" style={{ background: colors[i % colors.length] }} aria-hidden="true" />
            <span>
              <strong className="num">{Math.round((s.total / sum) * 100)} %</strong> {label(s)}
            </span>
            <span className="num muted">{fmt(s.total)}</span>
            <span className="fun-legend-honor">
              <Honor stat={s} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Big number with a saying and a small ranking. */
function BigNumber({ card }: { card: StatCardView }) {
  const { label, unit } = useStatText();
  const stat = card.stats[0];
  const u = unit(stat);
  return (
    <>
      <strong className="fun-big fun-huge num">
        <CountUp value={stat.total} />
      </strong>
      <p className="fun-unit">{u ? (stat.total === 1 ? u[0] : u[1]) : label(stat)}</p>
      {card.stats[1] && <Ratio part={stat} whole={card.stats[1]} />}
      <Honor stat={stat} />
      <MiniLeaders stat={stat} />
    </>
  );
}

function Bottle({ fill, color }: { fill: number; color: string }) {
  const top = 20 + (1 - fill) * 52;
  return (
    <svg className="fun-bottle" viewBox="0 0 40 80" aria-hidden="true">
      <defs>
        <clipPath id={`flasche-${color.slice(1)}`}>
          <path d="M15 4h10v16c8 3 12 10 12 20v30a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6V40c0-10 4-17 12-20z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#flasche-${color.slice(1)})`}>
        <rect className="fun-bottle-liquid" x="0" y={top} width="40" height={80 - top} fill={color} />
      </g>
      <path
        d="M15 4h10v16c8 3 12 10 12 20v30a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6V40c0-10 4-17 12-20z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect x="13" y="1" width="14" height="5" rx="1.5" fill="#8a6420" />
    </svg>
  );
}

/** Two little bottles, filled in proportion to their values. */
function Bottles({ card }: { card: StatCardView }) {
  const { label } = useStatText();
  const colors = ["#e0393f", "#2f6ae0", "#3fb58a"];
  const max = Math.max(1, ...card.stats.map((s) => s.total));
  return (
    <div className="fun-bottles">
      {card.stats.map((s, i) => (
        <div key={s.id} className="fun-bottle-col">
          <Bottle fill={s.total / max} color={colors[i % colors.length]} />
          <strong className="num">{fmt(s.total)}</strong>
          <span className="small">{label(s)}</span>
          <Honor stat={s} />
        </div>
      ))}
    </div>
  );
}

/** Timetable: travel modes as stops on a line. */
function Timetable({ card, characters }: { card: StatCardView; characters: number }) {
  const { t, label, unit } = useStatText();
  const first = card.stats[0];
  const u = unit(first);
  return (
    <>
      <ol className="fun-route">
        {card.stats.map((s, i) => (
          <li key={s.id} className="fun-stop" style={idx(i)}>
            <span className="fun-stop-dot" aria-hidden="true" />
            <strong className="num">{fmt(s.total)}</strong>
            <span className="small">{label(s)}</span>
            {s.leaders[0] && (
              <span className="muted small">
                {t(T.leading)} <CharacterLink character={s.leaders[0].character} />
              </span>
            )}
          </li>
        ))}
      </ol>
      {characters > 0 && first.total > 0 && (
        <p className="muted small">
          {t(T.average)((first.total / characters).toLocaleString(numberLocale(), { maximumFractionDigits: 1 }), u ? u[1] : label(first))}
        </p>
      )}
      <Honor stat={first} />
    </>
  );
}

const N = {
  trash: {
    de: (every: number, noun: string) => (every === 1 ? `Jede ${noun} landet im Papierkorb.` : `Jede ${every}. ${noun} landet im Papierkorb.`),
    en: (every: number, noun: string) => (every === 1 ? `Every ${noun} ends up in the trash.` : `Every ${ordinalEn(every)} ${noun} ends up in the trash.`),
    schwaebisch: (every: number, noun: string) => (every === 1 ? `Jede ${noun} landet im Papierkorb.` : `Jede ${every}. ${noun} landet im Papierkorb.`),
    bayrisch: (every: number, noun: string) => (every === 1 ? `Jede ${noun} landt im Papierkorb.` : `Jede ${every}. ${noun} landt im Papierkorb.`),
  },
  completed: { de: "erledigt", en: "completed", schwaebisch: "erledigt", bayrisch: "erledigt" },
  onFoot: { de: "laufen zu Fuß", en: "on foot", schwaebisch: "laufet z'Fuß", bayrisch: "genga z'Fuaß" },
  inTheSaddle: { de: "hoch zu Ross", en: "in the saddle", schwaebisch: "hoch zu Ross", bayrisch: "hoch zu Ross" },
  symbol: {
    de: (n: string) => `1 Symbol = ${n} Charaktere`,
    en: (n: string) => `1 icon = ${n} characters`,
    schwaebisch: (n: string) => `1 Symbol = ${n} Charakter`,
    bayrisch: (n: string) => `1 Symbol = ${n} Charaktere`,
  },
  aMere: { de: "In der ganzen Gilde gerade einmal", en: "In the whole guild, a mere", schwaebisch: "In dr ganze Gilde grad mal", bayrisch: "In da ganzn Gilde grad amoi" },
  forExample: { de: "zum Beispiel bei", en: "for example", schwaebisch: "zum Beispiel bei", bayrisch: "zum Beispiel bei" },
  into: { de: "hinein", en: "in", schwaebisch: "nei", bayrisch: "eini" },
  out: { de: "heraus", en: "out", schwaebisch: "raus", bayrisch: "ausse" },
  average: {
    de: (n: string) => `Im Schnitt ${n} Materialien pro Teil.`,
    en: (n: string) => `On average ${n} materials per item.`,
    schwaebisch: (n: string) => `Im Schnitt ${n} Materialie pro Teil.`,
    bayrisch: (n: string) => `Im Schnitt ${n} Materialien pro Trumm.`,
  },
} satisfies Record<string, Translations<unknown>>;

/** "Jede 14. Quest": how often the first value occurs relative to the second. */
function Ratio({ part, whole }: { part: StatEntryView; whole: StatEntryView }) {
  const { t, label, unit } = useStatText();
  if (part.total === 0 || whole.total === 0) return null;
  const every = Math.max(1, Math.round(whole.total / part.total));
  const u = unit(part);
  const noun = u ? u[0] : label(part);
  return (
    <p className="fun-ratio">
      {t(N.trash)(every, noun)}{" "}
      <span className="muted small">
        ({withUnit(whole.total, unit(whole))} {t(N.completed)})
      </span>
    </p>
  );
}

/** ECG: one heartbeat per statistic, as high as its value, in class color. */
function Heartbeat({ card }: { card: StatCardView }) {
  const { t, label } = useStatText();
  const stats = card.stats;
  const max = Math.max(1, ...stats.map((s) => s.total));
  const width = 100 * stats.length;
  const base = 92;
  return (
    <>
      <svg className="fun-ekg" viewBox={`0 0 ${width} 124`} role="img" aria-label={stats.map((s) => `${label(s)} ${s.total}`).join(", ")}>
        {stats.map((s, i) => {
          const x = i * 100;
          const h = 8 + (s.total / max) * 58;
          const color = s.classId ? classColor(s.classId) : "#3fb58a";
          return (
            <g key={s.id} className="fun-ekg-beat" style={idx(i)}>
              <path
                pathLength={1}
                d={`M${x} ${base} H${x + 30} l6 6 l8 ${-h - 6} l8 ${h + 16} l6 -10 l5 -6 H${x + 100}`}
                fill="none"
                stroke={color}
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <text x={x + 44} y={base - h - 12} textAnchor="middle" className="fun-ekg-num">
                {fmt(s.total)}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="fun-ekg-labels" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
        {stats.map((s) => (
          <li key={s.id}>
            <span style={{ color: s.classId ? classColor(s.classId) : undefined }}>{label(s)}</span>
            {s.honor && s.leaders[0] && (
              <span className="small">
                <span className="stat-honor-badge">{t(s.honor)}</span>
                <CharacterLink character={s.leaders[0].character} />
              </span>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function HorseIcon() {
  return (
    <svg viewBox="0 0 24 20" aria-hidden="true">
      <path d="M4 19l1-7c-2-1-3-3-2-5l4 1 3-3 5 1 3-4 1 3 3 2-1 2-3-1-1 4 1 7h-2l-1-5-6 1-1 4H4z" fill="currentColor" />
    </svg>
  );
}

function BootIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M6 1h6v10l6 3v4H2v-4l4-2z" fill="currentColor" />
    </svg>
  );
}

/** Stable: how many characters ride and how many walk, plus rare treasures. */
function Stable({ card, characters }: { card: StatCardView; characters: number }) {
  const { t, unit } = useStatText();
  const [mounts, ...extras] = card.stats;
  const riders = mounts.holders;
  const walkers = Math.max(0, characters - riders);
  const per = pictogramStep(Math.max(riders, walkers), 12);
  const icons = (n: number) => Math.ceil(n / per);
  return (
    <>
      <div className="fun-stable">
        <div>
          <strong className="fun-big num">
            <CountUp value={walkers} />
          </strong>
          <p className="small">{t(N.onFoot)}</p>
          <div className="fun-pictos fun-pictos-boots" aria-hidden="true">
            {Array.from({ length: icons(walkers) }, (_, i) => (
              <span key={i} className="fun-picto" style={idx(i)}>
                <BootIcon />
              </span>
            ))}
          </div>
        </div>
        <div>
          <strong className="fun-big num">
            <CountUp value={riders} />
          </strong>
          <p className="small">{t(N.inTheSaddle)}</p>
          <div className="fun-pictos fun-pictos-horses" aria-hidden="true">
            {Array.from({ length: icons(riders) }, (_, i) => (
              <span key={i} className="fun-picto" style={idx(i)}>
                <HorseIcon />
              </span>
            ))}
          </div>
        </div>
      </div>
      {per > 1 && <p className="muted small">{t(N.symbol)(fmt(per))}</p>}
      <ul className="fun-rarities">
        {extras.map((s) => (
          <li key={s.id}>
            {t(N.aMere)} <strong className="num">{withUnit(s.sum, unit(s))}</strong>
            {s.leaders[0] && (
              <span className="muted small">
                {" "}
                ({t(N.forExample)} <CharacterLink character={s.leaders[0].character} />)
              </span>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Shredder: items go in at the top, materials come out at the bottom. */
function Shredder({ card }: { card: StatCardView }) {
  const { t, unit } = useStatText();
  const [items, mats] = card.stats;
  const per = items.total > 0 && mats ? mats.total / items.total : 0;
  return (
    <>
      <div className="fun-shredder">
        <p className="fun-shredder-in">
          <strong className="num">{withUnit(items.total, unit(items))}</strong> {t(N.into)}
        </p>
        <svg viewBox="0 0 120 90" aria-hidden="true" className="fun-shredder-svg">
          <rect x="44" y="2" width="32" height="24" rx="3" className="fun-shredder-item" />
          <path d="M60 8l4 6-4 6-4-6z" className="fun-shredder-gem" />
          <rect x="14" y="28" width="92" height="26" rx="6" className="fun-shredder-body" />
          <rect x="30" y="38" width="60" height="5" rx="2" className="fun-shredder-slot" />
          {[24, 36, 48, 60, 72, 84, 96].map((x, i) => (
            <circle key={x} cx={x} cy={64 + (i % 3) * 8} r={i % 2 ? 2.5 : 3.5} className="fun-shredder-dust" style={idx(i)} />
          ))}
        </svg>
        {mats && (
          <p className="fun-shredder-out">
            <strong className="num">{withUnit(mats.total, unit(mats))}</strong> {t(N.out)}
          </p>
        )}
      </div>
      {per > 0 && (
        <p className="muted small">
          {t(N.average)(per.toLocaleString(numberLocale(), { maximumFractionDigits: 1 }))}
        </p>
      )}
      <Honor stat={items} />
    </>
  );
}

function MinsterIcon() {
  return (
    <svg viewBox="0 0 12 30" aria-hidden="true">
      <path d="M6 0l2 9h1v6h2v15H1V15h2V9h1z" fill="currentColor" />
    </svg>
  );
}

/** Bandage roll: bandages as gauze, converted into church spires, plus the healthstones. */
function Bandage({ card }: { card: StatCardView }) {
  const { t, language, label, unit } = useStatText();
  const [bandages, ...rest] = card.stats;
  const minsters = bandages.conversion ? bandages.total / bandages.conversion.per : 0;
  const shown = Math.min(30, Math.round(minsters));
  return (
    <div className="fun-bandage">
      <div>
        <strong className="fun-big num">{convert(bandages, language) ?? withUnit(bandages.total, unit(bandages))}</strong>
        <p className="muted small">
          {withUnit(bandages.total, unit(bandages))}
          {bandages.conversion ? `, ${t(bandages.conversion.text)}.` : "."}
        </p>
        {shown > 0 && (
          <div className="fun-pictos fun-pictos-minster" aria-hidden="true">
            {Array.from({ length: shown }, (_, i) => (
              <span key={i} className="fun-picto" style={idx(i)}>
                <MinsterIcon />
              </span>
            ))}
          </div>
        )}
        <div className="fun-bandage-strip" aria-hidden="true" />
        <Honor stat={bandages} />
      </div>
      {rest.map((s) => (
        <div key={s.id} className="fun-bandage-side">
          <strong className="fun-big num">{fmt(s.total)}</strong>
          <p className="small">{label(s)}</p>
          <Honor stat={s} />
          <MiniLeaders stat={s} />
        </div>
      ))}
    </div>
  );
}

function CardBody({ card, view }: { card: StatCardView; view: StatsView }) {
  switch (card.form) {
    case "grabsteinfeld":
      return <GraveField card={card} />;
    case "piktogramm":
      return <Pictogram card={card} />;
    case "waage":
      return <Scale card={card} />;
    case "wusstest-du":
      return <DidYouKnow card={card} />;
    case "podium":
      return <Podium card={card} />;
    case "fraktionsduell":
      return <FactionDuel card={card} guilds={view.guilds} filtered={view.guild !== null} />;
    case "torte":
      return <Pie card={card} />;
    case "flaeschle":
      return <Bottles card={card} />;
    case "fahrplan":
      return <Timetable card={card} characters={view.characters} />;
    case "ekg":
      return <Heartbeat card={card} />;
    case "stall":
      return <Stable card={card} characters={view.characters} />;
    case "schredder":
      return <Shredder card={card} />;
    case "verband":
      return <Bandage card={card} />;
    default:
      return <BigNumber card={card} />;
  }
}

/** Path for the members behind a card, matching the view's period (always all guilds). */
export function statMembersPath(view: Pick<StatsView, "kind" | "id">, slug: string): string {
  return `${statsBase(view.kind, view.id)}?card=${encodeURIComponent(slug)}`;
}

/** English API path segment for the period kind of a stats view (the kind values themselves stay German). */
const PERIOD_SEGMENT: Record<StatsPeriodKind, string> = { gesamt: "", woche: "week", monat: "month" };

/** API path of a stats view without query: `/api/stats`, `/api/stats/week[/<saturday>]`, `/api/stats/month[/<month>]`. */
export function statsBase(kind: StatsPeriodKind, id: string | null): string {
  if (kind === "gesamt") return "/api/stats";
  return id ? `/api/stats/${PERIOD_SEGMENT[kind]}/${id}` : `/api/stats/${PERIOD_SEGMENT[kind]}`;
}

/**
 * Sets for a card's member list: one set per statistic, labeled as on the card, value column with the
 * plural unit (otherwise the statistic's name). Statistics without an answer are dropped.
 */
export function statMemberSets(card: StatCardView, data: StatCardMembersView, language: Language): MemberSet[] {
  const label = labelIn(language);
  const unit = unitIn(language);
  return card.stats.flatMap((s): MemberSet[] => {
    const found = data.stats.find((d) => d.id === s.id);
    if (!found) return [];
    const u = unit(s);
    return [{ key: String(s.id), label: label(s), valueLabel: u ? u[1] : label(s), entries: found.entries }];
  });
}

/** Loads a card's members only on opening and shows them in the dialog. */
function StatCardMembers({ card, view, subtitle, onClose }: { card: StatCardView; view: StatsView; subtitle?: string; onClose(): void }) {
  const { t, language } = useLanguage();
  const { data, error } = useApi<StatCardMembersView>(statMembersPath(view, card.slug));
  return (
    <MemberListDialog
      title={t(card.title)}
      subtitle={subtitle}
      sets={data ? statMemberSets(card, data, language) : null}
      error={error}
      guild={view.guild}
      onClose={onClose}
    />
  );
}

/** A click anywhere on the card opens the list, except on links and buttons inside it. */
function onCardClick(open: () => void) {
  return (event: MouseEvent<HTMLElement>) => {
    if (event.target instanceof Element && event.target.closest("a, button, select, input, summary")) return;
    if (window.getSelection?.()?.toString()) return;
    open();
  };
}

/**
 * Wall of curiosities: each card in its own form, empty cards with an invitation. Cards with values can be
 * clicked and show all members behind them; keyboard via the "Alle n ansehen" button.
 */
export function StatWall({ view, subtitle }: { view: StatsView; subtitle?: string }) {
  const { t } = useLanguage();
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const openCard = view.cards.find((c) => c.slug === openSlug) ?? null;
  return (
    <>
      <ul className="fun-wall">
        {view.cards.map((card, i) => {
          const empty = card.stats.every((s) => s.total === 0);
          // A count only when the first set covers everyone: one statistic, total first (gravestones) or the stable.
          const counted = card.stats.length === 1 || card.form === "grabsteinfeld" || card.form === "stall";
          const holders = card.form === "stall" ? view.characters : (card.stats[0]?.holders ?? 0);
          const triggerText = counted ? t(T.viewAllN)(fmt(holders)) : t(VIEW_ALL);
          const clickable = !empty && card.stats.some((s) => s.holders > 0);
          return (
            <li
              key={card.slug}
              className={`fun-card fun-card-${card.form}${card.span > 1 ? ` fun-card-span-${card.span}` : ""}${empty ? " fun-card-empty" : ""}${clickable ? " fun-card-clickable" : ""}`}
              aria-labelledby={`karte-${card.slug}`}
              style={idx(i)}
              onClick={clickable ? onCardClick(() => setOpenSlug(card.slug)) : undefined}
            >
              <header className="fun-card-header">
                <h3 className="fun-card-title" id={`karte-${card.slug}`}>
                  {t(card.title)}
                </h3>
                {card.blurb && <p className="fun-card-blurb">{t(card.blurb)}</p>}
              </header>
              {empty ? <p className="muted">{t(T.empty)}</p> : <CardBody card={card} view={view} />}
              {clickable && (
                <MemberListTrigger
                  className="fun-card-trigger"
                  label={`${triggerText}: ${t(card.title)}`}
                  onClick={() => setOpenSlug(card.slug)}
                >
                  {triggerText}
                </MemberListTrigger>
              )}
            </li>
          );
        })}
      </ul>
      {openCard && <StatCardMembers card={openCard} view={view} subtitle={subtitle} onClose={() => setOpenSlug(null)} />}
    </>
  );
}
