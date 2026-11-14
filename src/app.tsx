import { useEffect, useState } from 'preact/hooks';
import { routeFromHash, type Route } from './router';
import { Nav } from './ui/Nav';
import { Footer } from './ui/Footer';
import { Faltas } from './ui/pages/Faltas';
import { Calendario } from './ui/pages/Calendario';
import { Notas } from './ui/pages/Notas';

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
      <main class="page">
        <h1>{TITLES[route]}</h1>
        {route === 'faltas' && <Faltas />}
        {route === 'calendario' && <Calendario />}
        {route === 'notas' && <Notas />}
      </main>
      <Footer />
    </div>
  );
}
