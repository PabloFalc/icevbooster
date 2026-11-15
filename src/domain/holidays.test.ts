import { describe, it, expect } from 'vitest';
import { easter, holidaysFor } from './holidays';

describe('holidays', () => {
  it('computes easter and movable/fixed holidays', () => {
    expect(easter(2026)).toBe('2026-04-05');
    const h = holidaysFor(2026);
    expect(h['2026-02-16']).toBe('Carnaval'); expect(h['2026-02-17']).toBe('Carnaval');
    expect(h['2026-04-03']).toBe('Sexta-feira Santa'); expect(h['2026-06-04']).toBe('Corpus Christi');
    expect(h['2026-11-20']).toBe('Consciência Negra'); expect(h['2026-02-18']).toBeUndefined();
    expect(h['2026-10-19']).toBe('Dia do Piauí');
  });
});
