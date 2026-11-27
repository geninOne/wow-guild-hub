import type { GuildRecord, WeeklyRecord } from "../model";
import type { JsonStore } from "../store";
import { TITLES, titleDef, titleHolders } from "../weekly/titles";
import { refOf, weeklyIndex } from "./fun-common";
import { guildRefs } from "./guild-view";
import type { MemberValue, TitleRankingView, TitlesView, TitleWeekView } from "./types";

export const TITLE_HISTORY_WEEKS = 8;

function weekView(guild: GuildRecord, record: WeeklyRecord): TitleWeekView {
  return {
    week: record.week,
    from: record.from,
    to: record.to,
    awards: record.titles.flatMap((a) => {
      const def = titleDef(a.titleId);
      if (!def) return [];
      return [{
        titleId: a.titleId, name: def.name, description: def.description, value: a.value,
        valueText: def.valueText(a.value), character: refOf(guild, a.characterId),
        sharedWith: titleHolders(a).length - 1,
      }];
    }),
    ranked: record.rankings !== undefined,
  };
}

/** Weekly results, newest first. */
export function buildTitlesView(guild: GuildRecord, records: WeeklyRecord[]): TitlesView {
  const views = records.map((r) => weekView(guild, r));
  return {
    guilds: guildRefs(guild),
    titles: TITLES.map(({ id, name, description }) => ({ id, name, description })),
    current: views[0] ?? null,
    history: views.slice(1),
    testdaten: records.some((r) => r.testdaten === true),
  };
}

export async function loadTitlesView(store: JsonStore, guild: GuildRecord): Promise<TitlesView> {
  const weeks = (await weeklyIndex(store)).slice(-(TITLE_HISTORY_WEEKS + 1)).reverse();
  const records = await Promise.all(weeks.map((w) => store.get<WeeklyRecord>(`weekly/${w}`)));
  return buildTitlesView(guild, records.filter((r): r is WeeklyRecord => r !== null));
}

/** Ranking of a title in a week; without a stored ranking (old weeks) only the holders. */
export function buildTitleRanking(record: WeeklyRecord, titleId: string): TitleRankingView | null {
  const def = titleDef(titleId);
  if (!def) return null;
  const award = record.titles.find((a) => a.titleId === titleId) ?? null;
  const stored = record.rankings?.[titleId];
  const entries: MemberValue[] = stored
    ? stored.map(([id, value]): MemberValue => [id, value])
    : award
      ? titleHolders(award).map((id): MemberValue => [id, award.value])
      : [];
  const valueTexts = Object.fromEntries([...new Set(entries.map(([, v]) => v))].map((v) => [String(v), def.valueText(v)]));
  return {
    titleId, week: record.week, from: record.from, to: record.to, winnerIds: award ? titleHolders(award) : [], entries, valueTexts,
    complete: record.rankings !== undefined,
  };
}

export async function loadTitleRanking(store: JsonStore, titleId: string, week: string): Promise<TitleRankingView | null> {
  if (!titleDef(titleId)) return null;
  const record = await store.get<WeeklyRecord>(`weekly/${week}`);
  return record ? buildTitleRanking(record, titleId) : null;
}
