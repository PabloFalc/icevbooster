import type { OcrWord } from '../domain/types';
import { parseNumber, readTable } from './rows';

export interface FaltasRow { nome: string; turma?: string; faltas: number | null; percentual: number | null }

const LABELS: [string, string][] = [
  ['sit', 'sit'], ['disciplina', 'disciplina'], ['turma', 'turma'],
  ['bim1', 'bim'], ['bim2', 'bim'], ['total', 'total'], ['percentual', 'percentual'],
];

const first = (v: string[] | undefined) => v?.map(parseNumber).find((n) => n !== null) ?? null;

/** A percentual above 100 is a misread; '1111%' (dropped dot) is repaired to 11.11, anything else → null. */
function percentual(v: string[] | undefined): number | null {
  const raw = v?.find((t) => parseNumber(t) !== null);
  if (raw === undefined) return null;
  const n = parseNumber(raw)!;
  if (n <= 100) return n;
  const repaired = /^\d{4}%?$/.test(raw.trim()) ? n / 100 : null;
  return repaired !== null && repaired <= 100 ? repaired : null;
}

/**
 * TOTAL FALTAS: read directly; else the sum of the bimester cells; else 0 for a truly blank row,
 * but null when the percentual says there are faltas (never silently under-count).
 */
function faltas(values: Record<string, string[]>, pct: number | null): number | null {
  const total = first(values.total);
  if (total !== null) return total;
  const bims = [first(values.bim1), first(values.bim2)].filter((n): n is number => n !== null);
  if (bims.length) return bims.reduce((a, b) => a + b, 0);
  return pct !== null && pct > 0 ? null : 0;
}

/** Rows of the portal's Faltas print. */
export function parseFaltas(words: OcrWord[]): FaltasRow[] {
  return readTable(words, LABELS).map(({ nome, values }) => {
    const turma = values.turma?.join(' ');
    const pct = percentual(values.percentual);
    return { nome, ...(turma ? { turma } : {}), faltas: faltas(values, pct), percentual: pct };
  });
}
