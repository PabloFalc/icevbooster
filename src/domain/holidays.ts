import { addDays } from './dates';
import type { Iso } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Gregorian Easter (Meeus/Jones/Butcher). */
export function easter(year: number): Iso {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${pad(month)}-${pad(day)}`;
}

const FIXED: Array<[string, string]> = [
  ['01-01', 'Confraternização'], ['03-13', 'Batalha do Jenipapo'], ['04-21', 'Tiradentes'],
  ['05-01', 'Dia do Trabalho'], ['08-16', 'Aniversário de Teresina'], ['09-07', 'Independência'],
  ['10-12', 'N. Sra. Aparecida'], ['10-19', 'Dia do Piauí'], ['11-02', 'Finados'],
  ['11-15', 'Proclamação da República'], ['11-20', 'Consciência Negra'], ['12-25', 'Natal'],
];

export function holidaysFor(year: number): Record<Iso, string> {
  const out: Record<Iso, string> = {};
  for (const [md, name] of FIXED) out[`${year}-${md}`] = name;
  const e = easter(year);
  out[addDays(e, -48)] = 'Carnaval';
  out[addDays(e, -47)] = 'Carnaval';
  out[addDays(e, -2)] = 'Sexta-feira Santa';
  out[addDays(e, 60)] = 'Corpus Christi';
  return out;
}
