import type { Iso } from './types';

const toUtc = (d: Iso): Date => new Date(`${d}T00:00:00Z`);

export function addDays(d: Iso, n: number): Iso {
  const t = toUtc(d);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/** 0 = domingo … 6 = sábado. Parsed as UTC so it is timezone-safe. */
export function weekdayOf(d: Iso): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  return toUtc(d).getUTCDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

export function todayIso(): Iso {
  const n = new Date();
  const p = (x: number) => String(x).padStart(2, '0');
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
}

export function formatBr(d: Iso): string {
  return `${d.slice(8, 10)}/${d.slice(5, 7)}`;
}

export function formatNum(n: number, decimals = 2): string {
  return n.toFixed(decimals).replace('.', ',');
}

/** A needed amount: ceiled to 2 decimals (1e-9 tolerance for float noise), never rounded in the student's favor. */
export function formatNeeded(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return formatNum(Math.max(0, Math.ceil(n * 100 - 1e-9) / 100));
}

/** A guaranteed or achievable amount: floored to 2 decimals (1e-9 tolerance for float noise), never rounded up. */
export function formatFloor(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return formatNum(Math.floor(n * 100 + 1e-9) / 100);
}

/** Parses a typed number, accepting a comma decimal ('7,5' → 7.5); null when empty or not a finite number. */
export function parseDecimal(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
