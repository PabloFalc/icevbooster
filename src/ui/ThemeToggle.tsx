import { signal } from '@preact/signals';

export type Theme = 'light' | 'dark';
export const THEME_KEY = 'icevbooster:theme';

function systemTheme(): Theme {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function storedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

export function currentTheme(): Theme {
  return storedTheme() ?? systemTheme();
}

/** Apply the stored choice to <html>; with no choice, leave data-theme unset so CSS follows the system. */
export function applyStoredTheme(): void {
  const t = storedTheme();
  if (t) document.documentElement.setAttribute('data-theme', t);
}

/** Single source of truth shared by every ThemeToggle instance. */
export const themeSignal = signal<Theme>(currentTheme());

export function toggleTheme(): void {
  const next: Theme = themeSignal.value === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem(THEME_KEY, next); } catch { /* storage unavailable */ }
  themeSignal.value = next;
}

export function ThemeToggle({ class: cls = '' }: { class?: string }) {
  return (
    <button type="button" class={`theme ${cls}`.trim()} onClick={toggleTheme} aria-label="Alternar tema">
      {themeSignal.value === 'dark' ? '☾ Escuro' : '☀ Claro'}
    </button>
  );
}
