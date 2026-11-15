import { useEffect, useState } from 'preact/hooks';
import { compositeNeeds, compositeSummary, compositeToSlot } from '../../domain/composite';
import type { Composite, CompositeMode, Part } from '../../domain/composite';
import { formatFloor, formatNeeded, formatNum, parseDecimal } from '../../domain/dates';
import { gradeOutlook, gradingKind } from '../../domain/grades';
import { acertosFor, notaFromAcertos } from '../../domain/simulado';
import type { GradeSlot, SubjectGrades } from '../../domain/types';
import { removeComposite, setComposite, setGradeSlot, state } from '../../state/store';
import { keysFor, labelFor, OutlookTiles, Progress, Tile } from '../GradeTiles';
import type { Key } from '../GradeTiles';
import { SimuladoTable } from '../SimuladoTable';

const fmtInput = (v: number | null) => (v === null ? '' : String(v).replace('.', ','));
const fmtSum = (n: number) => formatNum(n).replace(/,00$/, '').replace(/(,\d)0$/, '$1');
const defaultComposite = (): Composite => ({ mode: 'pontos', parts: [{ nome: 'Prova', max: 10, tirei: null }] });
/** Form to show when nothing is stored: mirrors the existing grade slot so a first edit never wipes it. */
function seedComposite(s: GradeSlot): Composite {
  const v = typeof s.value === 'number' && Number.isFinite(s.value) ? Math.min(10, Math.max(0, s.value)) : 0;
  if (s.state === 'completa') return { mode: 'pontos', parts: [{ nome: 'Prova', max: 10, tirei: v }] };
  if (s.state === 'incompleta') {
    return { mode: 'pontos', parts: [{ nome: 'Já garantido', max: v, tirei: v }, { nome: 'Restante', max: 10 - v, tirei: null }] };
  }
  return defaultComposite();
}
const emptySlot = (): GradeSlot => ({ state: 'nao_feita', value: null });
const isKey = (p: string | null): p is Key => p === 'p1' || p === 'p2' || p === 'p3';

/** Reads `?m=<id>&p=p1|p2|p3` from the hash: the subject (null = cálculo livre) and the prova, independently. */
function fromHash(hash: string): { m: string | null; p: Key | null } {
  const params = new URLSearchParams(hash.split('?')[1] ?? '');
  const m = params.get('m');
  const p = params.get('p');
  return { m: m && state.value.subjects.some((s) => s.id === m) ? m : null, p: isKey(p) ? p : null };
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

/** Parts editor for one prova (quizzes, trabalhos, prova…), by points or by weight. */
function PartsForm({ c, save, linked }: { c: Composite; save(c: Composite): void; linked: boolean }) {
  const peso = c.mode === 'peso';
  const setPart = (i: number, patch: Partial<Part>) => save({ ...c, parts: c.parts.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const sum = compositeSummary(c);
  const total = c.parts.reduce((s, p) => s + (Number.isFinite(p.max) && p.max > 0 ? p.max : 0), 0);
  return (
    <>
      <div class="seg" role="group" aria-label="Modo">
        <button type="button" class={peso ? '' : 'on'} aria-pressed={!peso} onClick={() => save(convertMode(c, 'pontos'))}>Por pontos</button>
        <button type="button" class={peso ? 'on' : ''} aria-pressed={peso} onClick={() => save(convertMode(c, 'peso'))}>Por peso</button>
      </div>
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
            value={p.tirei} label={`${peso ? 'Nota' : 'Tirei'} na parte ${i + 1}`} nullable placeholder="—"
            accept={(n) => n >= 0} onCommit={(n) => setPart(i, { tirei: n === null ? null : Math.min(n, peso ? 10 : p.max) })}
          />
          <button
            type="button" class="x" aria-label={`Remover parte ${i + 1}`} disabled={c.parts.length <= 1}
            onClick={() => save({ ...c, parts: c.parts.filter((_, j) => j !== i) })}
          >×</button>
        </div>
      ))}
      <button type="button" class="add" onClick={() => save({ ...c, parts: [...c.parts, { nome: `Parte ${c.parts.length + 1}`, max: 0, tirei: null }] })}>
        ＋ parte
      </button>
      {!sum.valid && (
        <p class="warn-msg" role="alert">
          {peso ? `Os pesos somam ${fmtSum(total)}% (precisa 100%).` : `As partes somam ${fmtSum(total)} (precisa 10).`}
          {linked ? ' A nota não é atualizada.' : ''}
        </p>
      )}
    </>
  );
}

