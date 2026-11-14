import type { OcrWord } from '../domain/types';
import { parseNumber, readTable } from './rows';

export interface FaltasRow { nome: string; turma?: string; faltas: number; percentual: number | null }

const LABELS: [string, string][] = [
  ['sit', 'sit'], ['disciplina', 'disciplina'], ['turma', 'turma'],
  ['bim1', 'bim'], ['bim2', 'bim'], ['total', 'total'], ['percentual', 'percentual'],
];

const first = (v: string[] | undefined) => v?.map(parseNumber).find((n) => n !== null) ?? null;

/** Rows of the portal's Faltas print. Blank TOTAL FALTAS → 0 faltas. */
export function parseFaltas(words: OcrWord[]): FaltasRow[] {
  return readTable(words, LABELS).map(({ nome, values }) => {
    const turma = values.turma?.join(' ');
    return {
      nome,
      ...(turma ? { turma } : {}),
      faltas: first(values.total) ?? 0,
      percentual: first(values.percentual),
    };
  });
}
