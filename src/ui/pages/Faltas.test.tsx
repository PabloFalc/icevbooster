import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { resetForTests, setSchedule, setSimulado, state } from '../../state/store';
import type { Schedule, Subject } from '../../domain/types';
import { Faltas } from './Faltas';

const ocr = vi.hoisted(() => ({ runOcr: vi.fn(), HORARIO_OCR: { upscale: 3, sparse: true } }));
vi.mock('../../ocr/ocr', () => ocr);
const parsers = vi.hoisted(() => ({ parseFaltas: vi.fn(), parseHorario: vi.fn(), parseHistorico: vi.fn() }));
vi.mock('../../ocr/parseFaltas', () => ({ parseFaltas: parsers.parseFaltas }));
vi.mock('../../ocr/parseHorario', () => ({ parseHorario: parsers.parseHorario }));
vi.mock('../../ocr/parseHistorico', () => ({ parseHistorico: parsers.parseHistorico }));

const sub = (id: string, nome: string, ch: number | null, faltas: number, extra: Partial<Subject> = {}): Subject =>
  ({ id, nome, faltas, pendentes: 0, percentual: null, ch, chSource: ch === null ? null : 'manual', ...extra });

// Task 5 `base` data, with display names.
const schedule: Schedule = { 1: ['eletivaVI', 'extensao'], 2: ['eletiva', 'po'], 3: ['estagio', 'po'], 4: ['gestao', 'gestao'], 5: ['marketing', null] };
const base = [
  sub('eletiva', 'Eletiva II', 36, 9), sub('marketing', 'Marketing Digital', 36, 4),
  sub('po', 'Pesquisa Operacional', 72, 8), sub('gestao', 'Gestão de Projetos', 72, 0),
];

function seed(subjects: Subject[] = base, simulado: string | null = '2026-12-10', sch: Schedule = schedule) {
  state.value = { ...state.value, subjects, faltasPrintDate: '2026-11-16' };
  setSchedule(sch);
  setSimulado(simulado);
}

