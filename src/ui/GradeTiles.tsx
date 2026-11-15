import type { ComponentChildren } from 'preact';
import { formatFloor, formatNeeded, formatNum } from '../domain/dates';
import { capacity } from '../domain/grades';
import type { GradingKind, Outlook } from '../domain/grades';
import { notaFromAcertos } from '../domain/simulado';
import type { SubjectGrades } from '../domain/types';

export type Key = 'p1' | 'p2' | 'p3';
export const KEYS: Key[] = ['p1', 'p2', 'p3'];

/** Extensão has no simulado and P2 = P1, so it shows two provas: "P1 = P2" and "P3". */
export const keysFor = (kind: GradingKind): Key[] => (kind === 'extensao' ? ['p1', 'p3'] : KEYS);
export const labelFor = (kind: GradingKind, k: Key): string =>
  kind === 'extensao' ? (k === 'p3' ? 'P3' : 'P1 = P2') : ({ p1: 'P1', p2: 'P2', p3: 'P3 · simulado' } as const)[k];

/** One "você precisa" tile: small label, big number, optional small unit. */
export function Tile({ label, big, sub, tone }: { label: string; big: string; sub?: string; tone?: 'ok' | 'bad' | 'rec' }) {
  return (
    <div class={`tile${tone ? ` ${tone}` : ''}`}>
      <span class="t-l">{label}</span>
      <b class="t-v">{big}</b>
      {sub && <span class="t-s">{sub}</span>}
    </div>
  );
}

export function Tiles({ children }: { children: ComponentChildren }) {
  return <div class="tiles">{children}</div>;
}

/** Points toward the 21 needed to pass directly. */
export function Progress({ atual }: { atual: number }) {
  const pct = Math.min(100, Math.max(0, (atual / 21) * 100));
  return (
    <div class="prog" role="meter" aria-label="Pontos até 21" aria-valuemin={0} aria-valuemax={21} aria-valuenow={atual}>
      <div class="prog-bar"><i style={{ width: `${pct}%` }} /></div>
      <span class="prog-t"><b>{formatFloor(atual)}</b> / 21</span>
    </div>
  );
}

/**
 * What the student still needs, as tiles: one per open prova (the simulado in acertos), plus the REC.
 * `skip` leaves out one prova (the calculator shows its parts instead, passed as `lead`).
 */
export function OutlookTiles({ g, o, kind, skip, lead }: {
  g: SubjectGrades; o: Outlook; kind: GradingKind; skip?: Key; lead?: ComponentChildren;
}) {
  if (o.status === 'aprovado') return <Tiles><Tile label="Situação" big="Aprovado" tone="ok" /></Tiles>;
  if (o.status === 'reprovado') return <Tiles><Tile label="Situação" big="Reprovado" sub="média < 4" tone="bad" /></Tiles>;
  const tiles = keysFor(kind).filter((k) => k !== skip && o.shares[k] !== undefined).map((k) => {
    if (k === 'p3' && kind === 'normal' && o.simuladoAcertos !== null) {
      return <Tile key={k} label="Simulado" big={String(o.simuladoAcertos)} sub={`acertos · ${formatNum(notaFromAcertos(o.simuladoAcertos))}`} />;
    }
    const sub = g[k].state === 'incompleta' ? `de ${formatFloor(capacity(g[k]))}` : undefined;
    return <Tile key={k} label={labelFor(kind, k)} big={formatNeeded(o.shares[k] as number)} sub={sub} />;
  });
  return (
    <>
      {o.status === 'rec' && <div class="goals-l">Para ir à REC</div>}
      <Tiles>
        {lead}
        {tiles}
        {o.status === 'rec' && o.recQuestoes !== null && <Tile label="REC" big={`${o.recQuestoes}/10`} sub="questões" tone="rec" />}
      </Tiles>
    </>
  );
}
