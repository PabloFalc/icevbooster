import { computed, effect, signal } from '@preact/signals';
import type { ReadonlySignal } from '@preact/signals';
import { resolveCh } from '../domain/absences';
import { todayIso } from '../domain/dates';
import { compositeToSlot } from '../domain/composite';
import type { Composite } from '../domain/composite';
import { clampGrade, gradeOutlook } from '../domain/grades';
import type { Outlook } from '../domain/grades';
import { planAll } from '../domain/maxPlan';
import type { OverallPlan, PlanError } from '../domain/maxPlan';
import { matchSubjects, namesMatch, normalizeName } from '../domain/nameMatch';
import type { CalendarOverrides, GradeSlot, Iso, Schedule, Subject, SubjectGrades, Weekday } from '../domain/types';
import type { FaltasRow } from '../ocr/parseFaltas';
import type { HistoricoRow } from '../ocr/parseHistorico';
import type { HorarioCell } from '../ocr/parseHorario';
import type { NotasRow } from '../ocr/parseNotas';

export interface AppState {
  subjects: Subject[]; faltasPrintDate: Iso | null;
  schedule: Schedule; simulado: Iso | null; overrides: CalendarOverrides;
  grades: Record<string, SubjectGrades>; notasPrintDate: Iso | null;
  composites: Record<string, Composite>;
}

export const STORAGE_KEY = 'icevbooster:v1';
const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5];

export const emptySchedule = (): Schedule => ({ 1: [null, null], 2: [null, null], 3: [null, null], 4: [null, null], 5: [null, null] });

export const defaultState = (): AppState => ({
  subjects: [], faltasPrintDate: null,
  schedule: emptySchedule(), simulado: null,
  overrides: { noClass: {}, removedHolidays: [], extraDays: {} },
  grades: {}, notasPrintDate: null,
  composites: {},
});

// ---------- persistence ----------

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStrOrNull = (v: unknown): v is string | null => v === null || typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isNumOrNull = (v: unknown): v is number | null => v === null || isNum(v);

function validSubject(v: unknown): boolean {
  return isObj(v) && typeof v.id === 'string' && typeof v.nome === 'string' && isNum(v.faltas) && isNum(v.pendentes)
    && isNumOrNull(v.percentual) && isNumOrNull(v.ch)
    && (v.chSource === null || ['historico', 'percentual', 'fixo', 'manual'].includes(v.chSource as string))
    && (v.conferir === undefined || typeof v.conferir === 'boolean')
    && (v.turma === undefined || typeof v.turma === 'string');
}

function validSlot(v: unknown): boolean {
  return isObj(v) && ['completa', 'incompleta', 'nao_feita'].includes(v.state as string) && isNumOrNull(v.value)
    && (v.potencial === undefined || isNum(v.potencial));
}

function validComposite(v: unknown): boolean {
  return isObj(v) && (v.mode === 'pontos' || v.mode === 'peso') && Array.isArray(v.parts)
    && v.parts.every((p) => isObj(p) && typeof p.nome === 'string' && isNum(p.max) && isNumOrNull(p.tirei));
}

const allValues = (o: Record<string, unknown>, ok: (v: unknown) => boolean) => Object.values(o).every(ok);

function validState(v: unknown): v is AppState {
  if (!isObj(v)) return false;
  if (!Array.isArray(v.subjects) || !v.subjects.every(validSubject)) return false;
  if (!isStrOrNull(v.faltasPrintDate) || !isStrOrNull(v.simulado) || !isStrOrNull(v.notasPrintDate)) return false;
  if (!isObj(v.schedule)) return false;
  for (const d of WEEKDAYS) {
    const day = v.schedule[d];
    if (!Array.isArray(day) || day.length !== 2 || !day.every(isStrOrNull)) return false;
  }
  const o = v.overrides;
  if (!isObj(o) || !isObj(o.noClass) || !allValues(o.noClass, (x) => typeof x === 'string')) return false;
  if (!Array.isArray(o.removedHolidays) || !o.removedHolidays.every((x) => typeof x === 'string')) return false;
  if (!isObj(o.extraDays) || !allValues(o.extraDays, (x) => typeof x === 'number' && x >= 1 && x <= 5)) return false;
  if (!isObj(v.grades) || !allValues(v.grades, (g) => isObj(g) && validSlot(g.p1) && validSlot(g.p2) && validSlot(g.p3))) return false;
  if (!isObj(v.composites) || !allValues(v.composites, validComposite)) return false;
  return true;
}

export function loadState(storage: Storage): AppState {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return defaultState();
    const parsed: unknown = JSON.parse(raw);
    return validState(parsed) ? parsed : defaultState();
  } catch {
    return defaultState();
  }
}

export function saveState(storage: Storage, s: AppState): void {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* storage unavailable or full */ }
}

