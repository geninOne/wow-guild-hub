/**
 * Share of the budget in which a collector starts nothing new (2 s of the usual 12 s). The rest belongs to the
 * requests still in flight and to the writes at the end. The Netlify scheduler waits at most about 15 s for the
 * response and otherwise starts the run a second time; starting the function already takes up to 1 s of that.
 */
export const END_RESERVE_SHARE = 1 / 6;

/** Time from which a run that began at `started` starts no new work. */
export function workEndOf(started: number, budgetMs: number): number {
  return started + Math.floor(budgetMs * (1 - END_RESERVE_SHARE));
}
