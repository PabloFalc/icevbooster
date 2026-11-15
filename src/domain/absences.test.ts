import { describe, it, expect } from 'vitest';
import { limiteFaltas, saldoFaltas, saldoAulas, percentualUsado, inferCh, isFixed36, resolveCh } from './absences';
import type { Subject } from './types';

const mk = (o: Partial<Subject>): Subject => ({ id: 'x', nome: 'X', faltas: 0, pendentes: 0, percentual: null, ch: null, chSource: null, ...o });

describe('absences', () => {
  it('limiteFaltas', () => {
    expect(limiteFaltas(36)).toBe(9); expect(limiteFaltas(72)).toBe(18); expect(limiteFaltas(100)).toBe(25);
  });
  it('saldoAulas', () => {
    expect(saldoAulas(mk({ ch: 36, faltas: 4 }))).toBe(2);
    expect(saldoAulas(mk({ ch: 72, faltas: 8 }))).toBe(5);
    expect(saldoAulas(mk({ ch: 36, faltas: 2 }))).toBe(3);
    expect(saldoAulas(mk({ ch: 36, faltas: 9 }))).toBe(0);
    expect(saldoAulas(mk({ ch: 36, faltas: 4, pendentes: 2 }))).toBe(1);
    expect(saldoAulas(mk({ ch: null }))).toBeNull();
  });
  it('saldoFaltas never negative', () => {
    expect(saldoFaltas(mk({ ch: 36, faltas: 20 }))).toBe(0);
    expect(saldoFaltas(mk({ ch: null }))).toBeNull();
  });
  it('percentualUsado', () => {
    expect(percentualUsado(mk({ ch: 36, faltas: 4 }))).toBeCloseTo(11.11, 2);
    expect(percentualUsado(mk({ ch: 36, faltas: 2, pendentes: 2 }))).toBeCloseTo(11.11, 2);
    expect(percentualUsado(mk({ ch: null }))).toBeNull();
  });
  it('inferCh', () => {
    expect(inferCh(4, 11.11)).toBe(36); expect(inferCh(8, 11.11)).toBe(72); expect(inferCh(2, 5.56)).toBe(36);
    expect(inferCh(0, 0)).toBeNull(); expect(inferCh(4, 1111)).toBeNull();
    expect(inferCh(4, null)).toBeNull();
  });
  it('isFixed36', () => {
    expect(isFixed36('Inglês VI')).toBe(true); expect(isFixed36('Projeto de Extensão VI')).toBe(true);
    expect(isFixed36('Gestão')).toBe(false);
  });
  it('resolveCh', () => {
    expect(resolveCh(mk({ nome: 'Eletiva II' }), 36)).toEqual({ ch: 36, chSource: 'historico' });
    expect(resolveCh(mk({ nome: 'Inglês VI' }))).toEqual({ ch: 36, chSource: 'fixo' });
    expect(resolveCh(mk({ nome: 'Gestão', faltas: 0 }))).toEqual({ ch: null, chSource: null });
    expect(resolveCh(mk({ nome: 'Gestão', faltas: 8, percentual: 11.11 }))).toEqual({ ch: 72, chSource: 'percentual' });
    expect(resolveCh(mk({ nome: 'Gestão', ch: 54, chSource: 'manual' }))).toEqual({ ch: 54, chSource: 'manual' });
    expect(resolveCh(mk({ nome: 'Gestão', ch: 54, chSource: 'percentual' }))).toEqual({ ch: null, chSource: null });
  });
});
