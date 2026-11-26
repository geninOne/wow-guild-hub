export interface PoolResult<T> {
  completed: T[];
  failed: { item: T; error: unknown }[];
  skipped: T[];
}

/**
 * Arbeitet die Liste mit begrenzter Gleichzeitigkeit ab. Nach der Deadline wird
 * nichts Neues mehr begonnen; laufende Arbeiten werden noch beendet.
 */
export async function runPool<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  opts: { concurrency: number; deadline: number; now?: () => number },
): Promise<PoolResult<T>> {
  const now = opts.now ?? Date.now;
  const done: number[] = [];
  const failed: { index: number; error: unknown }[] = [];
  const skipped: number[] = [];
  let next = 0;

  async function lane(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      if (now() >= opts.deadline) {
        skipped.push(index);
        continue;
      }
      try {
        await worker(items[index]);
        done.push(index);
      } catch (error) {
        failed.push({ index, error });
      }
    }
  }

  const lanes = Math.max(1, Math.min(opts.concurrency, items.length));
  await Promise.all(Array.from({ length: lanes }, lane));

  const byIndex = (a: number, b: number) => a - b;
  return {
    completed: done.sort(byIndex).map((i) => items[i]),
    failed: failed.sort((a, b) => a.index - b.index).map((f) => ({ item: items[f.index], error: f.error })),
    skipped: skipped.sort(byIndex).map((i) => items[i]),
  };
}
