import { describe, expect, it } from 'vitest';
import { compositeNeeds, compositeSummary, compositeToSlot, type Composite } from './composite';

const pts: Composite = {
  mode: 'pontos',
  parts: [
    { nome: 'Quiz', max: 1, tirei: 1 },
    { nome: 'Trabalho', max: 3, tirei: 2.5 },
    { nome: 'Prova', max: 6, tirei: null },
  ],
};
const peso: Composite = {
  mode: 'peso',
  parts: [
    { nome: 'Trabalho', max: 30, tirei: 8 },
    { nome: 'Prova', max: 70, tirei: null },
  ],
};

describe('composite', () => {
  it('summarises pontos mode', () => {
    expect(compositeSummary(pts)).toEqual({ valid: true, garantido: 3.5, potencial: 6, complete: false });
  });
  it('splits needed points over blank parts', () => {
    expect(compositeNeeds(pts, 4.3)).toEqual([null, null, 4.3]);
  });
  it('converts to an incomplete slot', () => {
    expect(compositeToSlot(pts)).toEqual({ state: 'incompleta', value: 3.5, potencial: 6 });
  });
  it('handles peso mode', () => {
    expect(compositeSummary(peso).garantido).toBeCloseTo(2.4);
    expect(compositeNeeds(peso, 3.5)[1]).toBeCloseTo(5);
  });
  it('flags invalid totals', () => {
    expect(compositeSummary({ mode: 'pontos', parts: [{ nome: 'A', max: 4, tirei: null }] }).valid).toBe(false);
    expect(compositeSummary({ mode: 'pontos', parts: [] }).valid).toBe(false);
  });
  it('returns completa slot when all parts are filled', () => {
    const c: Composite = { mode: 'pontos', parts: [{ nome: 'A', max: 10, tirei: 7 }] };
    expect(compositeSummary(c).complete).toBe(true);
    expect(compositeToSlot(c)).toEqual({ state: 'completa', value: 7 });
  });
  it('returns all null when needed points are unreachable', () => {
    expect(compositeNeeds(pts, 7)).toEqual([null, null, null]);
  });
  it('splits equally across several blank parts with caps', () => {
    const c: Composite = {
      mode: 'pontos',
      parts: [{ nome: 'A', max: 1, tirei: null }, { nome: 'B', max: 9, tirei: null }],
    };
    expect(compositeNeeds(c, 4)).toEqual([1, 3]);
  });
  it('sanitises bad numbers and clamps tirei', () => {
    const c: Composite = {
      mode: 'pontos',
      parts: [{ nome: 'A', max: 5, tirei: 9 }, { nome: 'B', max: -3, tirei: NaN }],
    };
    expect(compositeSummary(c).garantido).toBe(5);
    const p: Composite = { mode: 'peso', parts: [{ nome: 'A', max: 100, tirei: 15 }] };
    expect(compositeSummary(p).garantido).toBeCloseTo(10);
  });
});
