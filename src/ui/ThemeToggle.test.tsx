import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/preact';
import { ThemeToggle, themeSignal, toggleTheme, THEME_KEY } from './ThemeToggle';

beforeEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  themeSignal.value = 'light';
});

describe('theme state', () => {
  it('toggleTheme flips, applies data-theme and persists', () => {
    toggleTheme();
    expect(themeSignal.value).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    toggleTheme();
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
  });

  it('two toggle instances stay in sync', () => {
    render(<><ThemeToggle class="a" /><ThemeToggle class="b" /></>);
    const [a, b] = screen.getAllByRole('button');
    expect(a.textContent).toBe('☀ Claro');
    fireEvent.click(a);
    expect(a.textContent).toBe('☾ Escuro');
    expect(b.textContent).toBe('☾ Escuro');
    fireEvent.click(b);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(a.textContent).toBe('☀ Claro');
  });
});
