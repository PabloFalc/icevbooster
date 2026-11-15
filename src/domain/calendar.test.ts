import { describe, it, expect } from 'vitest';
import { classDays, noClassDays } from './calendar';
import type { Schedule, CalendarOverrides } from './types';

const sched: Schedule = { 1:['eletivaVI','extensao'], 2:['eletiva','po'], 3:['estagio','po'], 4:['gestao','gestao'], 5:['marketing',null] };
const ov: CalendarOverrides = { noClass:{}, removedHolidays:[], extraDays:{} };

describe('calendar', () => {
  it('skips holidays', () => {
    expect(classDays('marketing','2026-11-16','2026-12-10',sched,ov).map(d=>d.date)).toEqual(['2026-11-27','2026-12-04']);
    expect(classDays('gestao','2026-11-16','2026-12-10',sched,ov)).toEqual([
      {date:'2026-11-19',aulas:2},{date:'2026-11-26',aulas:2},{date:'2026-12-03',aulas:2}]);
  });
  it('honours removed holidays and extra days', () => {
    expect(classDays('marketing','2026-11-16','2026-12-10',sched,{...ov,removedHolidays:['2026-11-20'],extraDays:{'2026-11-28':5}}).length).toBe(4);
  });
  it('noClassDays merges overrides', () => {
    const r = noClassDays([2026], { ...ov, removedHolidays:['2026-11-20'], noClass:{'2026-05-05':'Recesso'} });
    expect(r['2026-11-20']).toBeUndefined();
    expect(r['2026-05-05']).toBe('Recesso');
    expect(r['2026-12-25']).toBe('Natal');
  });
});
