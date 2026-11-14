import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  importFaltas, importHistorico, importHorario, importNotas, loadState, resetForTests, saveState, clearState,
  setComposite, state, plan, outlooks, STORAGE_KEY, updateSubject, setSchedule, setSimulado, setFaltasPrintDate, emptySchedule,
} from './store';

const fakeStorage = (): Storage => {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k),
  };
};
const sub = (nome: string) => state.value.subjects.find((s) => s.nome === nome);
const nota = (nome: string, p1: number | null, p2: number | null = null, p3: number | null = null) =>
  ({ nome, p1, p2, p3, media: null, rec: null, mediaFinal: null });

beforeEach(() => { resetForTests(); vi.useRealTimers(); });

describe('importFaltas / importHistorico', () => {
  it('resolves ch and lets historico win', () => {
    importFaltas([{ nome: 'Marketing Digital', faltas: 4, percentual: 11.11 }, { nome: 'Inglês VI', faltas: 0, percentual: 0 }], '2026-11-14');
    expect(sub('Marketing Digital')).toMatchObject({ ch: 36, chSource: 'percentual', id: 'marketing-digital' });
    expect(sub('Inglês VI')).toMatchObject({ ch: 36, chSource: 'fixo' });
    importHistorico([{ nome: 'Marketing Digital', faltas: 4, ch: 36 }, { nome: 'Inglês VI', faltas: 0, ch: null }]);
    expect(sub('Marketing Digital')?.chSource).toBe('historico');
    expect(sub('Inglês VI')?.chSource).toBe('fixo');
  });
  it('keeps manual ch and pendentes on re-import; historico never overrides manual', () => {
    importFaltas([{ nome: 'Gestão', faltas: 2, percentual: null }], '2026-11-01');
    state.value = { ...state.value, subjects: state.value.subjects.map((s) => ({ ...s, ch: 72, chSource: 'manual' as const, pendentes: 3 })) };
    importFaltas([{ nome: 'Gestao', faltas: 6, percentual: 8.33 }], '2026-11-14');
    importHistorico([{ nome: 'Gestão', faltas: 6, ch: 36 }]);
    expect(state.value.subjects).toHaveLength(1);
    expect(state.value.subjects[0]).toMatchObject({ faltas: 6, ch: 72, chSource: 'manual', pendentes: 3 });
  });
  it('null faltas sets conferir and keeps the old count; a number clears it', () => {
    importFaltas([{ nome: 'Gestão', faltas: 5, percentual: null }], '2026-11-01');
    importFaltas([{ nome: 'Gestão', faltas: null, percentual: null }, { nome: 'Novo', faltas: null, percentual: null }], '2026-11-14');
    expect(sub('Gestão')).toMatchObject({ faltas: 5, conferir: true });
    expect(sub('Novo')).toMatchObject({ faltas: 0, conferir: true });
    importFaltas([{ nome: 'Gestão', faltas: 7, percentual: null }], '2026-11-15');
    expect(sub('Gestão')?.conferir).toBeUndefined();
  });
  it('ids avoid collisions and NaN is not written', () => {
    importFaltas([{ nome: 'Eletiva I', faltas: NaN, percentual: NaN }, { nome: 'Eletiva II', faltas: 1, percentual: null }], '2026-11-14');
    expect(state.value.subjects.map((s) => s.id)).toEqual(['eletiva-i', 'eletiva-ii']);
    expect(sub('Eletiva I')).toMatchObject({ faltas: 0, percentual: null, conferir: true });
  });
});

describe('importHorario', () => {
  it('fills matching cells and drops unmatched', () => {
    importFaltas([{ nome: 'Marketing Digital', faltas: 0, percentual: null }], '2026-11-14');
    importHorario([{ weekday: 1, slot: 0, nome: 'Marketing Digital' }, { weekday: 2, slot: 1, nome: 'Desconhecida' }]);
    expect(state.value.schedule[1]).toEqual(['marketing-digital', null]);
    expect(state.value.schedule[2]).toEqual([null, null]);
  });
});

describe('importNotas / setComposite', () => {
  it('creates missing subjects, maps states, protects composite slots', () => {
    importNotas([nota('Cálculo', 7.5, null, 9)], '2026-11-14');
    expect(sub('Cálculo')).toMatchObject({ faltas: 0, ch: null });
    expect(state.value.grades['calculo']).toEqual({
      p1: { state: 'completa', value: 7.5 }, p2: { state: 'nao_feita', value: null }, p3: { state: 'completa', value: 9 },
    });
    setComposite('calculo:p1', { mode: 'pontos', parts: [{ nome: 'a', max: 10, tirei: 4 }] });
    expect(state.value.grades['calculo'].p1).toMatchObject({ state: 'completa', value: 4 });
    importNotas([nota('Cálculo', 8, 6)], '2026-11-15');
    expect(state.value.grades['calculo'].p1.value).toBe(4);
    expect(state.value.grades['calculo'].p2).toEqual({ state: 'completa', value: 6 });
    expect(outlooks.value['calculo']).toBeDefined();
  });
  it('clamps and guards NaN', () => {
    importNotas([nota('X', 11, NaN)], '2026-11-14');
    expect(state.value.grades['x'].p1.value).toBe(10);
    expect(state.value.grades['x'].p2).toEqual({ state: 'nao_feita', value: null });
  });
  it('livre composite is stored without touching grades', () => {
    setComposite('livre', { mode: 'pontos', parts: [] });
    expect(state.value.composites['livre']).toBeDefined();
    expect(state.value.grades).toEqual({});
  });
});

