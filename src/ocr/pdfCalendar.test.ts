import { describe, it, expect } from 'vitest';
import { extractCalendarCandidates } from './pdfCalendar';

describe('extractCalendarCandidates', () => {
  it('classifies lines and expands ranges', () => {
    const c = extractCalendarCandidates(
      '20/11 - Feriado Consciência Negra\n24 a 26/12 Recesso acadêmico\n10/12 Simulado\n05/12 Entrega de notas',
      2026,
    );
    expect(c.filter((x) => x.kind === 'sem_aula').map((x) => x.date)).toEqual(['2026-11-20', '2026-12-24', '2026-12-25', '2026-12-26']);
    expect(c.find((x) => x.kind === 'simulado')?.date).toBe('2026-12-10');
    expect(c.find((x) => x.date === '2026-12-05')?.kind).toBe('outro');
  });

  it('matches keywords regardless of case and accents', () => {
    expect(extractCalendarCandidates('01/03 NAO HAVERA AULA', 2026)[0].kind).toBe('sem_aula');
    expect(extractCalendarCandidates('02/03 não haverá aula', 2026)[0].kind).toBe('sem_aula');
    expect(extractCalendarCandidates('03/03 Ponto Facultativo', 2026)[0].kind).toBe('sem_aula');
  });

  it('prefers simulado over sem_aula', () => {
    expect(extractCalendarCandidates('10/05 Simulado - sem aula regular', 2026)[0].kind).toBe('simulado');
  });

  it('supports DD/MM a DD/MM, dash and até, across month and year boundaries', () => {
    const a = extractCalendarCandidates('29/12 até 02/01 Recesso', 2026).map((x) => x.date);
    expect(a).toEqual(['2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
    expect(extractCalendarCandidates('28/04 - 30/04 Recesso', 2026)).toHaveLength(3);
    expect(extractCalendarCandidates('30/04 a 02/05 Recesso', 2026).map((x) => x.date)).toEqual(['2026-04-30', '2026-05-01', '2026-05-02']);
  });

  it('uses the explicit year when present', () => {
    expect(extractCalendarCandidates('15/08/2027 Feriado', 2026)[0].date).toBe('2027-08-15');
  });

  it('skips invalid dates, dedupes and sorts', () => {
    const c = extractCalendarCandidates('31/02 Feriado\n10/03 Feriado\n10/03 Feriado\n05/03 Recesso', 2026);
    expect(c.map((x) => x.date)).toEqual(['2026-03-05', '2026-03-10']);
  });
});
