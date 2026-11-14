import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { compositeNeeds, compositeSummary } from '../../domain/composite';
import type { Composite, CompositeMode, Part } from '../../domain/composite';
import { formatNeeded, formatNum, parseDecimal } from '../../domain/dates';
import { gradeOutlook } from '../../domain/grades';
import type { Outlook } from '../../domain/grades';
import { notaFromAcertos } from '../../domain/simulado';
import type { SubjectGrades } from '../../domain/types';
import { removeComposite, setComposite, state } from '../../state/store';
import { SimuladoTable } from '../SimuladoTable';

type PKey = 'p1' | 'p2';
interface Link { m: string; p: PKey }

const fmtInput = (v: number | null) => (v === null ? '' : String(v).replace('.', ','));
const fmtSum = (n: number) => formatNum(n).replace(/,00$/, '').replace(/(,\d)0$/, '$1');
const defaultComposite = (): Composite => ({ mode: 'pontos', parts: [{ nome: 'Prova', max: 10, tirei: null }] });
const emptySlot = () => ({ state: 'nao_feita' as const, value: null });

/** Reads `?m=<id>&p=p1|p2` from the hash; invalid or unknown → null (Cálculo livre). */
function linkFromHash(hash: string): Link | null {
  const params = new URLSearchParams(hash.split('?')[1] ?? '');
  const m = params.get('m');
  const p = params.get('p');
  if (!m || (p !== 'p1' && p !== 'p2')) return null;
  return state.value.subjects.some((s) => s.id === m) ? { m, p } : null;
}

