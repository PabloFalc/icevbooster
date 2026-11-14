import { describe, it, expect } from 'vitest';
import { SIMULADO_TABLE, notaFromAcertos, acertosFor } from './simulado';

describe('simulado table', () => {
  it('has 61 entries (acertos 0..60)', () => {
    expect(SIMULADO_TABLE).toHaveLength(61);
  });

  it('maps acertos to nota', () => {
    expect(notaFromAcertos(3)).toBe(0.62);
    expect(notaFromAcertos(34)).toBe(7.08);
    expect(notaFromAcertos(48)).toBe(10);
    expect(notaFromAcertos(60)).toBe(10);
  });

  it('finds the smallest acertos reaching a nota', () => {
    expect(acertosFor(5)).toBe(24);
    expect(acertosFor(5.55)).toBe(27);
    expect(acertosFor(6.3)).toBe(31);
    expect(acertosFor(7.15)).toBe(35);
    expect(acertosFor(9.5)).toBe(46);
    expect(acertosFor(10)).toBe(48);
  });

  it('returns null when nota is above 10 and 0 when nota is not positive', () => {
    expect(acertosFor(10.01)).toBeNull();
    expect(acertosFor(0)).toBe(0);
    expect(acertosFor(-1)).toBe(0);
  });
});
