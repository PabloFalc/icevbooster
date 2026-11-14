import { describe, it, expect } from 'vitest';
import notasFixture from '../../tests/fixtures/notas.json';
import { parseNotas } from './parseNotas';

const word = (text: string, x0: number, y0: number) => ({ text, x0, y0, x1: x0 + 30, y1: y0 + 10 });

describe('parseNotas (real screenshot OCR)', () => {
  const n = parseNotas(notasFixture);
  it('reads P1 grades and leaves blank columns null', () => {
    expect(n.find((r) => r.nome === 'Marketing Digital')).toMatchObject({ p1: 8.9, p2: null, p3: null });
    expect(n.find((r) => r.nome === 'Inglês VI')?.p1).toBe(6);
  });
  it('keeps subjects without any grade', () => {
    expect(n.find((r) => r.nome === 'Projeto de Extensão VI')?.p1).toBeNull();
    expect(n).toHaveLength(7);
  });
});

describe('parseNotas (synthetic)', () => {
  const header = [
    word('Disciplina', 100, 0), word('Situação', 400, 0), word('1-P1', 600, 0), word('2-P2', 700, 0),
    word('3-P3', 800, 0), word('4', 900, 0), word('MEDIA', 915, 0), word('SEMEST..', 950, 0),
    word('5-', 1000, 0), word('REC', 1020, 0), word('FINAL', 1050, 0),
    word('6', 1100, 0), word('média', 1115, 0), word('FINAL', 1150, 0),
  ];
  it('tells MÉDIA SEMEST from MÉDIA FINAL and reads every column', () => {
    const rows = parseNotas([
      ...header,
      word('Teste', 100, 40), word('Cursando', 400, 40), word('7,00', 600, 40), word('8,00', 700, 40),
      word('9,00', 800, 40), word('8,00', 925, 40), word('5,50', 1030, 40), word('6,75', 1125, 40),
    ]);
    expect(rows).toEqual([{ nome: 'Teste', p1: 7, p2: 8, p3: 9, media: 8, rec: 5.5, mediaFinal: 6.75 }]);
  });
  it('rejects grades outside 0..10', () => {
    const rows = parseNotas([...header, word('Teste', 100, 40), word('Cursando', 400, 40), word('890', 600, 40)]);
    expect(rows[0].p1).toBeNull();
  });
});
