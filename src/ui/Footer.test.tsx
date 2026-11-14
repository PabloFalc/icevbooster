import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/preact';
import { Footer } from './Footer';
import { state, defaultState, importFaltas, STORAGE_KEY } from '../state/store';
import { THEME_KEY } from './ThemeToggle';

const MSG = 'Apagar todos os dados salvos neste aparelho? Isso não pode ser desfeito.';

beforeEach(() => {
  cleanup();
  localStorage.clear();
  state.value = defaultState();
  importFaltas([{ nome: 'Anatomia', faltas: 3, percentual: null, turma: null } as never], '2026-11-14');
  localStorage.setItem(THEME_KEY, 'dark');
});
afterEach(() => vi.restoreAllMocks());

describe('Footer', () => {
  it('shows the unofficial disclaimer', () => {
    render(<Footer />);
    expect(screen.getByText('Ferramenta não oficial — confira sempre no portal do ICEV.')).toBeTruthy();
  });

  it('erases saved data after confirmation and keeps the theme', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<Footer />);
    expect(state.value.subjects.length).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Apagar meus dados' }));
    expect(confirm).toHaveBeenCalledWith(MSG);
    expect(state.value).toEqual(defaultState());
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('does nothing when the user cancels', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<Footer />);
    fireEvent.click(screen.getByRole('button', { name: 'Apagar meus dados' }));
    expect(state.value.subjects.length).toBe(1);
  });
});
