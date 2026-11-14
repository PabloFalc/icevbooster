import { describe, it, expect } from 'vitest';
import { normalizeName } from './nameMatch';

describe('normalizeName', () => {
  it('lowercases, strips accents and punctuation, expands proj', () => {
    expect(normalizeName('Inglês VI')).toBe('ingles vi');
    expect(normalizeName('Proj. Extensão-VI')).toBe('projeto extensao vi');
    expect(normalizeName('  Gestão   de   Projetos ')).toBe('gestao de projetos');
  });
});
