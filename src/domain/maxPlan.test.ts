import { describe, it, expect } from 'vitest';
import { planSubject, planAll, type OverallPlan } from './maxPlan';
import { addDays } from './dates';
import type { CalendarOverrides, Schedule, Subject } from './types';

const weekly = (n: number, offset = 0) =>
  Array.from({ length: n }, (_, i) => ({ date: addDays('2026-09-07', 7 * i + offset), aulas: 1 as const }));

const sub = (id: string, ch: number, faltas: number): Subject =>
  ({ id, nome: id, faltas, pendentes: 0, percentual: null, ch, chSource: 'manual' });

const schedule: Schedule = { 1:['eletivaVI','extensao'], 2:['eletiva','po'], 3:['estagio','po'], 4:['gestao','gestao'], 5:['marketing',null] };
const ov: CalendarOverrides = { noClass: {}, removedHolidays: [], extraDays: {} };
const base = {
  today: '2026-11-16', simulado: '2026-12-10' as string | null, schedule, ov,
  subjects: [sub('eletiva', 36, 9), sub('marketing', 36, 4), sub('po', 72, 8), sub('gestao', 72, 0)],
};

describe('planSubject', () => {
  it('example: simulado in week 10 on the day of Y', () => {
    expect(planSubject('X', weekly(10, 0), 10).allCovered).toBe(true);
    expect(planSubject('Y', weekly(9, 1), 2).startDate).toBe(addDays('2026-09-08', 7 * 7));
    expect(planSubject('Z', weekly(9, 2), 6).startDate).toBe(addDays('2026-09-09', 7 * 3));
  });
  it('never splits a 2-class day', () => {
    const g = planSubject('gestao', [{ date: '2026-11-19', aulas: 2 }, { date: '2026-11-26', aulas: 2 }, { date: '2026-12-03', aulas: 2 }], 3);
    expect(g.skipDays).toEqual(['2026-12-03']);
    expect(g.folgaAulas).toBe(1);
    expect(g.allCovered).toBe(false);
    expect(planSubject('gestao', [{ date: '2026-12-03', aulas: 2 }], 1).skipDays).toEqual([]);
  });
  it('saldo 0 and no days', () => {
    const p = planSubject('a', weekly(3), 0);
    expect(p.skipDays).toEqual([]);
    expect(p.startDate).toBeNull();
    expect(p.allCovered).toBe(false);
    expect(planSubject('a', [], 3).startDate).toBeNull();
  });
  it('covers everything when saldo is ample', () => {
    const p = planSubject('a', weekly(3), 10);
    expect(p.allCovered).toBe(true);
    expect(p.folgaAulas).toBe(7);
    expect(p.startDate).toBe('2026-09-07');
  });
});

describe('planAll', () => {
  it('errors', () => {
    expect(planAll({ ...base, simulado: null })).toBe('sem_data');
    expect(planAll({ ...base, simulado: '2026-11-10' })).toBe('data_passada');
    expect(planAll({ ...base, simulado: '2026-11-16' })).toBe('data_passada');
  });
  it('builds the plan', () => {
    const p = planAll(base) as OverallPlan;
    expect(p.exceptions).toEqual(['eletiva']);
    const by = Object.fromEntries(p.subjects.map((s) => [s.subjectId, s]));
    expect(p.subjects.map((s) => s.subjectId)).toEqual(['eletiva', 'marketing', 'po', 'gestao']);
    expect(by.marketing.skipDays).toEqual(['2026-11-27', '2026-12-04']);
    expect(by.po.startDate).toBe('2026-11-25');
    expect(by.po.skipDays).toEqual(['2026-11-25', '2026-12-01', '2026-12-02', '2026-12-08', '2026-12-09']);
    expect(by.gestao.startDate).toBe('2026-11-19');
    expect(by.gestao.allCovered).toBe(true);
    expect(by.gestao.folgaAulas).toBe(3);
    // PO's last required class is 24/11; Marketing and Gestão are allCovered and impose no constraint.
    expect(p.skipAllFrom).toBe('2026-11-25');
  });
  it('skips subjects without CH or not in schedule', () => {
    const p = planAll({ ...base, subjects: [...base.subjects, { ...sub('x', 36, 0), ch: null }, sub('fora', 36, 0)] }) as OverallPlan;
    expect(p.subjects.map((s) => s.subjectId)).toEqual(['eletiva', 'marketing', 'po', 'gestao']);
  });
  it('an allCovered subject whose first class is later does not push skipAllFrom', () => {
    // Marketing (Fridays) is allCovered with first class 27/11; PO starts 25/11 → skip all from 25/11, not 27/11.
    const p = planAll({ ...base, subjects: [sub('marketing', 36, 4), sub('po', 72, 8)] }) as OverallPlan;
    const by = Object.fromEntries(p.subjects.map((s) => [s.subjectId, s]));
    expect(by.marketing.allCovered).toBe(true);
    expect(by.marketing.startDate).toBe('2026-11-27');
    expect(p.skipAllFrom).toBe('2026-11-25');
  });
  it('skipAllFrom is today when every planned subject is allCovered', () => {
    const p = planAll({ ...base, subjects: [sub('marketing', 36, 4), sub('gestao', 72, 0)] }) as OverallPlan;
    expect(p.skipAllFrom).toBe('2026-11-16');
  });
  it('skipAllFrom is null when everyone is an exception', () => {
    const p = planAll({ ...base, subjects: [sub('eletiva', 36, 9)] }) as OverallPlan;
    expect(p.skipAllFrom).toBeNull();
    expect(p.exceptions).toEqual(['eletiva']);
  });
});
