import { describe, it, expect } from 'vitest';
import historicoFixture from '../../tests/fixtures/historico.json';
import { parseHistorico } from './parseHistorico';

describe('parseHistorico (real screenshot OCR)', () => {
  const h = parseHistorico(historicoFixture);
  it('reads every subject row, merging the wrapped Estágio name', () => {
    expect(h).toHaveLength(7);
    expect(h.find((r) => r.nome.startsWith('Estágio'))?.nome).toBe(
      'Estágio Curricular Supervisionado - Fábrica de Software I',
    );
  });
  it('reads CH and faltas', () => {
    expect(h.find((r) => r.nome === 'Gestão de Projetos de Software')?.ch).toBe(72);
    expect(h.find((r) => r.nome === 'Marketing Digital')).toMatchObject({ ch: 36, faltas: 4 });
  });
  it('keeps blank faltas as null', () => {
    expect(h.find((r) => r.nome.startsWith('Estágio'))).toMatchObject({ ch: 100, faltas: null });
  });
  it('rejects a CH of zero', () => {
    const word = (text: string, x0: number, y0: number) => ({ text, x0, y0, x1: x0 + 30, y1: y0 + 10 });
    const rows = parseHistorico([
      word('Disciplina', 500, 0), word('Faltas', 800, 0), word('CH', 1000, 0),
      word('Teste', 480, 40), word('2', 800, 40), word('0,00', 1000, 40),
    ]);
    expect(rows).toEqual([{ nome: 'Teste', faltas: 2, ch: null }]);
  });
});
