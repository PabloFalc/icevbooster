import { saldoAulas } from './absences';
import { classDays } from './calendar';
import type { CalendarOverrides, ClassDay, Iso, Schedule, Subject } from './types';

export interface SubjectPlan {
  subjectId: string;
  saldoAulas: number;
  skipDays: Iso[];
  startDate: Iso | null;
  allCovered: boolean;
  folgaAulas: number;
}

/** Walk days from last to first, taking whole days while they fit in the saldo. */
export function planSubject(subjectId: string, days: ClassDay[], saldo: number): SubjectPlan {
  const taken: Iso[] = [];
  let used = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (used + days[i].aulas > saldo) break;
    used += days[i].aulas;
    taken.push(days[i].date);
  }
  const skipDays = taken.reverse();
  return {
    subjectId,
    saldoAulas: saldo,
    skipDays,
    startDate: skipDays[0] ?? null,
    allCovered: days.length > 0 && skipDays.length === days.length,
    folgaAulas: saldo - used,
  };
}

export type PlanError = 'sem_data' | 'data_passada';
export interface OverallPlan { subjects: SubjectPlan[]; skipAllFrom: Iso | null; exceptions: string[] }

export function planAll(input: {
  subjects: Subject[]; schedule: Schedule; ov: CalendarOverrides; today: Iso; simulado: Iso | null;
}): OverallPlan | PlanError {
  const { subjects, schedule, ov, today, simulado } = input;
  if (simulado === null) return 'sem_data';
  if (simulado <= today) return 'data_passada';
  const scheduled = new Set(Object.values(schedule).flat().filter((s): s is string => s !== null));
  const plans: SubjectPlan[] = [];
  for (const s of subjects) {
    const saldo = saldoAulas(s);
    if (saldo === null || !scheduled.has(s.id)) continue;
    plans.push(planSubject(s.id, classDays(s.id, today, simulado, schedule, ov), saldo));
  }
  const exceptions = plans.filter((p) => p.skipDays.length === 0).map((p) => p.subjectId);
  const starts = plans.filter((p) => p.startDate !== null).map((p) => p.startDate as Iso);
  return { subjects: plans, skipAllFrom: starts.length ? starts.reduce((a, b) => (a > b ? a : b)) : null, exceptions };
}
