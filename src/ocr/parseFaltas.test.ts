import { describe, it, expect } from 'vitest';
import faltasFixture from '../../tests/fixtures/faltas.json';
import { parseFaltas } from './parseFaltas';
import { parseNumber, groupRows, columnOf } from './rows';

describe('parseNumber', () => {
  it('accepts comma/dot decimals, percent and O as zero', () => {
    expect(parseNumber('11.11%')).toBe(11.11);
    expect(parseNumber('8,90')).toBe(8.9);
    expect(parseNumber('8.90')).toBe(8.9);
    expect(parseNumber('O')).toBe(0);
    expect(parseNumber('o')).toBe(0);
    expect(parseNumber('0%')).toBe(0);
    expect(parseNumber('100,00')).toBe(100);
  });
  it('returns null for non-numbers', () => {
    expect(parseNumber('Ver')).toBeNull();
    expect(parseNumber('036C')).toBeNull();
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('|')).toBeNull();
  });
});

describe('groupRows / columnOf', () => {
  const w = (text: string, x0: number, y0: number) => ({ text, x0, y0, x1: x0 + 20, y1: y0 + 10 });
  it('clusters by vertical center, top→bottom and left→right', () => {
    const rows = groupRows([w('b', 50, 41), w('c', 10, 80), w('a', 10, 40)]);
    expect(rows.map((r) => r.map((x) => x.text))).toEqual([['a', 'b'], ['c']]);
  });
  it('picks the nearest header center', () => {
    const headers = [{ key: 'a', x: 0 }, { key: 'b', x: 100 }];
    expect(columnOf(w('x', 60, 0), headers)).toBe('b');
    expect(columnOf(w('x', 20, 0), headers)).toBe('a');
  });
});

describe('parseFaltas (real screenshot OCR)', () => {
  const f = parseFaltas(faltasFixture);
  it('reads every subject row', () => {
    expect(f).toHaveLength(7);
  });
  it('reads total faltas, percentual and turma', () => {
    expect(f.find((r) => r.nome === 'Marketing Digital')).toMatchObject({ faltas: 4, percentual: 11.11, turma: '036C' });
    expect(f.find((r) => r.nome === 'Pesquisa Operacional')).toMatchObject({ faltas: 8, percentual: 11.11 });
    expect(f.find((r) => r.nome === 'Projeto de Extensão VI')).toMatchObject({ faltas: 2, percentual: 5.56 });
  });
  it('treats blank faltas as 0', () => {
    expect(f.find((r) => r.nome.startsWith('Estágio'))).toMatchObject({ faltas: 0, percentual: 0 });
  });
  it('repairs roman numerals misread as bars', () => {
    expect(f.map((r) => r.nome)).toContain('Eletiva II');
  });
});
