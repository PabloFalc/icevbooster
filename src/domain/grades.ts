import { acertosFor, notaFromAcertos } from './simulado';
import type { GradeSlot, SubjectGrades } from './types';

const EPS = 1e-9;

export function clampGrade(v: number): number {
  return Math.min(10, Math.max(0, v));
}

// Water-filling: equal points per slot, slots whose cap is below the share stay at cap.
export function splitEqual(needed: number, caps: number[]): number[] | null {
  const total = caps.reduce((s, c) => s + c, 0);
  if (total < needed - EPS) return null;
  const out: number[] = caps.map(() => 0);
  if (needed <= 0) return out;
  let open = caps.map((_, i) => i);
  let remaining = needed;
  for (;;) {
    const share = remaining / open.length;
    const capped = open.filter((i) => caps[i] < share - EPS);
    if (capped.length === 0) {
      for (const i of open) out[i] = share;
      return out;
    }
    for (const i of capped) {
      out[i] = caps[i];
      remaining -= caps[i];
    }
    open = open.filter((i) => !capped.includes(i));
    if (open.length === 0) return out;
  }
}

export type GradeStatus = 'aprovado' | 'andamento' | 'rec' | 'reprovado';
export interface Outlook {
  atual: number;
  restantes: number;
  status: GradeStatus;
  target: 21 | 12 | null;
  shares: { p1?: number; p2?: number; p3?: number };
  simuladoAcertos: number | null;
  recQuestoes: number | null;
}

type Key = 'p1' | 'p2' | 'p3';
const KEYS: Key[] = ['p1', 'p2', 'p3'];

function guaranteed(s: GradeSlot): number {
  return s.state === 'nao_feita' ? 0 : clampGrade(s.value ?? 0);
}
/** What a slot can still earn: 0 when completa, 10 when não feita; incompleta: `potencial`, never above 10 − value. */
export function capacity(s: GradeSlot): number {
  if (s.state === 'completa') return 0;
  if (s.state === 'nao_feita') return 10;
  const v = clampGrade(s.value ?? 0);
  return Math.min(clampGrade(s.potencial ?? 10 - v), 10 - v);
}

export function gradeOutlook(g: SubjectGrades): Outlook {
  const atual = KEYS.reduce((s, k) => s + guaranteed(g[k]), 0);
  const restantes = Math.max(0, 21 - atual);
  const caps = KEYS.map((k) => capacity(g[k]));
  const sumCaps = caps.reduce((s, c) => s + c, 0);
  const base = { atual, restantes, target: null, shares: {}, simuladoAcertos: null, recQuestoes: null };

  if (atual >= 21 - EPS) return { ...base, status: 'aprovado' };

  if (sumCaps <= EPS) {
    const media = atual / 3;
    if (media >= 7 - EPS) return { ...base, status: 'aprovado' };
    if (media >= 4 - EPS) {
      return { ...base, status: 'rec', recQuestoes: Math.ceil(12 - media - EPS) };
    }
    return { ...base, status: 'reprovado' };
  }

  const openKeys = KEYS.filter((_, i) => caps[i] > 0);
  const openCaps = caps.filter((c) => c > 0);
  const p3Open = caps[2] > 0;

  const build = (status: 'andamento' | 'rec', target: 21 | 12): Outlook | null => {
    const parts = splitEqual(target - atual, openCaps);
    if (!parts) return null;
    const shares: Outlook['shares'] = {};
    openKeys.forEach((k, i) => { shares[k] = parts[i]; });
    const simuladoAcertos = p3Open ? acertosFor(shares.p3 as number) : null;
    if (status === 'andamento') {
      return { atual, restantes, status, target, shares, simuladoAcertos, recQuestoes: null };
    }
    const total = atual + openKeys.reduce((s, k) => {
      if (k === 'p3' && simuladoAcertos !== null) return s + notaFromAcertos(simuladoAcertos);
      return s + (shares[k] as number);
    }, 0);
    const media = total / 3;
    const recQuestoes = Math.ceil(12 - media - EPS);
    if (recQuestoes > 10) return null;
    return { atual, restantes, status, target, shares, simuladoAcertos, recQuestoes };
  };

  if (atual + sumCaps >= 21 - EPS) {
    const o = build('andamento', 21);
    if (o) return o;
  }
  if (atual + sumCaps >= 12 - EPS) {
    const o = build('rec', 12);
    if (o) return o;
  }
  return { ...base, status: 'reprovado' };
}
