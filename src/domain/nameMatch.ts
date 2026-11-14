export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((t) => (t === 'proj' ? 'projeto' : t))
    .join(' ');
}

const STOPWORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
const ROMAN = /^(i{1,3}|iv|v|vi{0,3}|ix|x)$/;
const BAR_RUN = /^[1lI|]{1,3}$/; // OCR of I/II/III: '1', '11', 'l', '||', 'Il'

/**
 * Reads OCR'd bar runs after a word as the roman numeral of that length ('Eletiva 11' → ii), so
 * the numeral guard still applies. Whole raw tokens are read first, because normalizing drops '|'.
 */
function tokens(s: string): string[] {
  const raw = s.trim().split(/\s+/).map((t, i) => (i > 0 && BAR_RUN.test(t) ? 'I'.repeat(t.length) : t));
  return normalizeName(raw.join(' '))
    .split(' ')
    .map((t, i) => (i > 0 && BAR_RUN.test(t) ? 'i'.repeat(t.length) : t));
}

function split(s: string): { words: string[]; numerals: Set<string> } {
  const words: string[] = [];
  const numerals = new Set<string>();
  for (const t of tokens(s)) {
    if (!t || STOPWORDS.has(t)) continue;
    if (ROMAN.test(t)) numerals.add(t);
    else words.push(t);
  }
  return { words, numerals };
}

function prefixSubset(short: string[], long: string[]): boolean {
  return short.every((t) => long.some((l) => l.startsWith(t)));
}

export function namesMatch(a: string, b: string): boolean {
  const A = split(a);
  const B = split(b);
  if (A.words.length === 0 || B.words.length === 0) return false;
  if (A.numerals.size > 0 && B.numerals.size > 0) {
    if (A.numerals.size !== B.numerals.size) return false;
    for (const n of A.numerals) if (!B.numerals.has(n)) return false;
  }
  return prefixSubset(A.words, B.words) || prefixSubset(B.words, A.words);
}

/**
 * Matches each name (by position) to a base subject id: exact normalized names first, then fuzzy
 * `namesMatch`. Each id is used at most once, so one import never merges two rows into one subject.
 */
export function matchIndices(base: { id: string; nome: string }[], names: string[]): (string | null)[] {
  const taken = new Set<string>();
  const out: (string | null)[] = names.map(() => null);
  const pass = (same: (a: string, b: string) => boolean) => names.forEach((name, i) => {
    if (out[i] !== null) return;
    const hit = base.find((s) => !taken.has(s.id) && same(s.nome, name));
    if (hit) { taken.add(hit.id); out[i] = hit.id; }
  });
  pass((a, b) => normalizeName(a) === normalizeName(b) && normalizeName(a) !== '');
  pass(namesMatch);
  return out;
}

export function matchSubjects(
  base: { id: string; nome: string }[],
  names: string[],
): Record<string, string | null> {
  const ids = matchIndices(base, names);
  return Object.fromEntries(names.map((n, i) => [n, ids[i]]));
}
