import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { importNotas, resetForTests, setComposite, setGradeSlot, state } from '../../state/store';
import { Calculadora } from './Calculadora';

const nota = (nome: string, p1: number | null, p2: number | null = null, p3: number | null = null) =>
  ({ nome, p1, p2, p3, media: null, rec: null, mediaFinal: null });
const quizTrabalhoProva = { mode: 'pontos' as const, parts: [
  { nome: 'Quiz', max: 1, tirei: 1 }, { nome: 'Trabalho', max: 3, tirei: 2.5 }, { nome: 'Prova', max: 6, tirei: null },
] };
const type = (label: string, value: string) => {
  const el = screen.getByLabelText(label);
  fireEvent.input(el, { target: { value } });
  fireEvent.blur(el);
};
const result = () => document.querySelector('.result') as HTMLElement;

beforeEach(() => {
  resetForTests();
  history.replaceState(null, '', '#/calculadora');
  importNotas([nota('Marketing Digital', 8.9)], '2026-11-14');
});
afterEach(() => { cleanup(); history.replaceState(null, '', '#/'); });

describe('Calculadora page', () => {
  it('linked P2: garantido, potencial, per-part needs and simulado acertos; table row highlighted', () => {
    setComposite('marketing-digital:p2', quizTrabalhoProva);
    history.replaceState(null, '', '#/calculadora?m=marketing-digital&p=p2');
    render(<Calculadora />);
    const r = within(result());
    expect(r.getByText('3,50')).toBeTruthy();
    expect(r.getByText('6,00')).toBeTruthy();
    expect(r.getAllByText('4,30')).toHaveLength(2);
    expect(result().textContent).toContain('Tire 4,30 em Prova (de 6)');
    expect(result().textContent).toContain('21 acertos');
    expect(result().textContent).toContain('(4,37)');
    expect(result().textContent).toContain('faltam 8,60 para os 21');
    const rows = document.querySelectorAll('.simtab > div');
    expect(rows).toHaveLength(61);
    const hl = document.querySelectorAll('.simtab .hl');
    expect(hl).toHaveLength(1);
    expect(hl[0].textContent).toBe('214,37');
    expect(hl[0].querySelector('span')?.textContent).toBe('21');
    expect(screen.getByText(/Marketing Digital · P2/, { selector: '.meta' })).toBeTruthy();
  });

  it('unknown or missing query falls back to Cálculo livre', () => {
    history.replaceState(null, '', '#/calculadora?m=nada&p=p2');
    render(<Calculadora />);
    expect((screen.getByLabelText('Ligar a') as HTMLSelectElement).value).toBe('livre');
    expect(screen.queryByText('Desvincular')).toBeNull();
    cleanup();
    history.replaceState(null, '', '#/calculadora?m=marketing-digital&p=p9');
    render(<Calculadora />);
    expect((screen.getByLabelText('Ligar a') as HTMLSelectElement).value).toBe('livre');
  });

  it('livre: default Prova part, edits are stored under livre and never touch grades', () => {
    render(<Calculadora />);
    expect(screen.getByLabelText('Nome da parte 1')).toHaveProperty('value', 'Prova');
    type('Tirei na parte 1', '7,5');
    expect(state.value.composites['livre'].parts[0]).toMatchObject({ max: 10, tirei: 7.5 });
    expect(state.value.grades['marketing-digital'].p2).toEqual({ state: 'nao_feita', value: null });
    expect(result().textContent).toContain('Garantido na nota: 7,50');
    expect(screen.queryByText('Desvincular')).toBeNull();
  });

  it('selector links, updates the hash without reload, and edits reach the grade slot', () => {
    render(<Calculadora />);
    fireEvent.change(screen.getByLabelText('Ligar a'), { target: { value: 'marketing-digital:p2' } });
    expect(location.hash).toBe('#/calculadora?m=marketing-digital&p=p2');
    type('Tirei na parte 1', '4');
    expect(state.value.composites['marketing-digital:p2']).toBeDefined();
    expect(state.value.grades['marketing-digital'].p2).toMatchObject({ state: 'completa', value: 4 });
    fireEvent.change(screen.getByLabelText('Ligar a'), { target: { value: 'livre' } });
    expect(location.hash).toBe('#/calculadora');
    expect(state.value.composites['livre']).toBeUndefined();
  });

  it('Desvincular removes the composite and keeps the slot values', () => {
    setComposite('marketing-digital:p2', quizTrabalhoProva);
    history.replaceState(null, '', '#/calculadora?m=marketing-digital&p=p2');
    render(<Calculadora />);
    fireEvent.click(screen.getByText('Desvincular'));
    expect(state.value.composites['marketing-digital:p2']).toBeUndefined();
    expect(state.value.grades['marketing-digital'].p2).toMatchObject({ state: 'incompleta', value: 3.5, potencial: 6 });
    expect(screen.queryByText('Desvincular')).toBeNull();
  });

  it('validation message flags a sum different from 10 but still shows results', () => {
    render(<Calculadora />);
    type('Vale da parte 1', '8,5');
    expect(screen.getByRole('alert').textContent).toBe('A soma dos valores precisa dar 10 (agora: 8,5).');
    expect(result().textContent).toContain('ainda dá para ganhar: 8,50');
    fireEvent.click(screen.getByText('＋ adicionar parte'));
    type('Vale da parte 2', '1,5');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('peso mode: message uses %, nota 0-10 converts to points, needs are capped', () => {
    render(<Calculadora />);
    fireEvent.click(screen.getByText('Por peso'));
    expect(screen.getByLabelText('Peso da parte 1')).toHaveProperty('value', '100');
    type('Peso da parte 1', '60');
    expect(screen.getByRole('alert').textContent).toBe('A soma dos pesos precisa dar 100% (agora: 60%).');
    fireEvent.click(screen.getByText('＋ adicionar parte'));
    type('Peso da parte 2', '40');
    type('Nota na parte 1', '5');
    type('Nota na parte 2', '15');
    expect(state.value.composites['livre'].parts[1].tirei).toBe(10);
    expect(result().textContent).toContain('Garantido na nota: 7,00');
  });

  it('switching mode keeps the meaning of the parts', () => {
    render(<Calculadora />);
    type('Vale da parte 1', '4');
    type('Tirei na parte 1', '2');
    fireEvent.click(screen.getByText('Por peso'));
    expect(state.value.composites['livre']).toMatchObject({ mode: 'peso', parts: [{ max: 40, tirei: 5 }] });
    fireEvent.click(screen.getByText('Por pontos'));
    expect(state.value.composites['livre'].parts[0].max).toBeCloseTo(4);
    expect(state.value.composites['livre'].parts[0].tirei).toBeCloseTo(2);
  });

  it('add/remove parts keeps at least one; garbage input reverts', () => {
    render(<Calculadora />);
    expect((screen.getByLabelText('Remover parte 1') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByText('＋ adicionar parte'));
    expect(screen.getAllByLabelText(/^Nome da parte/)).toHaveLength(2);
    fireEvent.click(screen.getByLabelText('Remover parte 2'));
    expect(screen.getAllByLabelText(/^Nome da parte/)).toHaveLength(1);
    type('Vale da parte 1', 'abc');
    expect(screen.getByLabelText('Vale da parte 1')).toHaveProperty('value', '10');
    type('Vale da parte 1', '11');
    expect(state.value.composites['livre'].parts[0].max).toBe(10);
  });

  it('needs are rounded up, never in the student favor', () => {
    importNotas([nota('Gestão', 7, null, null)], '2026-11-14');
    setComposite('gestao:p2', { mode: 'pontos', parts: [{ nome: 'Prova', max: 10, tirei: null }] });
    history.replaceState(null, '', '#/calculadora?m=gestao&p=p2');
    render(<Calculadora />);
    // 14 left, split in 2 open slots = 7 each
    expect(result().textContent).toContain('Tire 7,00 em Prova (de 10)');
    cleanup();
    importNotas([nota('Gestão', 7.1, null, null)], '2026-11-14');
    setComposite('gestao:p2', { mode: 'pontos', parts: [{ nome: 'Prova', max: 10, tirei: null }] });
    render(<Calculadora />);
    // 21 - 7.1 = 13.9 / 2 = 6.95 exactly
    expect(result().textContent).toContain('6,95');
  });

  it('table highlight scrolls the table box to the row', () => {
    const top = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetTop');
    const height = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
    Object.defineProperty(HTMLElement.prototype, 'offsetTop', { configurable: true, get() { return Number(this.firstChild?.textContent) * 10; } });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get() { return 100; } });
    try {
      setComposite('marketing-digital:p2', quizTrabalhoProva);
      history.replaceState(null, '', '#/calculadora?m=marketing-digital&p=p2');
      render(<Calculadora />);
      expect((document.querySelector('.simtab') as HTMLElement).scrollTop).toBe(160);
    } finally {
      if (top) Object.defineProperty(HTMLElement.prototype, 'offsetTop', top); else delete (HTMLElement.prototype as unknown as Record<string, unknown>).offsetTop;
      if (height) Object.defineProperty(HTMLElement.prototype, 'clientHeight', height); else delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
    }
  });

  describe('seeding from the existing grade (no store write until an edit)', () => {
    const open = (p: string) => { history.replaceState(null, '', `#/calculadora?m=marketing-digital&p=${p}`); render(<Calculadora />); };
    const val = (l: string) => (screen.getByLabelText(l) as HTMLInputElement).value;

    it('completa slot: one Prova part with the grade; slot stays 8,90 until an edit', () => {
      const before = state.value;
      open('p1');
      expect(val('Nome da parte 1')).toBe('Prova');
      expect(val('Tirei na parte 1')).toBe('8,9');
      expect(state.value).toBe(before);
      expect(state.value.grades['marketing-digital'].p1).toEqual({ state: 'completa', value: 8.9 });
      type('Nome da parte 1', 'Prova final');
      expect(state.value.grades['marketing-digital'].p1).toMatchObject({ state: 'completa', value: 8.9 });
    });

    it('incompleta slot: Já garantido + Restante', () => {
      setGradeSlot('marketing-digital', 'p2', { state: 'incompleta', value: 1, potencial: 9 });
      const before = state.value;
      open('p2');
      expect(val('Nome da parte 1')).toBe('Já garantido');
      expect(val('Vale da parte 1')).toBe('1');
      expect(val('Tirei na parte 1')).toBe('1');
      expect(val('Nome da parte 2')).toBe('Restante');
      expect(val('Vale da parte 2')).toBe('9');
      expect(val('Tirei na parte 2')).toBe('');
      expect(state.value).toBe(before);
    });

    it('nao_feita slot: blank Prova of 10', () => {
      const before = state.value;
      open('p2');
      expect(val('Vale da parte 1')).toBe('10');
      expect(val('Tirei na parte 1')).toBe('');
      expect(state.value).toBe(before);
    });

    it('outlook, needs and table highlight show right after selecting, and agree', () => {
      open('p2');
      expect(result().textContent).toContain('Com 8,90 pontos na matéria, faltam 12,10 para os 21.');
      expect(result().textContent).toContain('Tire 6,05 em Prova (de 10)');
      expect(result().textContent).toContain('30 acertos');
      expect(document.querySelector('.simtab .hl span')?.textContent).toBe('30');
    });

    it('invalid composite is kept in the form but does not change the slot', () => {
      open('p1');
      type('Vale da parte 1', '8');
      expect(screen.getByText('Corrija a soma para atualizar a nota da matéria.')).toBeTruthy();
      expect(state.value.composites['marketing-digital:p1'].parts[0].max).toBe(8);
      expect(state.value.grades['marketing-digital'].p1).toEqual({ state: 'completa', value: 8.9 });
    });

    it('shows a needed amount of 10/3 rounded up as 3,34', () => {
      importNotas([nota('Gestão', 1)], '2026-11-14');
      // P1 = 1: 20 points still needed, 10 from P2 and 10 from the simulado; 3 open parts share P2's 10
      setComposite('gestao:p2', { mode: 'pontos', parts: [{ nome: 'A', max: 4, tirei: null }, { nome: 'B', max: 4, tirei: null }, { nome: 'C', max: 4, tirei: null }] });
      history.replaceState(null, '', '#/calculadora?m=gestao&p=p2');
      render(<Calculadora />);
      expect(result().textContent).toContain('Tire 3,34 em A (de 4)');
      expect(result().textContent).toContain('Tire 3,34 em C (de 4)');
    });
  });
});
