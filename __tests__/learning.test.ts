import { accuracy, series, streak, totals } from '@/lib/learning';
import { dayKey } from '@/lib/store';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const DAY = 24 * 60 * 60 * 1000;
const now = new Date(2026, 9, 5, 12).getTime();
const k = (daysAgo: number) => dayKey(now - daysAgo * DAY);

describe('learning stats', () => {
  const stats = {
    [k(0)]: { read: 3, answered: 4, correct: 3 },
    [k(1)]: { read: 2, answered: 0, correct: 0 },
    [k(2)]: { read: 5, answered: 2, correct: 1 },
    [k(10)]: { read: 9, answered: 0, correct: 0 },
  };

  it('builds a daily series oldest first', () => {
    expect(series(stats, 3, 'read', now)).toEqual([5, 2, 3]);
  });

  it('sums totals in a range', () => {
    expect(totals(stats, 7, now)).toEqual({ read: 10, answered: 6, correct: 4 });
    expect(totals(stats, null, now).read).toBe(19);
    expect(accuracy(totals(stats, 7, now))).toBeCloseTo(4 / 6);
  });

  it('counts the reading streak, not breaking it before today is done', () => {
    expect(streak(stats, now)).toBe(3);
    const { [k(0)]: _today, ...noToday } = stats;
    expect(streak(noToday, now)).toBe(2);
  });
});
