import type { DayStats } from './store';

const DAY = 24 * 60 * 60 * 1000;

function key(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Daily values for the last `days` days, oldest first. */
export function series(stats: Record<string, DayStats>, days: number, field: keyof DayStats, now = Date.now()): number[] {
  const out: number[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(stats[key(new Date(now - i * DAY))]?.[field] ?? 0);
  return out;
}

export function totals(stats: Record<string, DayStats>, days: number | null, now = Date.now()): DayStats {
  const sum: DayStats = { read: 0, answered: 0, correct: 0 };
  const cutoff = days == null ? null : key(new Date(now - (days - 1) * DAY));
  for (const [k, v] of Object.entries(stats)) {
    if (cutoff && k < cutoff) continue;
    sum.read += v.read;
    sum.answered += v.answered;
    sum.correct += v.correct;
  }
  return sum;
}

/** Consecutive days with at least one post read. Today not counted yet doesn't break the streak. */
export function streak(stats: Record<string, DayStats>, now = Date.now()): number {
  let count = 0;
  let i = (stats[key(new Date(now))]?.read ?? 0) > 0 ? 0 : 1;
  while ((stats[key(new Date(now - i * DAY))]?.read ?? 0) > 0) {
    count++;
    i++;
  }
  return count;
}

export function accuracy(t: DayStats): number | null {
  return t.answered ? t.correct / t.answered : null;
}
