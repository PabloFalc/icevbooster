import type { OcrWord } from '../domain/types';
import { parseNumber, readTable } from './rows';

export interface HistoricoRow { nome: string; codigo?: string; faltas: number | null; ch: number | null }

const LABELS: [string, string][] = [
  ['periodo', 'periodo'], ['codigo', 'codigo'], ['disciplina', 'disciplina'], ['situacao', 'situacao'],
  ['nota', 'nota'], ['faltas', 'faltas'], ['creditos', 'creditos'],
  ['ch', 'ch'], ['chExt', 'ch'], ['chIntegr', 'ch'],
];

const first = (v: string[] | undefined) => v?.map(parseNumber).find((n) => n !== null) ?? null;

/** Rows of the portal's Histórico print. Blank faltas stay null; CH ≤ 0 is rejected (null). */
export function parseHistorico(words: OcrWord[]): HistoricoRow[] {
  return readTable(words, LABELS).map(({ nome, values }) => {
    const codigo = values.codigo?.find((t) => /\d/.test(t));
    const ch = first(values.ch);
    return {
      nome,
      ...(codigo ? { codigo } : {}),
      faltas: first(values.faltas),
      ch: ch !== null && ch > 0 ? ch : null,
    };
  });
}
