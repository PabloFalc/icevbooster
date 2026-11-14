import { noClassDays } from './calendar';
import { weekdayOf } from './dates';
import type { OverallPlan } from './maxPlan';
import type { CalendarOverrides, Iso, Schedule, Weekday } from './types';

export type DayKind = 'weekend' | 'holiday' | 'simulado' | 'after' | 'none' | 'normal' | 'ok' | 'no';
export interface DaySubject { id: string; slot: 0 | 1; status: 'ok' | 'no' | 'normal' }

export function dayStatus(
  date: Iso,
  ctx: {
    plan: OverallPlan; schedule: Schedule; ov: CalendarOverrides; simulado: Iso;
    filter?: string; saldo: Record<string, number>;
  },
): { kind: DayKind; label?: string; subjects: DaySubject[] } {
  const { plan, schedule, ov, simulado, filter, saldo } = ctx;
  const extra = ov.extraDays[date];
  const wd = extra ?? weekdayOf(date);
  if (wd < 1 || wd > 5) return { kind: 'weekend', subjects: [] };

  const off = noClassDays([Number(date.slice(0, 4))], ov)[date];
  if (off !== undefined) return { kind: 'holiday', label: off, subjects: [] };
  if (date === simulado) return { kind: 'simulado', subjects: [] };
  if (date > simulado) return { kind: 'after', subjects: [] };

  const subjects: DaySubject[] = [];
  schedule[wd as Weekday].forEach((id, i) => {
    if (id === null || !(id in saldo)) return;
    if (filter !== undefined && id !== filter) return;
    const skip = plan.subjects.find((p) => p.subjectId === id)?.skipDays.includes(date) ?? false;
    const status = saldo[id] === 0 ? 'no' : skip ? 'ok' : 'normal';
    subjects.push({ id, slot: i as 0 | 1, status });
  });
  let kind: DayKind = 'normal';
  if (subjects.length === 0) kind = 'none';
  else if (subjects.some((s) => s.status === 'no')) kind = 'no';
  else if (subjects.every((s) => s.status === 'ok')) kind = 'ok';
  return { kind, subjects };
}
