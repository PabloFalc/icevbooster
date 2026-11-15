import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { resetForTests, setSchedule, setSimulado, state } from '../../state/store';
import type { Schedule, Subject } from '../../domain/types';
import { Calendario } from './Calendario';

const pdf = vi.hoisted(() => ({ pdfToText: vi.fn(), extractCalendarCandidates: vi.fn() }));
vi.mock('../../ocr/pdfCalendar', () => pdf);

const sub = (id: string, nome: string, ch: number | null, faltas: number): Subject =>
  ({ id, nome, faltas, pendentes: 0, percentual: null, ch, chSource: ch === null ? null : 'manual' });

const schedule: Schedule = { 1: ['eletivaVI', 'extensao'], 2: ['eletiva', 'po'], 3: ['estagio', 'po'], 4: ['gestao', 'gestao'], 5: ['marketing', null] };
const base = [
  sub('eletiva', 'Eletiva II', 36, 9), sub('marketing', 'Marketing Digital', 36, 4),
  sub('po', 'Pesquisa Operacional', 72, 8), sub('gestao', 'Gestão de Projetos', 72, 0),
];

function seed() {
  state.value = { ...state.value, subjects: base, faltasPrintDate: '2026-11-16' };
  setSchedule(schedule);
  setSimulado('2026-12-10');
}

const cell = (n: number, month = 'novembro') => screen.getByRole('button', { name: new RegExp(`^${n} de ${month}`) });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-16T12:00:00'));
  resetForTests();
  vi.clearAllMocks();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Calendário page', () => {
  it('renders the month, holiday cell, day detail and next month', () => {
    seed();
    render(<Calendario />);
    expect(screen.getByText('Novembro 2026')).toBeTruthy();
    expect(cell(20).className).toContain('hol');
    expect(cell(20).getAttribute('title')).toBe('Consciência Negra');
    expect(cell(17).getAttribute('aria-label')).toBe('17 de novembro, não pode faltar');
    fireEvent.click(cell(17));
    expect(screen.getByText(/Eletiva II está sem saldo/).textContent).toBe('Eletiva II está sem saldo: qualquer falta reprova.');
    expect(screen.getByText(/Eletiva II · 18:20/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }));
    expect(screen.getByText('Dezembro 2026')).toBeTruthy();
    expect(cell(10, 'dezembro').className).toContain('sim');
    fireEvent.click(screen.getByRole('button', { name: 'Hoje' }));
    expect(screen.getByText('Novembro 2026')).toBeTruthy();
  });

  it('observations: two-class day, save-for-later, holiday and simulado day', () => {
    seed();
    render(<Calendario />);
    fireEvent.click(cell(19)); // Thursday: Gestão x2
    expect(screen.getByText('Gestão de Projetos tem 2 aulas neste dia: falte o dia todo ou nenhum.')).toBeTruthy();
    fireEvent.click(cell(18)); // Wednesday: PO has saldo but skip window starts later
    expect(screen.getByText(/Pesquisa Operacional: vá a esta aula — o saldo é guardado/)).toBeTruthy();
    fireEvent.click(cell(20));
    expect(screen.getByText('Consciência Negra — sem aula.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }));
    fireEvent.click(cell(10, 'dezembro'));
    expect(screen.getByText('Dia do simulado — sem falta.')).toBeTruthy();
  });

  it('subject chips filter the colors', () => {
    seed();
    render(<Calendario />);
    expect(cell(17).className).toContain('no');
    fireEvent.click(screen.getByRole('button', { name: /Pesquisa Operacional/ }));
    expect(cell(17).className).not.toContain('no');
    expect(screen.queryByRole('button', { name: /Eletiva VI/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Todas' }));
    expect(cell(17).className).toContain('no');
  });

  it('toggles sem aula / tem aula and extra class day', () => {
    seed();
    render(<Calendario />);
    fireEvent.click(cell(18));
    fireEvent.click(screen.getByRole('button', { name: 'Marcar sem aula' }));
    expect(state.value.overrides.noClass['2026-11-18']).toBe('Sem aula');
    expect(cell(18).className).toContain('hol');
    fireEvent.click(screen.getByRole('button', { name: 'Tem aula neste dia' }));
    expect(state.value.overrides.noClass).toEqual({});
    fireEvent.click(cell(20));
    fireEvent.click(screen.getByRole('button', { name: 'Tem aula neste dia' }));
    expect(state.value.overrides.removedHolidays).toEqual(['2026-11-20']);
    fireEvent.click(cell(21)); // Saturday
    fireEvent.change(screen.getByLabelText('Dia extra segue o horário de'), { target: { value: '2' } });
    expect(state.value.overrides.extraDays['2026-11-21']).toBe(2);
  });

  it('imports PDF candidates after a confirm list and offers the simulado date', async () => {
    seed();
    pdf.pdfToText.mockResolvedValue('x');
    pdf.extractCalendarCandidates.mockReturnValue([
      { date: '2026-11-25', label: 'Recesso', kind: 'outro' },
      { date: '2026-11-25', label: 'Recesso escolar', kind: 'sem_aula' },
      { date: '2026-11-26', label: 'Evento', kind: 'outro' },
      { date: '2026-12-15', label: 'Simulado geral', kind: 'simulado' },
    ]);
    render(<Calendario />);
    fireEvent.change(screen.getByLabelText(/Enviar PDF/), { target: { files: [new File(['x'], 'c.pdf', { type: 'application/pdf' })] } });
    await waitFor(() => screen.getByText('Importar dias marcados'));
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(boxes.map((b) => b.checked)).toEqual([true, false]); // 25/11 once, sem_aula preferred
    fireEvent.click(screen.getByRole('button', { name: 'Usar 15/12 como data do simulado' }));
    expect(state.value.simulado).toBe('2026-12-15');
    fireEvent.click(screen.getByText('Importar dias marcados'));
    expect(state.value.overrides.noClass).toEqual({ '2026-11-25': 'Recesso escolar' });
  });

  it('does not invent saldo observations without a valid plan or without CH', () => {
    state.value = { ...state.value, subjects: base };
    setSchedule(schedule); // no simulado: no plan
    render(<Calendario />);
    fireEvent.click(cell(18));
    expect(screen.queryByText(/vá a esta aula/)).toBeNull();
    expect(screen.getByText('Pesquisa Operacional: sem cálculo — confira as faltas/carga horária na aba Faltas.')).toBeTruthy();
    cleanup();
    resetForTests();
    state.value = { ...state.value, subjects: [...base.filter((b) => b.id !== 'po'), sub('po', 'Pesquisa Operacional', null, 0)] };
    setSchedule(schedule);
    setSimulado('2026-12-10');
    render(<Calendario />);
    fireEvent.click(cell(18));
    expect(screen.queryByText(/vá a esta aula/)).toBeNull();
    expect(screen.getByText(/Pesquisa Operacional: sem cálculo/)).toBeTruthy();
    expect(screen.queryByText(/aulas · Pesquisa Operacional/)).toBeNull(); // no saldo tile without a saldo
  });

  it('shows the year of PDF candidates', async () => {
    seed();
    pdf.pdfToText.mockResolvedValue('x');
    pdf.extractCalendarCandidates.mockReturnValue([{ date: '2026-11-25', label: 'Recesso', kind: 'sem_aula' }]);
    render(<Calendario />);
    fireEvent.change(screen.getByLabelText(/Enviar PDF/), { target: { files: [new File(['x'], 'c.pdf', { type: 'application/pdf' })] } });
    await waitFor(() => screen.getByText('25/11/2026'));
  });
});
