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

function split(s: string): { words: string[]; numerals: Set<string> } {
  const words: string[] = [];
  const numerals = new Set<string>();
  for (const t of normalizeName(s).split(' ')) {
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

export function matchSubjects(
  base: { id: string; nome: string }[],
  names: string[],
): Record<string, string | null> {
  const taken = new Set<string>();
  const result: Record<string, string | null> = {};
  for (const name of names) {
    const hit = base.find((s) => !taken.has(s.id) && namesMatch(s.nome, name));
    if (hit) taken.add(hit.id);
    result[name] = hit ? hit.id : null;
  }
  return result;
}
