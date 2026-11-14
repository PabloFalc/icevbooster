import { useState } from 'preact/hooks';

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

export function ThemeToggle({ class: cls = '' }: { class?: string }) {
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* storage unavailable */ }
    setTheme(next);
  };
  return (
    <button type="button" class={`theme ${cls}`.trim()} onClick={toggle} aria-label="Alternar tema">
      {theme === 'dark' ? '☾ Escuro' : '☀ Claro'}
    </button>
  );
}
