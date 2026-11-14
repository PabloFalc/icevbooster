import { describe, it, expect } from 'vitest';
import { splitEqual, gradeOutlook, clampGrade } from './grades';
import type { GradeSlot } from './types';

const C = (v: number): GradeSlot => ({ state: 'completa', value: v });
const N: GradeSlot = { state: 'nao_feita', value: null };
const I = (v: number, p?: number): GradeSlot => ({ state: 'incompleta', value: v, potencial: p });

describe('splitEqual', () => {
  it('splits equally, capped, or null', () => {
    expect(splitEqual(10, [9, 10])).toEqual([5, 5]);
    expect(splitEqual(12, [4, 10])).toEqual([4, 8]);
    expect(splitEqual(30, [9, 10])).toBeNull();
  });
});

describe('gradeOutlook', () => {
  it('p1 10, p2 incomplete 1, p3 open', () => {
    const o = gradeOutlook({ p1: C(10), p2: I(1), p3: N });
    expect(o.restantes).toBe(10);
    expect(o.shares).toEqual({ p2: 5, p3: 5 });
    expect(o.simuladoAcertos).toBe(24);
  });
  it('two open slots', () => {
    const o = gradeOutlook({ p1: C(6.7), p2: N, p3: N });
    expect(o.shares.p2).toBeCloseTo(7.15);
    expect(o.simuladoAcertos).toBe(35);
    expect(o.status).toBe('andamento');
    expect(o.target).toBe(21);
  });
  it('capped p2 pushes more onto p3', () => {
    const o = gradeOutlook({ p1: C(8.9), p2: I(1), p3: N });
    expect(o.shares.p3).toBeCloseTo(5.55);
    expect(o.simuladoAcertos).toBe(27);
  });
  it('rec path', () => {
    const o = gradeOutlook({ p1: C(0.5), p2: C(2), p3: N });
    expect(o.status).toBe('rec');
    expect(o.target).toBe(12);
    expect(o.simuladoAcertos).toBe(46);
    expect(o.recQuestoes).toBe(8);
  });
  it('statuses', () => {
    expect(gradeOutlook({ p1: C(10), p2: C(10), p3: C(1) }).status).toBe('aprovado');
    // 20 points is NOT approved: the open simulado still has to deliver 1 point
    const o = gradeOutlook({ p1: C(10), p2: C(10), p3: N });
    expect(o.status).toBe('andamento');
    expect(o.shares).toEqual({ p3: 1 });
    expect(o.simuladoAcertos).toBe(5);
    expect(gradeOutlook({ p1: C(1), p2: C(1), p3: N }).status).toBe('rec');
    expect(gradeOutlook({ p1: C(0.5), p2: C(1), p3: N }).status).toBe('reprovado');
    expect(gradeOutlook({ p1: C(5), p2: C(5), p3: C(5) })).toMatchObject({ status: 'rec', recQuestoes: 7 });
    expect(gradeOutlook({ p1: C(7), p2: C(7), p3: C(7) }).status).toBe('aprovado');
    expect(gradeOutlook({ p1: C(3), p2: C(3), p3: C(3) }).status).toBe('reprovado');
    expect(gradeOutlook({ p1: C(7), p2: C(7), p3: C(7) }).restantes).toBe(0);
  });
  it('null value in completa counts as 0; value is clamped', () => {
    expect(gradeOutlook({ p1: { state: 'completa', value: null }, p2: C(12), p3: N }).atual).toBe(10);
  });
  it('incompleta potencial clamped so value + potencial <= 10', () => {
    const o = gradeOutlook({ p1: C(0), p2: I(4, 9), p3: C(0) });
    expect(o.restantes).toBe(17);
    expect(o.status).toBe('reprovado');
  });
});

describe('clampGrade', () => {
  it('clamps to [0,10]', () => {
    expect(clampGrade(12)).toBe(10);
    expect(clampGrade(-1)).toBe(0);
  });
});
