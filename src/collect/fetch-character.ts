import { BlizzardError, type ApiResult, type BlizzardClient } from "../blizzard/client";
import type { CharacterRecord } from "../model";
import { buildCharacterRecord, type CharacterParts, type RosterEntry } from "../transform/character";

const PARTS = {
  specializations: "/specializations",
  equipment: "/equipment",
  media: "/character-media",
  professions: "/professions",
  raids: "/encounters/raids",
  achievements: "/achievements",
  statistics: "/achievements/statistics",
  reputations: "/reputations",
} as const;

/** 200 liefert die Daten, 404 null, alles andere ist ein Fehler. */
function dataOrNull(path: string, res: ApiResult): unknown {
  if (res.status === 200) return res.data;
  if (res.status === 404) return null;
  throw new BlizzardError(`HTTP ${res.status} bei ${path}`);
}

export async function fetchCharacter(
  client: BlizzardClient,
  entry: RosterEntry,
  fetchedAt: string,
  previous: CharacterRecord | null = null,
): Promise<CharacterRecord> {
  const base = `/profile/wow/character/${encodeURIComponent(entry.slug)}`;
  const profileRes = await client.get(base, "profile");
  const profile = dataOrNull(base, profileRes);
  const empty = { profile: null, specializations: null, equipment: null, media: null, professions: null, raids: null, achievements: null, statistics: null, reputations: null };
  if (profile === null) return buildCharacterRecord(entry, empty, fetchedAt);

  const keys = Object.keys(PARTS) as (keyof typeof PARTS)[];
  const results = await Promise.all(
    keys.map(async (k) => {
      const path = base + PARTS[k];
      return [k, dataOrNull(path, await client.get(path, "profile"))] as const;
    }),
  );
  const parts = { ...empty, profile, ...Object.fromEntries(results) } as CharacterParts;
  const record = buildCharacterRecord(entry, parts, fetchedAt);
  if (previous?.hasProfile) {
    if (parts.equipment === null) record.equipment = previous.equipment;
    if (parts.specializations === null) {
      record.specs = previous.specs;
      record.mainSpecId = previous.mainSpecId;
    }
    if (parts.professions === null) record.professions = previous.professions;
    if (parts.reputations === null && previous.reputations) record.reputations = previous.reputations;
    if (parts.statistics === null && previous.stats) record.stats = previous.stats;
    if (parts.statistics === null && previous.statValues) {
      record.statValues = previous.statValues;
      record.statTexts = previous.statTexts ?? null;
    }
    const prev = previous.instances;
    if (prev && record.instances) {
      if (parts.achievements === null) record.instances.achievements = prev.achievements;
      if (parts.statistics === null) record.instances.bossKills = prev.bossKills;
    } else if (prev && record.instances === null) {
      record.instances = prev;
    }
  }
  return record;
}
