import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { addDays } from '../domain/dates';
import { normalizeName } from '../domain/nameMatch';
import type { Iso } from '../domain/types';

export interface CalendarCandidate {
  date: Iso;
  label: string;
  kind: 'sem_aula' | 'simulado' | 'outro';
}

const SEM_AULA = /\b(feriado|recesso|sem aula|nao havera aula|ponto facultativo)\b/;
const RANGE = /(?<!\d)(\d{1,2})(?:\/(\d{1,2}))?(?:\/(\d{4}))?\s*(?:a|at[eé]|-|–)\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?(?!\d)/g;
const SINGLE = /(?<!\d)(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?(?!\d)/g;

function toIso(y: number, m: number, d: number): Iso | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

function kindOf(line: string): CalendarCandidate['kind'] {
  const n = normalizeName(line);
  if (/\bsimulado\b/.test(n)) return 'simulado';
  return SEM_AULA.test(n) ? 'sem_aula' : 'outro';
}

export function extractCalendarCandidates(text: string, year: number): CalendarCandidate[] {
  const seen = new Set<string>();
  const out: CalendarCandidate[] = [];
  const add = (date: Iso | null, label: string, kind: CalendarCandidate['kind']) => {
    if (!date || seen.has(`${date}|${kind}`)) return;
    seen.add(`${date}|${kind}`);
    out.push({ date, label, kind });
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const kind = kindOf(line);
    const label = line;

    const rest = line.replace(RANGE, (_m, d1, m1, y1, d2, m2, y2) => {
      const startY = y1 ? Number(y1) : y2 ? Number(y2) : year;
      const start = toIso(startY, m1 ? Number(m1) : Number(m2), Number(d1));
      let end = toIso(y2 ? Number(y2) : startY, Number(m2), Number(d2));
      if (start && !y2 && (!end || end < start)) end = toIso(startY + 1, Number(m2), Number(d2)); // crosses into January
      if (start && end && end >= start) {
        for (let d = start, i = 0; d <= end && i < 366; d = addDays(d, 1), i++) add(d, label, kind);
      }
      return ' ';
    });

    for (const m of rest.matchAll(SINGLE)) {
      add(toIso(m[3] ? Number(m[3]) : year, Number(m[2]), Number(m[1])), label, kind);
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export async function pdfToText(file: Blob): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    let s = '';
    for (const it of content.items) {
      if (!('str' in it)) continue;
      s += it.str + (it.hasEOL ? '\n' : ' ');
    }
    pages.push(s);
  }
  return pages.join('\n');
}
