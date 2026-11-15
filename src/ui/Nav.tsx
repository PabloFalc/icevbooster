import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Route } from '../router';
import { ThemeToggle } from './ThemeToggle';

const Icon = ({ children }: { children: ComponentChildren }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">{children}</svg>
);

const TABS: { route: Route; label: string; icon: ComponentChildren }[] = [
  { route: 'faltas', label: 'Faltas', icon: <Icon><path d="M12 8v5l3 2" /><circle cx="12" cy="12" r="9" /></Icon> },
  { route: 'calendario', label: 'Calendário', icon: <Icon><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M3 9h18M8 2v4M16 2v4" /></Icon> },
  { route: 'notas', label: 'Notas', icon: <Icon><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Icon> },
  { route: 'calculadora', label: 'Calculadora', icon: <Icon><rect x="5" y="2" width="14" height="20" rx="3" /><path d="M8 6h8M8 11h2M14 11h2M8 15h2M14 15h2" /></Icon> },
];

interface Box { left: number; top: number; width: number; height: number }

export function Nav({ route }: { route: Route }) {
  // a pill behind the tabs that slides to the active one
  const nav = useRef<HTMLElement>(null);
  const [ind, setInd] = useState<Box | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = nav.current?.querySelector<HTMLElement>('.tab.on');
      if (el) setInd({ left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight });
    };
    measure();
    addEventListener('resize', measure);
    return () => removeEventListener('resize', measure);
  }, [route]);
  return (
    <>
      <nav class="topnav glass" aria-label="Principal" ref={nav}>
        {ind && <span class="tab-ind" aria-hidden="true" style={{ transform: `translate(${ind.left}px, ${ind.top}px)`, width: `${ind.width}px`, height: `${ind.height}px` }} />}
        <div class="brand">icev<span>booster</span></div>
        {TABS.map((t) => (
          <a key={t.route} href={`#/${t.route}`} class={`tab${t.route === route ? ' on' : ''}`} aria-current={t.route === route ? 'page' : undefined}>
            {t.icon}
            {t.label}
          </a>
        ))}
        <ThemeToggle class="theme-top" />
      </nav>
      <ThemeToggle class="theme-float glass" />
    </>
  );
}
