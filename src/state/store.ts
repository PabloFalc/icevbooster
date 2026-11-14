import { computed, effect, signal } from '@preact/signals';
import type { ReadonlySignal } from '@preact/signals';
import { resolveCh } from '../domain/absences';
import { todayIso } from '../domain/dates';
import { holidaysFor } from '../domain/holidays';
import { compositeSummary, compositeToSlot } from '../domain/composite';
import type { Composite } from '../domain/composite';
import { clampGrade, gradeOutlook } from '../domain/grades';
import type { Outlook } from '../domain/grades';
import { planAll } from '../domain/maxPlan';
import type { OverallPlan, PlanError } from '../domain/maxPlan';
import { matchIndices, matchSubjects, normalizeName } from '../domain/nameMatch';
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

/** Horário cell names the last horário import could not match to a subject (session only, not persisted). */
export const horarioUnmatched = signal<string[]>([]);
/** Whether the Faltas schedule grid is expanded (session only; opened by a horário import or "Preencher manualmente"). */
export const scheduleOpen = signal(false);

/** Back to the default state, including the session-only signals (the effect rewrites storage). */
export function resetState(): void {
  state.value = defaultState();
  horarioUnmatched.value = [];
  scheduleOpen.value = false;
}

/** Test helper: back to the default state. */
export function resetForTests(): void {
  resetState();
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

/**
 * The subject of each imported row (by position): exact names first, then fuzzy, never two rows on
 * one subject; rows without a match create a subject (`extra` sets its initial fields).
 */
function upsertAll(subjects: Subject[], names: string[], extra: Partial<Subject> = {}): Subject[] {
  const taken = new Set(subjects.map((x) => x.id));
  const ids = matchIndices(subjects, names);
  return names.map((nome, i) => {
    const hit = ids[i] === null ? undefined : subjects.find((x) => x.id === ids[i]);
    if (hit) return hit;
    const id = freshId(nome, taken);
    taken.add(id);
    const sub: Subject = { id, nome, faltas: 0, pendentes: 0, percentual: null, ch: null, chSource: null, ...extra };
    subjects.push(sub);
    return sub;
  });
}

// ---------- imports ----------

export function importFaltas(rows: FaltasRow[], printDate: Iso): void {
  update((s) => {
    const subjects = s.subjects.map((x) => ({ ...x }));
    const subs = upsertAll(subjects, rows.map((r) => r.nome));
    rows.forEach((r, i) => {
      const sub = subs[i];
      const f = finiteOrNull(r.faltas);
      if (f === null) sub.conferir = true;
      else { sub.faltas = f; delete sub.conferir; }
      sub.percentual = finiteOrNull(r.percentual);
      if (r.turma) sub.turma = r.turma;
      if (sub.chSource !== 'manual') {
        Object.assign(sub, resolveCh(sub, sub.chSource === 'historico' && sub.ch !== null ? sub.ch : undefined));
      }
    });
    return { ...s, subjects, faltasPrintDate: printDate };
  });
}

export function importHistorico(rows: HistoricoRow[]): void {
  update((s) => {
    const subjects = s.subjects.map((x) => ({ ...x }));
    const usable = rows.filter((r) => { const ch = finiteOrNull(r.ch); return ch !== null && ch > 0; });
    const ids = matchIndices(subjects, usable.map((r) => r.nome));
    usable.forEach((r, i) => {
      const sub = subjects.find((x) => x.id === ids[i]);
      if (!sub || sub.chSource === 'manual') return;
      sub.ch = r.ch;
      sub.chSource = 'historico';
    });
    return { ...s, subjects };
  });
}

/**
 * Builds the schedule from the horário print: every slot the print has a cell for gets its matched
 * subject (or none); slots without any cell keep their manual entry. Returns the unmatched cell names.
 * Throws (schedule untouched) when there are no subjects yet or no cell matches any subject.
 */
export function importHorario(cells: HorarioCell[]): string[] {
  const s = state.value;
  if (s.subjects.length === 0) throw new Error('sem matérias');
  const valid = cells.filter((c) => WEEKDAYS.includes(c.weekday) && (c.slot === 0 || c.slot === 1));
  const names = [...new Set(valid.map((c) => c.nome))];
  const map = matchSubjects(s.subjects, names);
  if (!names.some((n) => map[n])) throw new Error('nenhuma correspondência');
  const schedule = Object.fromEntries(WEEKDAYS.map((d) => [d, [...s.schedule[d]]])) as Schedule;
  for (const c of valid) schedule[c.weekday][c.slot] = null;
  for (const c of valid) if (map[c.nome]) schedule[c.weekday][c.slot] = map[c.nome];
  state.value = { ...s, schedule };
  const unmatched = names.filter((n) => !map[n]);
  horarioUnmatched.value = unmatched;
  scheduleOpen.value = true;
  return unmatched;
}

const slotFrom = (n: number | null): GradeSlot =>
  typeof n === 'number' && Number.isFinite(n) ? { state: 'completa', value: clampGrade(n) } : { state: 'nao_feita', value: null };

const emptyGrades = (): SubjectGrades => ({
  p1: { state: 'nao_feita', value: null }, p2: { state: 'nao_feita', value: null }, p3: { state: 'nao_feita', value: null },
});

export function importNotas(rows: NotasRow[], printDate: Iso): void {
  update((s) => {
    const subjects = s.subjects.map((x) => ({ ...x }));
    // A subject first seen in the notas print has unknown faltas: excluded from the plan until checked.
    const subs = upsertAll(subjects, rows.map((r) => r.nome), { conferir: true });
    const grades = { ...s.grades };
    rows.forEach((r, i) => {
      const sub = subs[i];
      const g = { ...(grades[sub.id] ?? emptyGrades()) };
      if (!s.composites[`${sub.id}:p1`]) g.p1 = slotFrom(r.p1);
      if (!s.composites[`${sub.id}:p2`]) g.p2 = slotFrom(r.p2);
      g.p3 = slotFrom(r.p3);
      grades[sub.id] = g;
    });
    return { ...s, subjects, grades, notasPrintDate: printDate };
  });
}

export function setComposite(key: string, c: Composite): void {
  update((s) => {
    const i0 = key.lastIndexOf(':');
    const owner = i0 > 0 ? key.slice(0, i0) : key;
    if (key !== 'livre' && !s.subjects.some((x) => x.id === owner)) return s;
    const next: AppState = { ...s, composites: { ...s.composites, [key]: c } };
    const i = key.lastIndexOf(':');
    const slot = key.slice(i + 1);
    if (i > 0 && (slot === 'p1' || slot === 'p2') && compositeSummary(c).valid) {
      const id = key.slice(0, i);
      const g = s.grades[id] ?? emptyGrades();
      next.grades = { ...s.grades, [id]: { ...g, [slot]: compositeToSlot(c) } };
    }
    return next;
  });
}

/** Unlinks a composite: the grade slot keeps its last values but is editable in Notas again. */
export function removeComposite(key: string): void {
  update((s) => {
    if (!(key in s.composites)) return s;
    const composites = { ...s.composites };
    delete composites[key];
    return { ...s, composites };
  });
}

// ---------- edits ----------

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Applies a typed edit to one subject. Numbers that are not finite (or negative; CH must be > 0)
 * are dropped so NaN never reaches persisted state. Typing faltas clears the `conferir` flag.
 */
export function updateSubject(id: string, patch: Partial<Pick<Subject, 'faltas' | 'pendentes' | 'ch' | 'chSource'>>): void {
  const clean: Partial<Subject> = {};
  if (isNum(patch.faltas) && patch.faltas >= 0) clean.faltas = patch.faltas;
  if (isNum(patch.pendentes) && patch.pendentes >= 0) clean.pendentes = patch.pendentes;
  if (patch.ch === null || (isNum(patch.ch) && patch.ch > 0)) clean.ch = patch.ch;
  if (patch.chSource !== undefined) clean.chSource = patch.chSource;
  if (Object.keys(clean).length === 0) return;
  update((s) => ({
    ...s,
    subjects: s.subjects.map((x) => {
      if (x.id !== id) return x;
      const next = { ...x, ...clean };
      if (clean.faltas !== undefined) delete next.conferir;
      return next;
    }),
  }));
}

/**
 * Replaces one grade slot of a subject (P1/P2/P3). Values are clamped to 0–10 and never NaN (non-finite → null);
 * `potencial` only survives on an incompleta slot; a nao_feita slot never keeps a value.
 */
export function setGradeSlot(subjectId: string, key: 'p1' | 'p2' | 'p3', slot: GradeSlot): void {
  if (!['p1', 'p2', 'p3'].includes(key) || !['completa', 'incompleta', 'nao_feita'].includes(slot.state)) return;
  const v = finiteOrNull(slot.value);
  const pot = finiteOrNull(slot.potencial);
  const clean: GradeSlot = { state: slot.state, value: slot.state === 'nao_feita' || v === null ? null : clampGrade(v) };
  if (slot.state === 'incompleta' && pot !== null) clean.potencial = clampGrade(pot);
  update((s) => {
    if (!s.subjects.some((x) => x.id === subjectId)) return s;
    const g = s.grades[subjectId] ?? emptyGrades();
    return { ...s, grades: { ...s.grades, [subjectId]: { ...g, [key]: clean } } };
  });
}

export function setSchedule(schedule: Schedule): void {
  update((s) => ({ ...s, schedule }));
}

export function setSimulado(d: Iso | null): void {
  if (d !== null && !ISO.test(d)) return;
  update((s) => ({ ...s, simulado: d }));
}

export function setFaltasPrintDate(d: Iso): void {
  if (!ISO.test(d)) return;
  update((s) => ({ ...s, faltasPrintDate: d }));
}

const isRealIso = (d: unknown): d is Iso => {
  if (typeof d !== 'string' || !ISO.test(d)) return false;
  const t = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
};

/**
 * Marks a date as "sem aula" (`off` true) or "tem aula" (false). A manual no-class day lives in `noClass`;
 * an automatic holiday is switched off/on through `removedHolidays`.
 */
export function setNoClass(date: Iso, off: boolean): void {
  if (!isRealIso(date)) return;
  update((s) => {
    const isHoliday = date in holidaysFor(Number(date.slice(0, 4)));
    const noClass = { ...s.overrides.noClass };
    let removed = s.overrides.removedHolidays.filter((d) => d !== date);
    if (off) {
      if (!isHoliday) noClass[date] = 'Sem aula';
    } else {
      delete noClass[date];
      if (isHoliday) removed = [...removed, date];
    }
    return { ...s, overrides: { ...s.overrides, noClass, removedHolidays: removed } };
  });
}

/** Imports PDF-detected no-class days (date → label); invalid dates and blank labels are skipped. */
export function addNoClassDays(days: Record<Iso, string>): void {
  const clean = Object.entries(days).filter(([d]) => isRealIso(d));
  if (clean.length === 0) return;
  update((s) => ({
    ...s,
    overrides: {
      ...s.overrides,
      noClass: { ...s.overrides.noClass, ...Object.fromEntries(clean.map(([d, l]) => [d, l.trim() || 'Sem aula'])) },
      removedHolidays: s.overrides.removedHolidays.filter((d) => !clean.some(([c]) => c === d)),
    },
  }));
}

/** Makes `date` a make-up class day that follows `weekday`'s schedule (1–5); null removes it. */
export function setExtraDay(date: Iso, weekday: Weekday | null): void {
  if (!isRealIso(date)) return;
  if (weekday !== null && !(Number.isInteger(weekday) && weekday >= 1 && weekday <= 5)) return;
  update((s) => {
    const extraDays = { ...s.overrides.extraDays };
    if (weekday === null) delete extraDays[date];
    else extraDays[date] = weekday;
    return { ...s, overrides: { ...s.overrides, extraDays } };
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
