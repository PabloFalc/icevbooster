import { useEffect, useRef } from 'preact/hooks';
import { formatNum } from '../domain/dates';
import { SIMULADO_TABLE } from '../domain/simulado';

const ROWS = SIMULADO_TABLE.slice(0, SIMULADO_TABLE.indexOf(10) + 1);

/** Rows from 0 acertos up to the first 10,00 (48 acertos; more is still 10) in 4 columns; the `highlight` row gets class `hl` and is scrolled into view. */
export function SimuladoTable({ highlight: raw }: { highlight?: number | null }) {
  // 48+ acertos all score 10: they share the last row
  const highlight = raw == null ? raw : Math.min(raw, ROWS.length - 1);
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
      {ROWS.map((nota, acertos) => (
        <div key={acertos} class={acertos === highlight ? 'hl' : undefined} aria-current={acertos === highlight ? 'true' : undefined}>
          <span>{acertos === ROWS.length - 1 ? `${acertos}+` : acertos}</span>{formatNum(nota)}
        </div>
      ))}
    </div>
  );
}
