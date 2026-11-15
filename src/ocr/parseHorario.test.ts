import { describe, it, expect } from 'vitest';
import horarioFixture from '../../tests/fixtures/horario.json';
import { namesMatch } from '../domain/nameMatch';
import { parseHorario } from './parseHorario';

const word = (text: string, x0: number, y0: number) => ({ text, x0, y0, x1: x0 + 40, y1: y0 + 10 });

describe('parseHorario (real screenshot OCR)', () => {
  it('reads the known cells when the OCR is good enough', () => {
    const hz = parseHorario(horarioFixture);
    // tolerant: the horario OCR may be weak; if ok, the known cells must be right
    if (hz.ok) {
      expect(hz.cells.some((c) => c.weekday === 4 && c.slot === 0 && namesMatch(c.nome, 'Gestão de Projetos'))).toBe(true);
      expect(hz.cells.some((c) => c.weekday === 5 && c.slot === 0 && namesMatch(c.nome, 'Marketing Digital'))).toBe(true);
    }
  });
  it('reads the committed fixture (3× upscale, sparse-text OCR) as ok', () => {
    const hz = parseHorario(horarioFixture);
    expect(hz.ok).toBe(true);
    expect(hz.cells).toHaveLength(9);
    const quinta = hz.cells.find((c) => c.weekday === 4 && c.slot === 0);
    expect(quinta?.nome).toMatch(/Projetos/);
    expect(namesMatch(quinta!.nome, 'Gestão de Projetos de Software')).toBe(true);
  });
});

describe('parseHorario (synthetic)', () => {
  it('is not ok without words', () => {
    expect(parseHorario([]).ok).toBe(false);
  });

  const header = [
    word('Horário', 0, 0), word('Segunda-feira', 100, 0), word('Terça-feira', 200, 0),
    word('Quarta-feira', 300, 0), word('Quinta-feira', 400, 0), word('Sexta-feira', 500, 0),
  ];
  const grid = [
    ...header,
    // slot 0 (18:20) spans y 30..90
    word('Eletiva', 100, 40), word('VI', 145, 40), word('Stela', 110, 60),
    word('Eletiva', 200, 30), word('II', 245, 30), word('Gestão', 200, 45), word('Pessoas', 200, 60), word('Layse', 210, 75),
    word('18:20', 0, 55), word('-', 45, 55), word('20:00', 55, 55),
    word('Estágio', 300, 50),
    word('Gestão', 400, 45), word('de', 445, 45), word('Projetos', 400, 60),
    word('Marketing', 500, 45), word('Digital', 545, 45), word('Ítalo', 510, 60),
    // slot 1 (20:20) spans y 100..160
    word('20:20', 0, 130), word('-', 45, 130), word('22:00', 55, 130),
    word('Pesquisa', 200, 115), word('Operacional', 200, 130), word('Mauro', 210, 145),
    word('Banco', 500, 115), word('de', 545, 115), word('Dados', 500, 130), word('Avançados', 545, 130),
  ];

  it('places cells by day column and time slot, dropping only a single-word professor line', () => {
    const hz = parseHorario(grid);
    expect(hz.ok).toBe(true);
    expect(hz.cells).toEqual(
      expect.arrayContaining([
        { weekday: 1, slot: 0, nome: 'Eletiva VI' },
        { weekday: 2, slot: 0, nome: 'Eletiva II Gestão Pessoas' },
        { weekday: 3, slot: 0, nome: 'Estágio' },
        { weekday: 4, slot: 0, nome: 'Gestão de Projetos' },
        { weekday: 5, slot: 0, nome: 'Marketing Digital' },
        { weekday: 2, slot: 1, nome: 'Pesquisa Operacional' },
        { weekday: 5, slot: 1, nome: 'Banco de Dados Avançados' },
      ]),
    );
    expect(hz.cells).toHaveLength(7);
  });

  it('is not ok with fewer than 5 cells', () => {
    const hz = parseHorario(grid.filter((w) => w.x0 < 300 || w.y0 === 0));
    expect(hz.ok).toBe(false);
    expect(hz.cells.length).toBeGreaterThan(0);
  });
});
