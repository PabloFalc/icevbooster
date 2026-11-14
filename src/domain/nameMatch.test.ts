import { describe, it, expect } from 'vitest';
import { normalizeName, namesMatch, matchSubjects, matchIndices } from './nameMatch';

describe('normalizeName', () => {
  it('lowercases, strips accents and punctuation, expands proj', () => {
    expect(normalizeName('Inglês VI')).toBe('ingles vi');
    expect(normalizeName('Proj. Extensão-VI')).toBe('projeto extensao vi');
    expect(normalizeName('  Gestão   de   Projetos ')).toBe('gestao de projetos');
  });
});

describe('namesMatch', () => {
  it('matches fuzzy subject names', () => {
    expect(namesMatch('Proj. de Extensão VI', 'Projeto de Extensão VI')).toBe(true);
    expect(namesMatch('Gestão de Projetos', 'Gestão de Projetos de Software')).toBe(true);
    expect(namesMatch('Estágio Supervisionado', 'Estágio Curricular Supervisionado - Fábrica de Software I')).toBe(true);
    expect(namesMatch('Eletiva II - Gestão de Pessoas', 'Eletiva II')).toBe(true);
    expect(namesMatch('Marketing Digital', 'Pesquisa Operacional')).toBe(false);
  });
  it('requires equal numerals only when both sides have one', () => {
    expect(namesMatch('Eletiva VI', 'Eletiva II')).toBe(false);
    expect(namesMatch('Eletiva', 'Eletiva II')).toBe(true);
  });
  it('reads OCR bar runs after a word as roman numerals', () => {
    expect(namesMatch('Eletiva 11 - Gestão de Pessoas', 'Eletiva II')).toBe(true);
    expect(namesMatch('Eletiva 11 - Gestão de Pessoas', 'Eletiva VI')).toBe(false);
    expect(namesMatch('Proj. de Extensão 1', 'Projeto de Extensão VI')).toBe(false);
  });
  it('never matches names empty after stopwords/numerals', () => {
    expect(namesMatch('de e', 'de e')).toBe(false);
    expect(namesMatch('II', 'II')).toBe(false);
  });
});

describe('matchSubjects', () => {
  const base = [
    { id: 'a', nome: 'Eletiva II' },
    { id: 'b', nome: 'Eletiva II - Gestão de Pessoas' },
    { id: 'c', nome: 'Marketing Digital' },
  ];
  it('assigns greedily, each id at most once', () => {
    expect(matchSubjects(base, ['Eletiva II', 'Eletiva II - Gestão de Pessoas', 'Marketing Digital', 'Física'])).toEqual({
      'Eletiva II': 'a',
      'Eletiva II - Gestão de Pessoas': 'b',
      'Marketing Digital': 'c',
      'Física': null,
    });
  });
});

describe('exact names first', () => {
  const base = [{ id: 'bd', nome: 'Banco de Dados' }, { id: 'bd2', nome: 'Banco de Dados II' }, { id: 'p', nome: 'Programação' }, { id: 'pw', nome: 'Programação Web' }];
  it('matchSubjects prefers an exact name over an earlier fuzzy one', () => {
    expect(matchSubjects(base, ['Banco de Dados II', 'Programação Web', 'Banco de Dados', 'Programação'])).toEqual({
      'Banco de Dados II': 'bd2', 'Programação Web': 'pw', 'Banco de Dados': 'bd', 'Programação': 'p',
    });
  });
  it('matchIndices never maps two names onto one subject', () => {
    expect(matchIndices([{ id: 'p', nome: 'Programação' }], ['Programação Web', 'Programação'])).toEqual([null, 'p']);
    expect(matchIndices([{ id: 'bd', nome: 'Banco de Dados' }], ['Banco de Dados', 'Banco de Dados'])).toEqual(['bd', null]);
  });
});
