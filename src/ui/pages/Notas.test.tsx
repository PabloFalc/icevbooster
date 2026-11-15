import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { importNotas, resetForTests, setComposite, setGradeSlot, state } from '../../state/store';
import { Notas } from './Notas';

const ocr = vi.hoisted(() => ({ runOcr: vi.fn() }));
vi.mock('../../ocr/ocr', () => ocr);
const parsers = vi.hoisted(() => ({ parseNotas: vi.fn() }));
vi.mock('../../ocr/parseNotas', () => ({ parseNotas: parsers.parseNotas }));

const nota = (nome: string, p1: number | null, p2: number | null = null, p3: number | null = null) =>
  ({ nome, p1, p2, p3, media: null, rec: null, mediaFinal: null });
const card = (nome: string) => screen.getByRole('heading', { name: nome }).closest('section') as HTMLElement;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-14T12:00:00'));
  resetForTests();
  vi.clearAllMocks();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Notas page', () => {
  it('empty state asks for the notas print', () => {
    render(<Notas />);
    expect(screen.getByText(/Envie o print de notas do portal \(ou o print de faltas\)/)).toBeTruthy();
  });

  it('incompleta P2: numbers, split and simulado hits', () => {
    importNotas([nota('Marketing Digital', 8.9, 1)], '2026-11-14');
    setGradeSlot('marketing-digital', 'p2', { state: 'incompleta', value: 1 });
    render(<Notas />);
    expect(document.querySelector('.upl-t')?.textContent).toBe('Print de 14/11/2026i');
    const c = within(card('Marketing Digital'));
    expect(c.getByText('9,90')).toBeTruthy();
    expect(c.getByText('27')).toBeTruthy(); // simulado tile: acertos
    expect(c.getByText('acertos · 5,62')).toBeTruthy();
    expect(c.getByText('5,55')).toBeTruthy(); // P2 tile
    expect(c.getByText('em andamento')).toBeTruthy();
    expect(c.getByText('+9,00')).toBeTruthy();
    expect(c.getByText('Calculadora ›').getAttribute('href')).toBe('#/calculadora?m=marketing-digital&p=p2');
  });

  it('needed amounts round up, current and achievable figures round down', () => {
    importNotas([nota('Marketing Digital', null)], '2026-11-14');
    setGradeSlot('marketing-digital', 'p1', { state: 'incompleta', value: 0.976 });
    render(<Notas />);
    const c = within(card('Marketing Digital'));
    expect(c.getByText('0,97')).toBeTruthy(); // pontos atuais
    expect(c.getByText('+9,02')).toBeTruthy();
    expect(c.getAllByText('6,68')).toHaveLength(2); // 20,024 / 3 per prova: P1 and P2 tiles (simulado shows acertos)
    expect(c.getByText('de 9,02')).toBeTruthy();
  });

  it('REC path: máx. rounds down, REC shares round up', () => {
    importNotas([nota('Difícil', 0.976)], '2026-11-14');
    render(<Notas />);
    const c = within(card('Difícil'));
    expect(c.getByText('Para ir à REC final (média ≥ 4)')).toBeTruthy();
    expect(c.getAllByText('5,52')).toHaveLength(1); // 11,024 / 2: P2 tile (simulado shows acertos)
  });

  it('só com REC path', () => {
    importNotas([nota('Difícil', 0.5, 2)], '2026-11-14');
    render(<Notas />);
    const c = within(card('Difícil'));
    expect(c.getByText('REC final', { selector: '.badge' })).toBeTruthy();
    expect(c.getByLabelText('REC final: não dá para chegar aos 21 pontos, mas a média fica em 4 ou mais.')).toBeTruthy();
    expect(c.getByText('REC final', { selector: '.t-l' })).toBeTruthy();
    expect(c.getByText('Para ir à REC final (média ≥ 4)')).toBeTruthy();
    expect(c.getByText('8/10')).toBeTruthy();
    expect(c.getByText('46')).toBeTruthy();
  });

  it('aprovado and reprovado copy', () => {
    importNotas([nota('Boa', 10, 10, 7), nota('Ruim', 1, 1, 1)], '2026-11-14');
    render(<Notas />);
    expect(within(card('Boa')).getByText('Aprovado')).toBeTruthy();
    expect(within(card('Boa')).getByText('aprovado')).toBeTruthy();
    expect(within(card('Ruim')).getByText('Reprovado')).toBeTruthy();
    expect(within(card('Ruim')).getByText('reprovado')).toBeTruthy();
  });

  it('tag cycles completa → incompleta → não feita → completa; P3 skips incompleta', () => {
    importNotas([nota('Marketing Digital', 5, null, 5)], '2026-11-14');
    render(<Notas />);
    const c = within(card('Marketing Digital'));
    const p1 = () => state.value.grades['marketing-digital'].p1;
    fireEvent.click(c.getByRole('button', { name: /Estado da P1/ }));
    expect(p1()).toMatchObject({ state: 'incompleta', value: 5 });
    fireEvent.click(c.getByRole('button', { name: /Estado da P1/ }));
    expect(p1()).toEqual({ state: 'nao_feita', value: null });
    fireEvent.click(c.getByRole('button', { name: /Estado da P1/ }));
    expect(p1().state).toBe('completa');
    fireEvent.click(c.getByRole('button', { name: /Estado da P3/ }));
    expect(state.value.grades['marketing-digital'].p3.state).toBe('nao_feita');
    fireEvent.click(c.getByRole('button', { name: /Estado da P3/ }));
    expect(state.value.grades['marketing-digital'].p3.state).toBe('completa');
  });

  it('typing clamps with comma decimals; empty clears; garbage reverts', () => {
    importNotas([nota('Marketing Digital', 5)], '2026-11-14');
    render(<Notas />);
    const input = screen.getByLabelText('P2 de Marketing Digital') as HTMLInputElement;
    const g = () => state.value.grades['marketing-digital'];
    fireEvent.input(input, { target: { value: '7,5' } });
    fireEvent.blur(input);
    expect(g().p2).toEqual({ state: 'completa', value: 7.5 });
    fireEvent.input(input, { target: { value: '15' } });
    fireEvent.blur(input);
    expect(g().p2.value).toBe(10);
    fireEvent.input(input, { target: { value: 'abc' } });
    fireEvent.blur(input);
    expect(g().p2.value).toBe(10);
    expect(input.value).toBe('10');
    fireEvent.input(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(g().p2).toEqual({ state: 'nao_feita', value: null });
  });

  it('slot linked to a composite is not tappable and points to the calculator', () => {
    importNotas([nota('Marketing Digital', 5, 5)], '2026-11-14');
    setComposite('marketing-digital:p2', { mode: 'pontos', parts: [{ nome: 'Quiz', max: 10, tirei: 4 }] });
    render(<Notas />);
    const c = within(card('Marketing Digital'));
    expect(c.queryByRole('button', { name: /Estado da P2/ })).toBeNull();
    expect(c.getByText('via calculadora').closest('a')?.getAttribute('href')).toBe('#/calculadora?m=marketing-digital&p=p2');
    expect((screen.getByLabelText('P2 de Marketing Digital') as HTMLInputElement).readOnly).toBe(true);
  });

  it('detail link points at P1 when P2 is completa and P1 is not', () => {
    importNotas([nota('Marketing Digital', null, 5)], '2026-11-14');
    render(<Notas />);
    expect(screen.getByText('Calculadora ›').getAttribute('href')).toBe('#/calculadora?m=marketing-digital&p=p1');
  });

  it('subject without grades shows all slots não feita', () => {
    state.value = { ...state.value, subjects: [{ id: 'x', nome: 'Sem notas', faltas: 0, pendentes: 0, percentual: null, ch: 36, chSource: 'manual' }] };
    render(<Notas />);
    expect(within(card('Sem notas')).getAllByText('não feita')).toHaveLength(3);
    expect(within(card('Sem notas')).getAllByText('7,00')).toHaveLength(2);
    expect(within(card('Sem notas')).getByText('0,00')).toBeTruthy();
  });

  it('Projeto de Extensão: one P1 = P2 box, P3 without simulado', () => {
    importNotas([nota('Projeto de Extensão VI', 6)], '2026-11-14');
    render(<Notas />);
    const c = within(card('Projeto de Extensão VI'));
    expect(c.getAllByText('P1 = P2')).toHaveLength(1);
    expect(c.queryByText(/simulado/i)).toBeNull();
    expect(c.getByText('9,00')).toBeTruthy(); // P3 tile: 21 − 2 × 6
    expect(c.getByText('12,00')).toBeTruthy(); // progress
  });

  it('uploads a notas print through local OCR and imports it', async () => {
    ocr.runOcr.mockResolvedValue([]);
    parsers.parseNotas.mockReturnValue([nota('Marketing Digital', 8)]);
    render(<Notas />);
    const file = new File(['x'], 'notas.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText(/Enviar print de notas/), { target: { files: [file] } });
    await waitFor(() => expect(state.value.notasPrintDate).toBe('2026-11-14'));
    expect(ocr.runOcr).toHaveBeenCalledWith(file);
    expect(state.value.grades['marketing-digital'].p1).toEqual({ state: 'completa', value: 8 });
  });
});
