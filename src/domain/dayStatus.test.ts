import { describe, it, expect } from 'vitest';
import { planAll, type OverallPlan } from './maxPlan';
import { dayStatus } from './dayStatus';
import { saldoAulas } from './absences';
import type { CalendarOverrides, Schedule, Subject } from './types';

const sub = (id: string, ch: number, faltas: number): Subject =>
  ({ id, nome: id, faltas, pendentes: 0, percentual: null, ch, chSource: 'manual' });
const schedule: Schedule = { 1:['eletivaVI','extensao'], 2:['eletiva','po'], 3:['estagio','po'], 4:['gestao','gestao'], 5:['marketing',null] };
const ov: CalendarOverrides = { noClass: {}, removedHolidays: [], extraDays: {} };
const subjects = [sub('eletiva', 36, 9), sub('marketing', 36, 4), sub('po', 72, 8), sub('gestao', 72, 0)];
const simulado = '2026-12-10';
const plan = planAll({ subjects, schedule, ov, today: '2026-11-16', simulado }) as OverallPlan;
const saldo = Object.fromEntries(subjects.map((s) => [s.id, saldoAulas(s)!]));
const ctx = { plan, schedule, ov, simulado, saldo };

describe('dayStatus', () => {
  it('special days', () => {
    expect(dayStatus('2026-11-20', ctx)).toMatchObject({ kind: 'holiday', label: expect.any(String), subjects: [] });
    expect(dayStatus('2026-12-10', ctx).kind).toBe('simulado');
    expect(dayStatus('2026-12-11', ctx).kind).toBe('after');
    expect(dayStatus('2026-11-21', ctx).kind).toBe('weekend');
  });
  it('extra day on a weekend is not a weekend', () => {
    const c = { ...ctx, ov: { ...ov, extraDays: { '2026-11-28': 5 as const } } };
    const r = dayStatus('2026-11-28', c);
    expect(r.kind).not.toBe('weekend');
    expect(r.subjects.map((s) => s.id)).toEqual(['marketing']);
  });
  it('holiday honors overrides', () => {
    expect(dayStatus('2026-11-20', { ...ctx, ov: { ...ov, removedHolidays: ['2026-11-20'] } }).kind).not.toBe('holiday');
    const r = dayStatus('2026-05-05', { ...ctx, ov: { ...ov, noClass: { '2026-05-05': 'Recesso' } } });
    expect(r).toMatchObject({ kind: 'holiday', label: 'Recesso' });
  });
  it('no when any subject has no saldo', () => {
    const r = dayStatus('2026-11-17', ctx);
    expect(r.kind).toBe('no');
    expect(r.subjects).toEqual([{ id: 'eletiva', slot: 0, status: 'no' }, { id: 'po', slot: 1, status: 'normal' }]);
  });
  it('ok when all classes are in skip days', () => {
    const r = dayStatus('2026-11-27', ctx);
    expect(r.kind).toBe('ok');
    expect(r.subjects).toEqual([{ id: 'marketing', slot: 0, status: 'ok' }]);
    expect(dayStatus('2026-11-19', ctx).subjects).toEqual([{ id: 'gestao', slot: 0, status: 'ok' }, { id: 'gestao', slot: 1, status: 'ok' }]);
  });
  it('normal when a class is outside the skip days', () => {
    expect(dayStatus('2026-11-18', ctx).kind).toBe('normal'); // po on Wednesday, before 11-25
  });
  it('ignores unplanned subjects; a day with only ignored classes is none', () => {
    expect(dayStatus('2026-11-18', ctx).subjects).toEqual([{ id: 'po', slot: 1, status: 'normal' }]);
    expect(dayStatus('2026-11-16', ctx)).toMatchObject({ kind: 'none', subjects: [] });
  });
  it('filter restricts to one subject', () => {
    expect(dayStatus('2026-11-17', { ...ctx, filter: 'po' })).toMatchObject({ kind: 'normal', subjects: [{ id: 'po', slot: 1, status: 'normal' }] });
    expect(dayStatus('2026-11-17', { ...ctx, filter: 'marketing' }).kind).toBe('none');
  });
});
