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

describe('parseFaltas (synthetic rows)', () => {
  const w = (text: string, x0: number, y0: number) => ({ text, x0, y0, x1: x0 + 30, y1: y0 + 10 });
  const header = [
    w('Disciplina', 400, 0), w('Turma', 780, 0), w('BIM', 970, 0), w('BIM', 1150, 0),
    w('TOTAL', 1320, 0), w('Percentual', 1500, 0),
  ];
  const row = (y: number, name: string, cells: [number, string][]) => [
    w(name, 160, y), w('036C', 780, y), ...cells.map(([x, t]) => w(t, x, y)),
  ];

  it('repairs or rejects impossible percentuals', () => {
    const f = parseFaltas([
      ...header,
      ...row(40, 'Alfa', [[1320, '4'], [1500, '1111%']]),
      ...row(80, 'Beta', [[1320, '4'], [1500, '11,11%']]),
      ...row(120, 'Gama', [[1320, '4'], [1500, '250%']]),
    ]);
    expect(f.map((r) => r.percentual)).toEqual([11.11, 11.11, null]);
  });

  it('sums bimesters when TOTAL is missing, and returns null when only the percentual shows faltas', () => {
    const f = parseFaltas([
      ...header,
      ...row(40, 'Alfa', [[970, '2'], [1150, '2'], [1500, '11.11%']]),
      ...row(80, 'Beta', [[1500, '11.11%']]),
      ...row(120, 'Gama', [[1500, '0%']]),
    ]);
    expect(f.map((r) => r.faltas)).toEqual([4, null, 0]);
  });

  it('an unreadable percentual with no TOTAL or bimester cells is unknown, not 0', () => {
    const f = parseFaltas([
      ...header,
      w('Alfa', 160, 40), w('036', 780, 40), w('ll,ll%', 1500, 40), // numeric turma keeps it a data row
      ...row(80, 'Beta', [[1500, '250%']]),
      w('Gama', 160, 120), w('036', 780, 120),
    ]);
    expect(f.map((r) => r.faltas)).toEqual([null, null, 0]);
  });

  it('drops stray text far below the table instead of appending it to a name', () => {
    const f = parseFaltas([
      ...header,
      ...row(40, 'Alfa', [[1320, '4'], [1500, '11.11%']]),
      w('Legenda', 160, 200),
    ]);
    expect(f).toEqual([{ nome: 'Alfa', turma: '036C', faltas: 4, percentual: 11.11 }]);
  });
});
