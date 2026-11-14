import type { ChSource, Subject } from './types';
import { normalizeName } from './nameMatch';

export function limiteFaltas(ch: number): number {
  return Math.floor(ch * 0.25);
}

export function saldoFaltas(s: Subject): number | null {
  if (s.ch === null) return null;
  return Math.max(0, limiteFaltas(s.ch) - s.faltas - s.pendentes);
}

export function saldoAulas(s: Subject): number | null {
  const f = saldoFaltas(s);
  return f === null ? null : Math.floor(f / 2);
}

export function percentualUsado(s: Subject): number | null {
  if (s.ch === null) return null;
  return ((s.faltas + s.pendentes) / s.ch) * 100;
}

export function inferCh(faltas: number, percentual: number | null): 36 | 72 | null {
  if (faltas <= 0 || !percentual) return null;
  const raw = faltas / (percentual / 100);
  for (const c of [36, 72] as const) {
    if (Math.abs(raw - c) / c <= 0.05) return c;
  }
  return null;
}

export function isFixed36(nome: string): boolean {
  const n = normalizeName(nome);
  return n.includes('ingles') || n.includes('extensao');
}

export function resolveCh(
  s: Subject,
  historicoCh?: number,
): { ch: number | null; chSource: ChSource | null } {
  if (historicoCh !== undefined) return { ch: historicoCh, chSource: 'historico' };
  const inferred = inferCh(s.faltas, s.percentual);
  if (inferred !== null) return { ch: inferred, chSource: 'percentual' };
  if (isFixed36(s.nome)) return { ch: 36, chSource: 'fixo' };
  if (s.chSource === 'manual' && s.ch !== null) return { ch: s.ch, chSource: 'manual' };
  return { ch: null, chSource: null };
}