export function Calculadora() {
  const init = fromHash(location.hash);
  const [m, setM] = useState<string | null>(init.m);
  const [prova, setProva] = useState<Key>(init.p ?? 'p2');
  useEffect(() => {
    const on = () => {
      const h = fromHash(location.hash);
      setM(h.m);
      if (h.p) setProva(h.p);
    };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);

  const { subjects, composites, grades } = state.value;
  const subject = m ? subjects.find((s) => s.id === m) : undefined;
  const kind = subject ? gradingKind(subject.nome) : 'normal';
  const keys = subject ? keysFor(kind) : (['p1', 'p2', 'p3'] as Key[]);
  // Extensão has a single "P1 = P2" grade: P2 shows as P1
  const p: Key = keys.includes(prova) ? prova : 'p1';
  const simulado = Boolean(subject) && kind === 'normal' && p === 'p3';

  const go = (nextM: string | null, nextP: Key) => {
    history.replaceState(null, '', nextM ? `#/calculadora?m=${encodeURIComponent(nextM)}&p=${nextP}` : '#/calculadora');
    setM(nextM);
    setProva(nextP);
  };

  const key = subject ? `${subject.id}:${p}` : 'livre';
  const stored = composites[key];
  const realGrades: SubjectGrades = (subject && grades[subject.id]) || { p1: emptySlot(), p2: emptySlot(), p3: emptySlot() };
  const c = stored ?? (subject ? seedComposite(realGrades[p]) : defaultComposite());
  const sum = compositeSummary(c);
  const save = (next: Composite) => setComposite(key, next);

  // the outlook reflects the form (seeded or stored) for the selected prova
  const g: SubjectGrades = subject && !simulado ? { ...realGrades, [p]: sum.valid ? compositeToSlot(c) : realGrades[p] } : realGrades;
  const outlook = subject ? gradeOutlook(g, kind) : null;
  const share = outlook?.shares[p];
  const needs = !simulado && share !== undefined ? compositeNeeds(c, share) : c.parts.map(() => null);
  const partTiles = needs.flatMap((n, i) => {
    if (n === null || !Number.isFinite(n)) return [];
    const part = c.parts[i];
    const shown = c.mode === 'peso' ? Math.min(n, 10) : n;
    return [<Tile key={`part${i}`} label={part.nome || `Parte ${i + 1}`} big={formatNeeded(shown)} sub={c.mode === 'pontos' ? `de ${fmtSum(part.max)}` : 'nota'} />];
  });

  const p3 = realGrades.p3;
  const acertosNow = p3.state === 'completa' && p3.value !== null ? acertosFor(p3.value) : null;

  return (
    <div class="calc-page">
      <section class="card glass">
        <div class="calc-sel">
          <label class="lbl">
            Matéria
            <select aria-label="Matéria" value={subject ? subject.id : 'livre'} onChange={(e) => {
              const v = e.currentTarget.value;
              go(v === 'livre' ? null : v, prova);
            }}>
              <option value="livre">Cálculo livre</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </label>
          <label class="lbl">
            Prova
            <select aria-label="Prova" value={p} onChange={(e) => go(subject?.id ?? null, e.currentTarget.value as Key)}>
              {keys.map((k) => <option key={k} value={k}>{subject ? labelFor(kind, k) : k.toUpperCase()}</option>)}
            </select>
          </label>
        </div>

        {simulado ? (
          <div class="part sim-in">
            <span class="dim">Acertos (0–60)</span>
            <NumInput
              value={acertosNow} label="Acertos no simulado" nullable placeholder="—"
              accept={(n) => Number.isInteger(n) && n >= 0 && n <= 60}
              onCommit={(n) => setGradeSlot(subject!.id, 'p3', n === null ? emptySlot() : { state: 'completa', value: notaFromAcertos(n) })}
            />
            {acertosNow !== null && <span class="dim">= nota <b>{formatNum(notaFromAcertos(acertosNow))}</b></span>}
          </div>
        ) : (
          <PartsForm c={c} save={save} linked={Boolean(subject)} />
        )}

        <div class={`result inner${sum.valid || simulado ? '' : ' flagged'}`} aria-live="polite">
          {!simulado && (
            <div class="mini">Garantido <b>{formatFloor(sum.garantido)}</b> · pode ganhar <b>{formatFloor(sum.potencial)}</b></div>
          )}
          {outlook && (
            <>
              <Progress atual={outlook.atual} />
              <OutlookTiles g={g} o={outlook} kind={kind} skip={simulado ? undefined : p} lead={partTiles} />
            </>
          )}
        </div>

        {subject && stored !== undefined && !simulado && (
          <button type="button" class="btn unlink" onClick={() => removeComposite(key)}>Desvincular</button>
        )}
      </section>

      <section class="card glass">
        <h3><span class="ttl">Tabela do simulado</span></h3>
        <SimuladoTable highlight={outlook?.simuladoAcertos ?? acertosNow ?? null} />
      </section>
    </div>
  );
}
