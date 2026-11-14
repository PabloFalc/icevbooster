import type { OcrWord } from '../domain/types';
import { normalizeName } from '../domain/nameMatch';

const centerX = (w: OcrWord) => (w.x0 + w.x1) / 2;
const centerY = (w: OcrWord) => (w.y0 + w.y1) / 2;

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  return s.length ? s[s.length >> 1] : 0;
}

/** Clusters words into visual rows by vertical center (tolerance: half the median word height). */
export function groupRows(words: OcrWord[]): OcrWord[][] {
  const textual = words.filter((w) => /[\p{L}\p{N}]{2}/u.test(w.text));
  const tolerance = median((textual.length ? textual : words).map((w) => w.y1 - w.y0)) / 2;
  const rows: { center: number; words: OcrWord[] }[] = [];
  for (const w of [...words].sort((a, b) => centerY(a) - centerY(b))) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(centerY(w) - row.center) <= tolerance) {
      row.words.push(w);
      row.center = row.words.reduce((s, x) => s + centerY(x), 0) / row.words.length;
    } else rows.push({ center: centerY(w), words: [w] });
  }
  return rows.map((r) => r.words.sort((a, b) => a.x0 - b.x0));
}

/** Key of the header whose x is nearest to the word's horizontal center. */
export function columnOf(word: OcrWord, headers: { key: string; x: number }[]): string {
  const c = centerX(word);
  let best = headers[0];
  for (const h of headers) if (Math.abs(h.x - c) < Math.abs(best.x - c)) best = h;
  return best.key;
}

/** Parses '8,90' '8.90' '11.11%' '0%'; a lone 'O'/'o' (OCR for zero) is 0. Anything else → null. */
export function parseNumber(s: string): number | null {
  const t = s.trim().replace(/%$/, '');
  if (/^[Oo]$/.test(t)) return 0;
  if (!/^\d+([.,]\d+)?$/.test(t)) return null;
  return Number(t.replace(',', '.'));
}

// ---- helpers shared by the table parsers ----

export interface Header { key: string; x: number; x0: number; x1: number }

/**
 * Finds the header row (the first row containing a word that normalizes to `anchor`) and the
 * x-center of each label. `labels` maps a key to the normalized word that marks it; repeat a
 * word to target its next occurrence (e.g. 'ch' three times for CH, CH ext., CH integr.).
 */
export function findHeaders(
  rows: OcrWord[][],
  anchor: string,
  labels: [key: string, word: string][],
): { index: number; headers: Header[] } | null {
  const index = rows.findIndex((r) => r.some((w) => normalizeName(w.text) === anchor));
  if (index < 0) return null;
  const used = new Set<OcrWord>();
  const headers: Header[] = [];
  for (const [key, word] of labels) {
    const hit = rows[index].find((w) => !used.has(w) && normalizeName(w.text).split(' ')[0] === word);
    if (!hit) continue;
    used.add(hit);
    headers.push({ key, x: centerX(hit), x0: hit.x0, x1: hit.x1 });
  }
  return { index, headers };
}

/** Splits a row into cells: runs of words separated by gaps under ~2.5 word heights. */
export function cells(row: OcrWord[]): OcrWord[][] {
  const gap = 2.5 * median(row.map((w) => w.y1 - w.y0));
  const out: OcrWord[][] = [];
  for (const w of row) {
    const last = out[out.length - 1];
    if (last && w.x0 - last[last.length - 1].x1 < gap) last.push(w);
    else out.push([w]);
  }
  return out;
}

/** Drops portal link text such as "Ver faltas" / "Ver avaliações". */
export function withoutLinks(row: OcrWord[]): OcrWord[] {
  const i = row.findIndex((w) => w.text === 'Ver');
  return i < 0 ? row : [...row.slice(0, i), ...row.slice(i + 2)];
}

const CODE = /\p{L}.*\d|\d.*\p{L}/u; // e.g. 'ES037', '036C'
const BARS = /^[Il|1]{1,3}$/;

/** Joins name words, repairing roman numerals OCR'd as bars ('||' → 'II') and dropping stray dashes at the ends. */
export function cleanName(words: OcrWord[]): string {
  const tokens = words.map((w, i) => (i > 0 && BARS.test(w.text) ? 'I'.repeat(w.text.length) : w.text));
  while (tokens.length && /^[-—–]+$/.test(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join(' ');
}

/**
 * Picks the subject-name cell of a row: the cell with a word of 3+ letters that starts left of the
 * midpoint between the Disciplina header and the next header and holds no code-like word
 * ('ES037', '036C'), nearest to the Disciplina header.
 * (Names are left-aligned and wide, so nearest-header-center misplaces them.)
 */
export function nameCell(rowCells: OcrWord[][], disciplina: Header, next: Header | undefined): OcrWord[] | null {
  const limit = next ? (disciplina.x + next.x) / 2 : Infinity;
  let best: OcrWord[] | null = null;
  let bestDist = Infinity;
  for (const cell of rowCells) {
    const x0 = cell[0].x0;
    const x1 = cell[cell.length - 1].x1;
    if (x0 >= limit || !cell.some((w) => /\p{L}{3}/u.test(w.text)) || cell.some((w) => CODE.test(w.text))) continue;
    const dist = Math.max(0, disciplina.x0 - x1, x0 - disciplina.x1);
    if (dist < bestDist) [best, bestDist] = [cell, dist];
  }
  return best;
}

export interface TableRow { nome: string; values: Record<string, string[]> }

/**
 * Reads a portal table: header row is the row with a 'Disciplina' word, name comes from
 * `nameCell`, every other word bucketed by `columnOf`. A row whose name has no numeric cells is a
 * wrapped-name fragment and is merged into the vertically nearest row that has numbers.
 * Rows without a name after merging are dropped.
 */
export function readTable(words: OcrWord[], labels: [key: string, word: string][]): TableRow[] {
  const rows = groupRows(words);
  const found = findHeaders(rows, 'disciplina', labels);
  if (!found) return [];
  const { index, headers } = found;
  const disc = headers.find((h) => h.key === 'disciplina')!;
  const next = headers.filter((h) => h.x > disc.x).sort((a, b) => a.x - b.x)[0];

  const parsed = rows.slice(index + 1).map((row) => {
    const clean = withoutLinks(row);
    const name = nameCell(cells(clean), disc, next) ?? [];
    const values: Record<string, string[]> = {};
    for (const w of clean) {
      if (name.includes(w)) continue;
      (values[columnOf(w, headers)] ??= []).push(w.text);
    }
    const numeric = Object.entries(values).some(
      ([key, v]) => key !== 'disciplina' && v.some((t) => parseNumber(t) !== null),
    );
    return { y: median(row.map(centerY)), name, values, numeric, lines: [] as { y: number; words: OcrWord[] }[] };
  });

  const data = parsed.filter((r) => r.numeric);
  for (const frag of parsed.filter((r) => !r.numeric && r.name.length)) {
    const target = data.reduce<(typeof data)[number] | undefined>(
      (best, r) => (!best || Math.abs(r.y - frag.y) < Math.abs(best.y - frag.y) ? r : best),
      undefined,
    );
    target?.lines.push({ y: frag.y, words: frag.name });
  }
  return data
    .map((r) => ({ ...r, lines: [...r.lines, { y: r.y, words: r.name }].sort((a, b) => a.y - b.y) }))
    .filter((r) => r.lines.some((l) => l.words.length))
    .map((r) => ({ nome: cleanName(r.lines.flatMap((l) => l.words)), values: r.values }));
}
