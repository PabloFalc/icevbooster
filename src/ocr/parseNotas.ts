import type { OcrWord } from '../domain/types';
import { parseNumber, readTable } from './rows';

export interface NotasRow {
  nome: string;
  p1: number | null; p2: number | null; p3: number | null;
  media: number | null; rec: number | null; mediaFinal: number | null;
}

// 'media' twice: MÉDIA SEMEST comes before MÉDIA FINAL in x order.
const LABELS: [string, string][] = [
  ['turma', 'turma'], ['disciplina', 'disciplina'], ['situacao', 'situacao'],
  ['p1', 'p1'], ['p2', 'p2'], ['p3', 'p3'], ['media', 'media'], ['rec', 'rec'], ['mediaFinal', 'media'],
];

/** First grade in the column; values outside 0..10 are misreads → null. */
function grade(v: string[] | undefined): number | null {
  const n = v?.map(parseNumber).find((x) => x !== null) ?? null;
  return n !== null && n <= 10 ? n : null;
}

/** Rows of the portal's Notas print. Every subject row is kept (Situação marks a row), blank grades are null. */
export function parseNotas(words: OcrWord[]): NotasRow[] {
  return readTable(words, LABELS, 'situacao').map(({ nome, values }) => ({
    nome,
    p1: grade(values.p1), p2: grade(values.p2), p3: grade(values.p3),
    media: grade(values.media), rec: grade(values.rec), mediaFinal: grade(values.mediaFinal),
  }));
}
