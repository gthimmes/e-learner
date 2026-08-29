/** Pure streak maths (no I/O) so it can be unit-tested. Days are UTC "YYYY-MM-DD" keys. */

export function dayKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function shiftDay(key: string, delta: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return dayKey(d);
}

export type Streak = { current: number; longest: number; activeToday: boolean };

/**
 * `current` counts consecutive active days ending today, or ending yesterday if today has no
 * activity yet (so a streak is not "lost" until the day is over). `longest` is the best run ever.
 */
export function computeStreak(activeDays: Iterable<string>, today: string = dayKey()): Streak {
  const set = new Set(activeDays);
  const activeToday = set.has(today);
  let current = 0;
  let cursor = activeToday ? today : shiftDay(today, -1);
  while (set.has(cursor)) {
    current++;
    cursor = shiftDay(cursor, -1);
  }
  let longest = 0;
  for (const day of set) {
    if (set.has(shiftDay(day, -1))) continue; // only start counting at run starts
    let len = 0;
    let c = day;
    while (set.has(c)) {
      len++;
      c = shiftDay(c, 1);
    }
    longest = Math.max(longest, len);
  }
  return { current, longest, activeToday };
}
