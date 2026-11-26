import type { MemberSummary } from "../../src/model";
import type { GuildRosterEntry } from "../../src/collect/roster";

export function member(over: Partial<MemberSummary> & { id: number }): MemberSummary {
  return {
    name: `M${over.id}`, surname: null, slug: `m${over.id}`, rank: 1, level: 1, classId: 1, raceId: 2,
    hasProfile: false, former: false, firstSeenAt: "t0", leftAt: null, lastFetchedAt: null,
    equippedItemLevel: null, mainSpecName: null, professions: [],
    ...over,
  };
}

export function entry(over: Partial<GuildRosterEntry> & { id: number }): GuildRosterEntry {
  return {
    name: `M${over.id}`, surname: null, slug: `m${over.id}`, level: 1, classId: 1, raceId: 2, rank: 1, guildSlug: "bärenklaue",
    ...over,
  };
}