describe('plan', () => {
  it('excludes conferir subjects and uses today', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 10, 16, 12));
    importFaltas([{ nome: 'Marketing Digital', faltas: 0, percentual: null }, { nome: 'Gestão', faltas: null, percentual: null }], '2026-11-14');
    state.value = { ...state.value, subjects: state.value.subjects.map((s) => ({ ...s, ch: 36, chSource: 'manual' as const })) };
    importHorario([{ weekday: 1, slot: 0, nome: 'Marketing Digital' }, { weekday: 2, slot: 0, nome: 'Gestão' }]);
    expect(plan.value).toBe('sem_data');
    state.value = { ...state.value, simulado: '2026-12-10' };
    const p = plan.value;
    expect(typeof p).toBe('object');
    if (typeof p === 'object') expect(p.subjects.map((x) => x.subjectId)).toEqual(['marketing-digital']);
    state.value = { ...state.value, simulado: '2026-11-10' };
    expect(plan.value).toBe('data_passada');
  });
});

describe('persistence', () => {
  it('round-trips and survives garbage', () => {
    const fake = fakeStorage();
    importFaltas([{ nome: 'Marketing Digital', faltas: 4, percentual: 11.11 }], '2026-11-14');
    importNotas([nota('Marketing Digital', 7)], '2026-11-14');
    saveState(fake, state.value);
    expect(loadState(fake)).toEqual(state.value);
    fake.setItem(STORAGE_KEY, '{broken');
    expect(loadState(fake).subjects).toEqual([]);
    fake.setItem(STORAGE_KEY, JSON.stringify({ subjects: 'x' }));
    expect(loadState(fake).subjects).toEqual([]);
    fake.setItem(STORAGE_KEY, JSON.stringify({ ...state.value, schedule: { 1: [null] } }));
    expect(loadState(fake).subjects).toEqual([]);
    clearState(fake);
    expect(fake.getItem(STORAGE_KEY)).toBeNull();
  });
  it('effect persists every change to localStorage', () => {
    importFaltas([{ nome: 'Gestão', faltas: 1, percentual: null }], '2026-11-14');
    expect(loadState(localStorage)).toEqual(state.value);
  });
});

describe('mutation helpers', () => {
  it('updateSubject applies valid fields and drops non-finite or negative numbers', () => {
    importFaltas([{ nome: 'Gestão', faltas: 4, percentual: null }], '2026-11-14');
    const id = state.value.subjects[0].id;
    updateSubject(id, { faltas: NaN, pendentes: -1, ch: Infinity });
    expect(state.value.subjects[0]).toMatchObject({ faltas: 4, pendentes: 0, ch: null });
    updateSubject(id, { faltas: 7.5, pendentes: 2, ch: 72, chSource: 'manual' });
    expect(state.value.subjects[0]).toMatchObject({ faltas: 7.5, pendentes: 2, ch: 72, chSource: 'manual' });
    updateSubject(id, { ch: 0 });
    expect(state.value.subjects[0].ch).toBe(72);
  });
  it('typing faltas clears conferir', () => {
    importFaltas([{ nome: 'Gestão', faltas: null, percentual: null }], '2026-11-14');
    const id = state.value.subjects[0].id;
    updateSubject(id, { pendentes: 1 });
    expect(state.value.subjects[0].conferir).toBe(true);
    updateSubject(id, { faltas: 3 });
    expect(state.value.subjects[0].conferir).toBeUndefined();
  });
  it('setSchedule, setSimulado and setFaltasPrintDate accept only valid values', () => {
    const s = emptySchedule();
    s[2] = ['x', null];
    setSchedule(s);
    expect(state.value.schedule[2]).toEqual(['x', null]);
    setSimulado('2026-12-10');
    expect(state.value.simulado).toBe('2026-12-10');
    setSimulado('lixo');
    expect(state.value.simulado).toBe('2026-12-10');
    setSimulado(null);
    expect(state.value.simulado).toBeNull();
    setFaltasPrintDate('2026-11-10');
    expect(state.value.faltasPrintDate).toBe('2026-11-10');
    setFaltasPrintDate('');
    expect(state.value.faltasPrintDate).toBe('2026-11-10');
  });
});
