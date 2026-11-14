import type { OcrWord, Weekday } from '../domain/types';
import { columnOf, findHeaders, groupRows } from './rows';

export interface HorarioCell { weekday: Weekday; slot: 0 | 1; nome: string }

const LABELS: [string, string][] = [
  ['0', 'horario'], ['1', 'segunda'], ['2', 'terca'], ['3', 'quarta'], ['4', 'quinta'], ['5', 'sexta'],
];
const MIN_CELLS = 5;

const centerY = (w: OcrWord) => (w.y0 + w.y1) / 2;

/** y-center of the first row holding the time `hhmm` (OCR may read the colon as '.', ',' or drop it). */
function slotY(rows: OcrWord[][], hhmm: string): number | null {
  const re = new RegExp(`^${hhmm.slice(0, 2)}[:.,;]?${hhmm.slice(2)}$`);
  const hit = rows.flat().find((w) => re.test(w.text));
  return hit ? centerY(hit) : null;
}

/**
 * Reads the portal's weekly schedule print: day columns from the Segunda…Sexta header words,
 * slots from the 18:20 and 20:20 time labels (the boundary is halfway between them). A cell's
 * text is its words line by line, minus the last line (the professor) when it has 2+ lines.
 * `ok` is false when fewer than 5 cells were found, so the UI falls back to the manual grid.
 */
export function parseHorario(words: OcrWord[]): { cells: HorarioCell[]; ok: boolean } {
  const rows = groupRows(words);
  const found = findHeaders(rows, 'horario', LABELS);
  const y0 = slotY(rows, '1820');
  const y1 = slotY(rows, '2020');
  if (!found || found.headers.filter((h) => h.key !== '0').length < 5 || y0 === null || y1 === null || y1 <= y0)
    return { cells: [], ok: false };

  const headerBottom = Math.max(...rows[found.index].map((w) => w.y1));
  const mid = (y0 + y1) / 2;
  const bottom = y1 + (y1 - mid);
  const buckets = new Map<string, OcrWord[]>();
  for (const w of words) {
    const y = centerY(w);
    if (y <= headerBottom || y > bottom) continue;
    const day = columnOf(w, found.headers);
    if (day === '0') continue;
    const key = `${day}:${y < mid ? 0 : 1}`;
    buckets.set(key, [...(buckets.get(key) ?? []), w]);
  }

  const cells: HorarioCell[] = [];
  for (const [key, cellWords] of buckets) {
    const lines = groupRows(cellWords);
    const kept = lines.length >= 2 ? lines.slice(0, -1) : lines;
    const nome = kept.flat().map((w) => w.text).join(' ').trim();
    if (!/\p{L}{2}/u.test(nome)) continue;
    const [day, slot] = key.split(':');
    cells.push({ weekday: Number(day) as Weekday, slot: Number(slot) as 0 | 1, nome });
  }
  cells.sort((a, b) => a.slot - b.slot || a.weekday - b.weekday);
  return { cells, ok: cells.length >= MIN_CELLS };
}
