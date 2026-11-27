import { compareWeeks } from "../lib/time";
import type { GuildRecord, MemberSummary, WeeklyIndex, WeeklyRecord } from "../model";
import type { JsonStore } from "../store";
import { titleDef, titleHolders } from "../weekly/titles";
import { memberGuild } from "./guild-view";
import type { CharacterRef, CharacterTitle } from "./types";

export function characterRef(guild: GuildRecord, m: MemberSummary): CharacterRef {
  return {
    id: m.id, name: m.name, surname: m.surname, slug: m.slug, classId: m.classId, former: m.former,
    guildSlug: memberGuild(guild, m).slug,
  };
}

/** Placeholder for characters that are no longer in the member list. */
export function unknownRef(id: number): CharacterRef {
  return { id, name: "Unbekannt", surname: null, slug: String(id), classId: 0, former: true, guildSlug: "" };
}

export function refOf(guild: GuildRecord, id: number): CharacterRef {
  const m = guild.members.find((x) => x.id === id);
  return m ? characterRef(guild, m) : unknownRef(id);
}

/** Evaluated weeks, ascending by their last day (old ISO weeks before the scoring weeks). */
export async function weeklyIndex(store: JsonStore): Promise<string[]> {
  return [...((await store.get<WeeklyIndex>("weekly/index"))?.weeks ?? [])].sort(compareWeeks);
}

export async function latestWeekly(store: JsonStore): Promise<WeeklyRecord | null> {
  const weeks = await weeklyIndex(store);
  const last = weeks[weeks.length - 1];
  return last ? store.get<WeeklyRecord>(`weekly/${last}`) : null;
}

/** Titles of a character from a weekly result, with the week's scored period; shared titles count for all holders. */
export function characterTitles(record: WeeklyRecord, characterId: number): CharacterTitle[] {
  const { week, from, to } = record;
  return record.titles
    .filter((a) => titleHolders(a).includes(characterId))
    .flatMap((a) => {
      const def = titleDef(a.titleId);
      return def ? [{ titleId: a.titleId, name: def.name, week, from, to, valueText: def.valueText(a.value) }] : [];
    });
}
