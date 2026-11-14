import { useEffect, useRef } from 'preact/hooks';
import { formatNum } from '../domain/dates';
import { SIMULADO_TABLE } from '../domain/simulado';

/** All 61 rows (0–60 acertos) in 4 columns; the `highlight` row gets class `hl` and is scrolled into view. */
export function SimuladoTable({ highlight }: { highlight?: number | null }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const c = box.current;
    const el = c?.querySelector<HTMLElement>('.hl');
    if (!c || !el) return;
    // scroll only the table box (scrollIntoView would also move the whole page)
    c.scrollTop = Math.max(0, el.offsetTop - c.clientHeight / 2 + el.offsetHeight / 2);
  }, [highlight]);
  return (
    <div class="simtab" ref={box} tabIndex={0} aria-label="Tabela do simulado">
      {SIMULADO_TABLE.map((nota, acertos) => (
        <div key={acertos} class={acertos === highlight ? 'hl' : undefined} aria-current={acertos === highlight ? 'true' : undefined}>
          <span>{acertos}</span>{formatNum(nota)}
        </div>
      ))}
    </div>
  );
}