const row = (nome: string) => screen.getByText(nome).closest('tr') as HTMLElement;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-16T12:00:00'));
  resetForTests();
  vi.clearAllMocks();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Faltas page', () => {
  it('shows the skip plan hero and table', () => {
    seed();
    render(<Faltas />);
    expect(screen.getByText(/Pode faltar tudo a partir de/).textContent).toContain('25/11');
    expect(screen.getByText(/exceto Eletiva II/).textContent).toBe('exceto Eletiva II (sem saldo)');
    expect(row('Marketing Digital').textContent).toContain('2 aulas');
    expect(row('Marketing Digital').textContent).toContain('2 aulas (5 faltas)');
    expect(row('Marketing Digital').textContent).toContain('11,1%');
  });

  it('asks for the simulado date or says it passed', () => {
    seed(base, null);
    render(<Faltas />);
    expect(screen.getByText('Informe a data do simulado')).toBeTruthy();
    setSimulado('2026-11-10');
    cleanup();
    render(<Faltas />);
    expect(screen.getByText('A data do simulado já passou')).toBeTruthy();
  });

  it('hero lists subjects left out of the plan with their reason, never as free days', () => {
    const sch: Schedule = { ...schedule, 1: ['redes', 'novo'] };
    seed([...base, sub('ingles', 'Inglês VI', 36, 0), sub('novo', 'Estatística', null, 2), sub('redes', 'Redes', 36, 0, { conferir: true })], '2026-12-10', sch);
    render(<Faltas />);
    expect(screen.getByText(/Pode faltar tudo a partir de/).textContent).toContain('25/11');
    expect(screen.getByText(/^exceto /).textContent).toBe(
      'exceto Eletiva II (sem saldo), Inglês VI (sem horário), Estatística (sem carga horária), Redes (confira as faltas)',
    );
  });

  it('hero names excluded subjects even when nothing can be skipped', () => {
    seed([sub('eletiva', 'Eletiva II', 36, 9), sub('redes', 'Redes', 36, 0, { conferir: true })], '2026-12-10', { ...schedule, 1: ['redes', null] });
    render(<Faltas />);
    expect(screen.getByText('Não dá para faltar tudo antes do simulado')).toBeTruthy();
    expect(screen.getByText('Eletiva II (sem saldo), Redes (confira as faltas)')).toBeTruthy();
  });

  it('"Parar a partir de" column: date, já, não pode, folga', () => {
    seed();
    render(<Faltas />);
    expect(row('Pesquisa Operacional').textContent).toContain('25/11');
    expect(row('Marketing Digital').textContent).toContain('já'); // saldo 2 covers 27/11 and 04/12
    expect(row('Gestão de Projetos').textContent).toContain('já');
    expect(row('Gestão de Projetos').textContent).toContain('+3 aulas de folga');
    expect(row('Eletiva II').textContent).toContain('não pode');
  });

  it('exception wording for saldo that does not cover the last day and for no classes left', () => {
    // Gestão: 72h, 16 faltas → saldo 1 aula, but Thursdays have 2 classes.
    seed([sub('gestao', 'Gestão de Projetos', 72, 16), sub('marketing', 'Marketing Digital', 36, 0), sub('po', 'Pesquisa Operacional', 72, 0)], '2026-11-20');
    render(<Faltas />);
    const line = screen.getByText(/^exceto /).textContent;
    expect(line).toContain('Gestão de Projetos (saldo não cobre o último dia de aula)');
    // Marketing is on Friday; 20/11 is the simulado (and a holiday), so no class left.
    expect(line).toContain('Marketing Digital (sem aulas até o simulado)');
    expect(row('Gestão de Projetos').textContent).toContain('—');
  });

  it('flags conferir, missing CH and subjects missing from the schedule', () => {
    seed([...base, sub('ingles', 'Inglês VI', 36, 0), sub('novo', 'Estatística', null, 2), sub('gp', 'Redes', 36, 0, { conferir: true })]);
    render(<Faltas />);
    expect(screen.getByText('Não consegui ler as faltas de Redes — confira e digite o valor.')).toBeTruthy();
    expect(row('Redes').className).toContain('conferir');
    expect(within(row('Estatística')).getByText('Escolha a carga horária')).toBeTruthy();
    expect(screen.getByText('Inglês VI não aparece no horário — preencha manualmente.')).toBeTruthy();
  });

  it('edits faltas with comma decimals and never writes NaN', () => {
    seed();
    render(<Faltas />);
    const input = within(row('Marketing Digital')).getByLabelText('Faltas de Marketing Digital') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'abc' } });
    fireEvent.blur(input);
    expect(state.value.subjects.find((s) => s.id === 'marketing')?.faltas).toBe(4);
    expect(input.value).toBe('4');
    fireEvent.input(input, { target: { value: '7,5' } });
    fireEvent.blur(input);
    expect(state.value.subjects.find((s) => s.id === 'marketing')?.faltas).toBe(7.5);
    expect(input.value).toBe('7,5');
  });

  it('CH select sets a manual CH, including "outra"', () => {
    seed([...base, sub('novo', 'Estatística', null, 2)]);
    render(<Faltas />);
    const select = within(row('Estatística')).getByLabelText('Carga horária de Estatística') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '72' } });
    expect(state.value.subjects.find((s) => s.id === 'novo')).toMatchObject({ ch: 72, chSource: 'manual' });
    fireEvent.change(select, { target: { value: 'outra' } });
    const other = within(row('Estatística')).getByLabelText('Outra carga horária de Estatística');
    fireEvent.input(other, { target: { value: '0' } });
    fireEvent.blur(other);
    expect(state.value.subjects.find((s) => s.id === 'novo')?.ch).toBe(72);
    fireEvent.input(other, { target: { value: '100' } });
    fireEvent.blur(other);
    expect(state.value.subjects.find((s) => s.id === 'novo')).toMatchObject({ ch: 100, chSource: 'manual' });
  });

  it('warns when the print date is not today', () => {
    seed();
    render(<Faltas />);
    expect(screen.queryByText('Confira se o portal já lançou todas as faltas.')).toBeNull();
    fireEvent.change(screen.getByLabelText('Data do print de faltas'), { target: { value: '2026-11-10' } });
    expect(screen.getByText('Confira se o portal já lançou todas as faltas.')).toBeTruthy();
  });

  it('uploads a faltas print through local OCR', async () => {
    ocr.runOcr.mockResolvedValue([]);
    parsers.parseFaltas.mockReturnValue([{ nome: 'Marketing Digital', faltas: 4, percentual: 11.11 }]);
    render(<Faltas />);
    expect(screen.getAllByText('Tire o print com a tabela completa visível — todas as linhas e colunas.').length).toBeGreaterThan(0);
    const file = new File(['x'], 'faltas.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText(/Print de faltas/), { target: { files: [file] } });
    expect(screen.getByText('Lendo o print…')).toBeTruthy();
    await waitFor(() => expect(state.value.subjects.map((s) => s.nome)).toEqual(['Marketing Digital']));
    expect(ocr.runOcr).toHaveBeenCalledWith(file);
    expect(state.value.faltasPrintDate).toBe('2026-11-16');
  });

  it('shows the failure copy when OCR fails', async () => {
    ocr.runOcr.mockRejectedValue(new Error('boom'));
    render(<Faltas />);
    fireEvent.change(screen.getByLabelText(/Print de faltas/), { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } });
    await screen.findByText('Não consegui ler esse print. Tente outro print ou preencha manualmente.');
  });

  it('horário print uses HORARIO_OCR and opens the manual grid when parsing is not ok', async () => {
    seed(base, '2026-12-10', { 1: [null, null], 2: [null, null], 3: [null, null], 4: [null, null], 5: [null, null] });
    ocr.runOcr.mockResolvedValue([]);
    parsers.parseHorario.mockReturnValue({ cells: [{ weekday: 5, slot: 0, nome: 'Marketing Digital' }], ok: false });
    render(<Faltas />);
    expect(screen.queryByLabelText('Seg 18:20')).toBeNull();
    fireEvent.change(screen.getByLabelText(/Print do horário/), { target: { files: [new File(['x'], 'h.png', { type: 'image/png' })] } });
    await screen.findByLabelText('Seg 18:20');
    expect(ocr.runOcr).toHaveBeenCalledWith(expect.any(File), ocr.HORARIO_OCR);
    expect(state.value.schedule[5]).toEqual(['marketing', null]);
    fireEvent.change(screen.getByLabelText('Ter 18:20'), { target: { value: 'eletiva' } });
    expect(state.value.schedule[2]).toEqual(['eletiva', null]);
  });

  it('horário import warns about unmatched cells and the grid stays visible after navigation', async () => {
    seed(base, '2026-12-10', { 1: [null, null], 2: [null, null], 3: [null, null], 4: [null, null], 5: [null, null] });
    ocr.runOcr.mockResolvedValue([]);
    parsers.parseHorario.mockReturnValue({ cells: [{ weekday: 5, slot: 0, nome: 'Marketing Digital' }, { weekday: 1, slot: 0, nome: 'Eletiva VI' }], ok: true });
    render(<Faltas />);
    fireEvent.change(screen.getByLabelText(/Print do horário/), { target: { files: [new File(['x'], 'h.png', { type: 'image/png' })] } });
    await screen.findByText('Eletiva VI (horário) não corresponde a nenhuma matéria do print de faltas');
    expect((screen.getByLabelText('Sex 18:20') as HTMLSelectElement).value).toBe('marketing');
    cleanup();
    render(<Faltas />); // back from another tab
    expect(screen.getByLabelText('Sex 18:20')).toBeTruthy();
    expect(screen.getByText('Eletiva VI (horário) não corresponde a nenhuma matéria do print de faltas')).toBeTruthy();
  });

  it('a non-empty schedule is behind a "Conferir horário" toggle', () => {
    seed();
    render(<Faltas />);
    expect(screen.queryByLabelText('Seg 18:20')).toBeNull();
    const toggle = screen.getByRole('button', { name: 'Conferir horário' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(screen.getByLabelText('Seg 18:20')).toBeTruthy();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('horário or histórico before the faltas print asks for it first', async () => {
    render(<Faltas />);
    fireEvent.change(screen.getByLabelText(/Print do horário/), { target: { files: [new File(['x'], 'h.png', { type: 'image/png' })] } });
    fireEvent.change(screen.getByLabelText(/Print do histórico/), { target: { files: [new File(['x'], 'h.png', { type: 'image/png' })] } });
    await waitFor(() => expect(screen.getAllByText('Envie primeiro o print de faltas.').length).toBe(2));
    expect(ocr.runOcr).not.toHaveBeenCalled();
  });

  it('a horário print with no matching subject fails and keeps the schedule', async () => {
    seed();
    ocr.runOcr.mockResolvedValue([]);
    parsers.parseHorario.mockReturnValue({ cells: [{ weekday: 1, slot: 0, nome: 'Física' }], ok: true });
    render(<Faltas />);
    fireEvent.change(screen.getByLabelText(/Print do horário/), { target: { files: [new File(['x'], 'h.png', { type: 'image/png' })] } });
    await screen.findByText('Não consegui ler esse print. Tente outro print ou preencha manualmente.');
    expect(state.value.schedule).toEqual(schedule);
  });

  it('"Preencher manualmente" opens the grid', () => {
    seed();
    render(<Faltas />);
    fireEvent.click(screen.getByText('Preencher manualmente'));
    const sel = screen.getByLabelText('Qui 20:20') as HTMLSelectElement;
    expect(sel.value).toBe('gestao');
    expect([...sel.options].map((o) => o.textContent)).toContain('—');
  });

  it('compact month grid colors days and links to the calendar', () => {
    seed();
    const { container } = render(<Faltas />);
    expect(screen.getByText('Abrir calendário ›').getAttribute('href')).toBe('#/calendario');
    const day = (n: number) => [...container.querySelectorAll('.mini .d')].find((d) => d.textContent === String(n)) as HTMLElement;
    expect(day(17).className).toContain('no');
    expect(day(27).className).toContain('ok');
    expect(day(20).className).toContain('hol');
    expect(day(21).className).toContain('wk');
    expect(day(16).className).toContain('today');
  });
});
