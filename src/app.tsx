import { useEffect, useState } from 'preact/hooks';
import { routeFromHash, type Route } from './router';
import { Nav } from './ui/Nav';
import { Footer } from './ui/Footer';
import { Faltas } from './ui/pages/Faltas';
import { Calendario } from './ui/pages/Calendario';
import { Notas } from './ui/pages/Notas';
import { Calculadora } from './ui/pages/Calculadora';

/** What each page is for, in a few words, under its title. */
const SUBTITLES: Record<Route, string> = {
  faltas: 'Quanto ainda dá para faltar',
  calendario: 'Onde dá para faltar, dia a dia',
  notas: 'Quanto falta para passar',
  calculadora: 'Monte sua nota por partes',
};

const TITLES: Record<Route, string> = {
  faltas: 'Faltas',
  calendario: 'Calendário',
  notas: 'Notas',
  calculadora: 'Calculadora',
};

export function App() {
  const [route, setRoute] = useState<Route>(() => routeFromHash(location.hash));
  useEffect(() => {
    const on = () => setRoute(routeFromHash(location.hash));
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return (
    <div class="shell">
      <Nav route={route} />
      {/* keyed by route: the page remounts and plays its entrance animation */}
      <main class="page" key={route}>
        <header class="page-hd">
          <h1>{TITLES[route]}</h1>
          <p>{SUBTITLES[route]}</p>
        </header>
        {route === 'faltas' && <Faltas />}
        {route === 'calendario' && <Calendario />}
        {route === 'notas' && <Notas />}
        {route === 'calculadora' && <Calculadora />}
      </main>
      <Footer />
    </div>
  );
}
