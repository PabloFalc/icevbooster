import { addDays, weekdayOf } from './dates';
import { holidaysFor } from './holidays';
import type { CalendarOverrides, ClassDay, Iso, Schedule, Weekday } from './types';

export function noClassDays(years: number[], ov: CalendarOverrides): Record<Iso, string> {
  const out: Record<Iso, string> = {};
  for (const y of years) {
    for (const [d, name] of Object.entries(holidaysFor(y))) {
      if (!ov.removedHolidays.includes(d)) out[d] = name;
    }
  }
  return { ...out, ...ov.noClass };
}

export function classDays(
  subjectId: string, fromIso: Iso, toExclusive: Iso, schedule: Schedule, ov: CalendarOverrides,
): ClassDay[] {
  if (fromIso >= toExclusive) return [];
  const years: number[] = [];
  for (let y = Number(fromIso.slice(0, 4)); y <= Number(toExclusive.slice(0, 4)); y++) years.push(y);
  const off = noClassDays(years, ov);
  const result: ClassDay[] = [];
  for (let d = fromIso; d < toExclusive; d = addDays(d, 1)) {
    if (off[d] !== undefined) continue;
    const wd = ov.extraDays[d] ?? weekdayOf(d);
    if (wd < 1 || wd > 5) continue;
    const aulas = schedule[wd as Weekday].filter((s) => s === subjectId).length;
    if (aulas > 0) result.push({ date: d, aulas: aulas as 1 | 2 });
  }
  return result;
}