/** Text input for a number: commits on blur/Enter, comma decimals; `nullable` lets an empty field mean "ainda não". */
function NumInput({ value, label, nullable, placeholder, accept, onCommit }: {
  value: number | null; label: string; nullable?: boolean; placeholder?: string;
  accept(n: number): boolean; onCommit(n: number | null): void;
}) {
  const [text, setText] = useState(fmtInput(value));
  useEffect(() => setText(fmtInput(value)), [value]);
  const commit = () => {
    if (text.trim() === '') {
      if (nullable) onCommit(null); else setText(fmtInput(value));
      return;
    }
    const n = parseDecimal(text);
    if (n !== null && accept(n)) onCommit(n);
    else setText(fmtInput(value));
  };
  return (
    <input
      class="num field" type="text" inputMode="decimal" aria-label={label} value={text} placeholder={placeholder}
      onInput={(e) => setText(e.currentTarget.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    />
  );
}

/** Same grade, other mode: points and peso keep their meaning (a part worth 3 points = 30%). */
function convertMode(c: Composite, mode: CompositeMode): Composite {
  if (c.mode === mode) return c;
  const parts = c.parts.map((p): Part => {
    if (mode === 'peso') {
      return { nome: p.nome, max: p.max * 10, tirei: p.tirei === null || p.max <= 0 ? null : Math.min(10, (p.tirei / p.max) * 10) };
    }
    return { nome: p.nome, max: p.max / 10, tirei: p.tirei === null ? null : (p.tirei / 10) * (p.max / 10) };
  });
  return { mode, parts };
}

const acertosText = (n: number) => `${n} ${n === 1 ? 'acerto' : 'acertos'}`;

function Needs({ link, c, o }: { link: Link; c: Composite; o: Outlook }) {
  if (o.status === 'aprovado') return <>Nesta matéria você já está aprovado.</>;
  if (o.status === 'reprovado') return <>Nem com 10 nas provas que faltam esta matéria chega à média 4.</>;
  const own = o.shares[link.p];
  const needs = own === undefined ? c.parts.map(() => null) : compositeNeeds(c, own);
  const lines: ComponentChildren[] = [];
  c.parts.forEach((p, i) => {
    const n = needs[i];
    if (n === null || !Number.isFinite(n)) return;
    const shown = c.mode === 'peso' ? Math.min(n, 10) : n;
    const de = c.mode === 'pontos' ? ` (de ${fmtSum(p.max)})` : '';
    lines.push(<span key={`part${i}`}>Tire <b>{formatNeeded(shown)}</b> em {p.nome || `parte ${i + 1}`}{de}</span>);
  });
  for (const k of ['p1', 'p2'] as const) {
    const v = o.shares[k];
    if (k !== link.p && v !== undefined) lines.push(<span key={k}><b>{formatNeeded(v)}</b> na {k.toUpperCase()}</span>);
  }
  if (o.shares.p3 !== undefined) {
    lines.push(
      <span key="p3">
        <b>{formatNeeded(o.shares.p3)}</b> no simulado
        {o.simuladoAcertos !== null && <> → <span class="acc">{acertosText(o.simuladoAcertos)}</span> ({formatNum(notaFromAcertos(o.simuladoAcertos))})</>}
      </span>,
    );
  }
  return (
    <>
      Com {formatNum(o.atual)} pontos na matéria, faltam <b>{formatNeeded(o.restantes)}</b> para os 21.
      {lines.length > 0 && (
        <>
          <br />{o.status === 'rec' ? 'Só com REC (média ≥ 4): ' : ''}
          {lines.flatMap((l, i) => (i ? [<br key={`b${i}`} />, l] : [l]))}
          {o.status === 'rec' && o.recQuestoes !== null && <><br />Aí precisaria de <b>{o.recQuestoes}/10</b> questões na REC.</>}
        </>
      )}
    </>
  );
}

export function Calculadora() {
  const [link, setLink] = useState<Link | null>(() => linkFromHash(location.hash));
  useEffect(() => {
    const on = () => setLink(linkFromHash(location.hash));
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);

  const { subjects, composites, grades } = state.value;
  const key = link ? `${link.m}:${link.p}` : 'livre';
  const stored = composites[key];
  const c = stored ?? defaultComposite();
  const linked = link !== null && stored !== undefined;
  const subject = link ? subjects.find((s) => s.id === link.m) : undefined;

  const select = (value: string) => {
    const [m, p] = value.split(':');
    const next: Link | null = value === 'livre' ? null : { m, p: p as PKey };
    history.replaceState(null, '', next ? `#/calculadora?m=${encodeURIComponent(m)}&p=${p}` : '#/calculadora');
    setLink(next);
  };
  const save = (next: Composite) => setComposite(key, next);
  const setPart = (i: number, patch: Partial<Part>) => save({ ...c, parts: c.parts.map((p, j) => (j === i ? { ...p, ...patch } : p)) });

  const sum = compositeSummary(c);
  const total = c.parts.reduce((s, p) => s + (Number.isFinite(p.max) && p.max > 0 ? p.max : 0), 0);
  const peso = c.mode === 'peso';
  const g: SubjectGrades = (subject && grades[subject.id]) || { p1: emptySlot(), p2: emptySlot(), p3: emptySlot() };
  const outlook = subject ? gradeOutlook(g) : null;
  const unit = link ? link.p.toUpperCase() : 'nota';

  return (
    <div class="calc-page">
      <section class="card glass">
        <div class="hd">
          <div>
            <h3>Montar uma nota</h3>
            <div class="meta">{link && subject ? `ligada a: ${subject.nome} · ${unit}` : 'cálculo livre, não altera suas notas'}</div>
          </div>
          <div class="seg" role="group" aria-label="Modo">
            <button type="button" class={peso ? '' : 'on'} aria-pressed={!peso} onClick={() => save(convertMode(c, 'pontos'))}>Por pontos</button>
            <button type="button" class={peso ? 'on' : ''} aria-pressed={peso} onClick={() => save(convertMode(c, 'peso'))}>Por peso</button>
          </div>
        </div>

        <label class="lbl link-sel">
          Ligar a
          <select aria-label="Ligar a" value={link ? key : 'livre'} onChange={(e) => select(e.currentTarget.value)}>
            <option value="livre">Cálculo livre</option>
            {subjects.flatMap((s) => (['p1', 'p2'] as const).map((p) => (
              <option key={`${s.id}:${p}`} value={`${s.id}:${p}`}>{s.nome} · {p.toUpperCase()}</option>
            )))}
          </select>
        </label>

        <div class="lbl">Partes da {unit} ({peso ? 'soma dos pesos = 100%' : 'soma dos máximos = 10'})</div>
        {c.parts.map((p, i) => (
          <div class="part" key={i}>
            <input
              class="field nome" type="text" aria-label={`Nome da parte ${i + 1}`} value={p.nome} placeholder="Nome"
              onInput={(e) => setPart(i, { nome: e.currentTarget.value })}
            />
            <span class="dim">{peso ? 'peso %' : 'vale'}</span>
            <NumInput
              value={p.max} label={`${peso ? 'Peso' : 'Vale'} da parte ${i + 1}`}
              accept={(n) => n >= 0 && (peso ? n <= 100 : n <= 10)} onCommit={(n) => { if (n !== null) setPart(i, { max: n }); }}
            />
            <span class="dim">{peso ? 'nota' : 'tirei'}</span>
            <NumInput
              value={p.tirei} label={`${peso ? 'Nota' : 'Tirei'} na parte ${i + 1}`} nullable placeholder="ainda não"
              accept={(n) => n >= 0} onCommit={(n) => setPart(i, { tirei: n === null ? null : Math.min(n, peso ? 10 : p.max) })}
            />
            <button
              type="button" class="x" aria-label={`Remover parte ${i + 1}`} disabled={c.parts.length <= 1}
              onClick={() => save({ ...c, parts: c.parts.filter((_, j) => j !== i) })}
            >×</button>
          </div>
        ))}
        <button type="button" class="add" onClick={() => save({ ...c, parts: [...c.parts, { nome: `Parte ${c.parts.length + 1}`, max: 0, tirei: null }] })}>
          ＋ adicionar parte
        </button>

        {!sum.valid && (
          <p class="warn-msg" role="alert">
            {peso ? `A soma dos pesos precisa dar 100% (agora: ${fmtSum(total)}%).` : `A soma dos valores precisa dar 10 (agora: ${fmtSum(total)}).`}
          </p>
        )}

        <div class={`result inner${sum.valid ? '' : ' flagged'}`} aria-live="polite">
          Garantido na {unit}: <b>{formatNum(sum.garantido)}</b> · ainda dá para ganhar: <b>{formatNum(sum.potencial)}</b>
          {!sum.valid && <small class="flag"> (conta provisória: a soma não fecha)</small>}
          {link && linked && outlook && (<><br /><Needs link={link} c={c} o={outlook} /></>)}
        </div>

        {link && subject && (
          <div class="link-actions">
            {linked ? (
              <>
                <button type="button" class="btn" onClick={() => removeComposite(key)}>Desvincular</button>
                <small>Libera a nota para edição na aba Notas, mantendo os valores atuais.</small>
              </>
            ) : <small>Ao editar as partes, a {unit} de {subject.nome} passa a seguir este cálculo.</small>}
          </div>
        )}
      </section>

      <section class="card glass">
        <h3>Tabela do simulado</h3>
        <div class="meta">60 questões · destaque = sua meta</div>
        <SimuladoTable highlight={outlook?.simuladoAcertos ?? null} />
      </section>
    </div>
  );
}
