import { berlinDate, isoWeek, shiftWeek, weekRange } from "../lib/time";
import type { ActivityWeek, GuildRecord } from "../model";
import type { JsonStore } from "../store";
import { guildRefs, memberGuild } from "./guild-view";
import type { ActivityView, MemberValue } from "./types";

export const ACTIVITY_WEEKS = 8;

/** Weeks for the heatmap: the current one and the `count - 1` before it, oldest first. */
export function activityWeeks(nowIso: string, count = ACTIVITY_WEEKS): string[] {
  const current = isoWeek(berlinDate(nowIso));
  return Array.from({ length: count }, (_, i) => shiftWeek(current, i - count + 1));
}

/** Sums the weeks into grids, once for everyone and once per guild. Guild from the current member list. */
export function buildActivityView(guild: GuildRecord, weeks: string[], records: (ActivityWeek | null)[]): ActivityView {
  const guilds = guildRefs(guild);
  const slugOf = new Map(guild.members.map((m) => [String(m.id), memberGuild(guild, m, guilds).slug]));
  const empty = () => ({ cells: new Array<number>(168).fill(0), ids: new Set<string>() });
  const all = empty();
  const byGuild = new Map(guilds.map((g) => [g.slug, empty()]));
  const logins = new Map<number, number>();

  for (const record of records) {
    if (!record) continue;
    for (const [id, hours] of Object.entries(record.characters)) {
      const slug = slugOf.get(id);
      if (slug === undefined) continue; // no longer known
      const targets = [all, byGuild.get(slug)].filter((t) => t !== undefined);
      const valid = hours.filter((h) => Number.isInteger(h) && h >= 0 && h < 168).length;
      logins.set(Number(id), (logins.get(Number(id)) ?? 0) + valid); // like `characters`: whoever shows up counts
      for (const target of targets) {
        target.ids.add(id);
        for (const h of hours) if (Number.isInteger(h) && h >= 0 && h < 168) target.cells[h]++;
      }
    }
  }
  const out = (t: ReturnType<typeof empty>) => ({ cells: t.cells, characters: t.ids.size });
  return {
    guilds,
    weeks,
    weeksWithData: records.filter((r) => r !== null && Object.keys(r.characters).length > 0).length,
    from: weekRange(weeks[0]).from,
    to: weekRange(weeks[weeks.length - 1]).to,
    all: out(all),
    byGuild: Object.fromEntries([...byGuild].map(([slug, t]) => [slug, out(t)])),
    logins: [...logins].map(([id, n]): MemberValue => [id, n]).sort((a, b) => b[1] - a[1] || a[0] - b[0]),
    testdaten: records.some((r) => r?.testdaten === true),
  };
}

export async function loadActivityView(store: JsonStore, guild: GuildRecord, nowIso: string): Promise<ActivityView> {
  const weeks = activityWeeks(nowIso);
  const records = await Promise.all(weeks.map((w) => store.get<ActivityWeek>(`activity/${w}`)));
  return buildActivityView(guild, weeks, records);
}
