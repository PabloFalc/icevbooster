import { splitEqual } from './grades';
import type { GradeSlot } from './types';

export type CompositeMode = 'pontos' | 'peso';
// pontos: max in points; peso: max = peso% (0-100), tirei = nota 0-10
export interface Part { nome: string; max: number; tirei: number | null }
export interface Composite { mode: CompositeMode; parts: Part[] }

const TOL = 0.01;

const safe = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);

// Points this part is worth in the final grade.
function partPoints(c: Composite, p: Part): number {
  const max = safe(p.max);
  return c.mode === 'peso' ? max / 10 : max;
}

// Points scored for a filled part (tirei clamped to the part's maximum).
function scored(c: Composite, p: Part): number {
  const t = safe(p.tirei ?? 0);
  if (c.mode === 'peso') return (Math.min(t, 10) * safe(p.max)) / 100;
  return Math.min(t, safe(p.max));
}

export function compositeSummary(c: Composite): { valid: boolean; garantido: number; potencial: number; complete: boolean } {
  const total = c.parts.reduce((s, p) => s + safe(p.max), 0);
  const target = c.mode === 'peso' ? 100 : 10;
  const valid = c.parts.length > 0 && Math.abs(total - target) <= TOL;
  let garantido = 0;
  let potencial = 0;
  for (const p of c.parts) {
    if (p.tirei === null) potencial += partPoints(c, p);
    else garantido += scored(c, p);
  }
  return { valid, garantido, potencial, complete: c.parts.every((p) => p.tirei !== null) };
}

export function compositeNeeds(c: Composite, pointsNeeded: number): (number | null)[] {
  const result: (number | null)[] = c.parts.map(() => null);
  const open = c.parts.map((_, i) => i).filter((i) => c.parts[i].tirei === null);
  if (open.length === 0) return result;
  const split = splitEqual(pointsNeeded, open.map((i) => partPoints(c, c.parts[i])));
  if (!split) return result;
  open.forEach((i, k) => {
    const pts = split[k];
    const w = partPoints(c, c.parts[i]);
    result[i] = c.mode === 'peso' ? (w > 0 ? pts / (w / 10) : 0) : pts;
  });
  return result;
}

export function compositeToSlot(c: Composite): GradeSlot {
  const { garantido, potencial, complete } = compositeSummary(c);
  return complete ? { state: 'completa', value: garantido } : { state: 'incompleta', value: garantido, potencial };
}
