export type Route = 'faltas' | 'calendario' | 'notas' | 'calculadora';

export const ROUTES: Route[] = ['faltas', 'calendario', 'notas', 'calculadora'];

export function routeFromHash(hash: string): Route {
  const name = hash.replace(/^#\/?/, '');
  return (ROUTES as string[]).includes(name) ? (name as Route) : 'faltas';
}