export function clearState(storage: Storage): void {
  try { storage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

function browserStorage(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

// ---------- state ----------

export const state = signal<AppState>(((s) => (s ? loadState(s) : defaultState()))(browserStorage()));

effect(() => {
  const value = state.value;
  const s = browserStorage();
  if (s) saveState(s, value);
});

/** Test helper: back to the default state (the effect rewrites storage). */
export function resetForTests(): void {
  state.value = defaultState();
}

const update = (fn: (s: AppState) => AppState): void => { state.value = fn(state.value); };

const slug = (nome: string) => normalizeName(nome).replace(/ /g, '-') || 'disciplina';

function freshId(nome: string, taken: Set<string>): string {
  const base = slug(nome);
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

const finiteOrNull = (n: number | null | undefined): number | null => (typeof n === 'number' && Number.isFinite(n) ? n : null);

function upsert(subjects: Subject[], taken: Set<string>, nome: string): Subject {
  let sub = subjects.find((x) => namesMatch(x.nome, nome));
  if (!sub) {
    const id = freshId(nome, taken);
    taken.add(id);
    sub = { id, nome, faltas: 0, pendentes: 0, percentual: null, ch: null, chSource: null };
    subjects.push(sub);
  }
  return sub;
}

// ---------- imports ----------

export function importFaltas(rows: FaltasRow[], printDate: Iso): void {
  update((s) => {
    const subjects = s.subjects.map((x) => ({ ...x }));
    const taken = new Set(subjects.map((x) => x.id));
    for (const r of rows) {
      const sub = upsert(subjects, taken, r.nome);
      const f = finiteOrNull(r.faltas);
      if (f === null) sub.conferir = true;
      else { sub.faltas = f; delete sub.conferir; }
      sub.percentual = finiteOrNull(r.percentual);
      if (r.turma) sub.turma = r.turma;
      if (sub.chSource !== 'manual') {
        Object.assign(sub, resolveCh(sub, sub.chSource === 'historico' && sub.ch !== null ? sub.ch : undefined));
      }
    }
    return { ...s, subjects, faltasPrintDate: printDate };
  });
}

export function importHistorico(rows: HistoricoRow[]): void {
  update((s) => {
    const subjects = s.subjects.map((x) => ({ ...x }));
    for (const r of rows) {
      const ch = finiteOrNull(r.ch);
      if (ch === null || ch <= 0) continue;
      const sub = subjects.find((x) => namesMatch(x.nome, r.nome));
      if (!sub || sub.chSource === 'manual') continue;
      sub.ch = ch;
      sub.chSource = 'historico';
    }
    return { ...s, subjects };
  });
}

export function importHorario(cells: HorarioCell[]): void {
  update((s) => {
    const schedule = emptySchedule();
    const map = matchSubjects(s.subjects, [...new Set(cells.map((c) => c.nome))]);
    for (const c of cells) {
      const id = map[c.nome];
      if (id && WEEKDAYS.includes(c.weekday) && (c.slot === 0 || c.slot === 1)) schedule[c.weekday][c.slot] = id;
    }
    return { ...s, schedule };
  });
}

const slotFrom = (n: number | null): GradeSlot =>
  typeof n === 'number' && Number.isFinite(n) ? { state: 'completa', value: clampGrade(n) } : { state: 'nao_feita', value: null };

const emptyGrades = (): SubjectGrades => ({
  p1: { state: 'nao_feita', value: null }, p2: { state: 'nao_feita', value: null }, p3: { state: 'nao_feita', value: null },
});

export function importNotas(rows: NotasRow[], printDate: Iso): void {
  update((s) => {
    const subjects = s.subjects.map((x) => ({ ...x }));
    const taken = new Set(subjects.map((x) => x.id));
    const grades = { ...s.grades };
    for (const r of rows) {
      const sub = upsert(subjects, taken, r.nome);
      const g = { ...(grades[sub.id] ?? emptyGrades()) };
      if (!s.composites[`${sub.id}:p1`]) g.p1 = slotFrom(r.p1);
      if (!s.composites[`${sub.id}:p2`]) g.p2 = slotFrom(r.p2);
      g.p3 = slotFrom(r.p3);
      grades[sub.id] = g;
    }
    return { ...s, subjects, grades, notasPrintDate: printDate };
  });
}

export function setComposite(key: string, c: Composite): void {
  update((s) => {
    const next: AppState = { ...s, composites: { ...s.composites, [key]: c } };
    const i = key.lastIndexOf(':');
    const slot = key.slice(i + 1);
    if (i > 0 && (slot === 'p1' || slot === 'p2')) {
      const id = key.slice(0, i);
      const g = s.grades[id] ?? emptyGrades();
      next.grades = { ...s.grades, [id]: { ...g, [slot]: compositeToSlot(c) } };
    }
    return next;
  });
}

// ---------- derived ----------

export const plan: ReadonlySignal<OverallPlan | PlanError> = computed(() => {
  const s = state.value;
  return planAll({
    subjects: s.subjects.filter((x) => !x.conferir),
    schedule: s.schedule, ov: s.overrides, today: todayIso(), simulado: s.simulado,
  });
});

export const outlooks: ReadonlySignal<Record<string, Outlook>> = computed(() => {
  const out: Record<string, Outlook> = {};
  for (const [id, g] of Object.entries(state.value.grades)) out[id] = gradeOutlook(g);
  return out;
});
