import { describe, it, expect } from 'vitest';
import { routeFromHash } from './router';

describe('routeFromHash', () => {
  it('defaults to faltas', () => {
    expect(routeFromHash('')).toBe('faltas');
    expect(routeFromHash('#/xyz')).toBe('faltas');
  });
  it('parses known routes', () => {
    expect(routeFromHash('#/notas')).toBe('notas');
    expect(routeFromHash('#/calendario')).toBe('calendario');
    expect(routeFromHash('#/calculadora')).toBe('calculadora');
  });
  it('ignores a query after the route', () => {
    expect(routeFromHash('#/calculadora?m=x&p=p2')).toBe('calculadora');
  });
});
