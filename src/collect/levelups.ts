import type { LevelUpEvent, LevelUpLog } from "../model";

/** One event per level reached, all with the same time. No events without a previous value. */
export function detectLevelUps(
  characterId: number,
  prevLevel: number | undefined,
  nextLevel: number,
  at: string,
): LevelUpEvent[] {
  if (prevLevel === undefined || nextLevel <= prevLevel) return [];
  const events: LevelUpEvent[] = [];
  for (let level = prevLevel + 1; level <= nextLevel; level++) events.push({ characterId, level, at });
  return events;
}

/** Appends only events whose (character, level) pair is still missing: the first time a level is reached counts. */
export function appendLevelUps(log: LevelUpLog, events: LevelUpEvent[]): LevelUpLog {
  const seen = new Set(log.events.map((e) => `${e.characterId}:${e.level}`));
  const added: LevelUpEvent[] = [];
  for (const e of events) {
    const key = `${e.characterId}:${e.level}`;
    if (seen.has(key)) continue;
    seen.add(key);
    added.push(e);
  }
  return { events: [...log.events, ...added] };
}
