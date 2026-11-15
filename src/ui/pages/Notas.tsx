import { useEffect, useState } from 'preact/hooks';
import { capacity, gradeOutlook, gradingKind } from '../../domain/grades';
import type { GradingKind, Outlook } from '../../domain/grades';
import { formatBrFull, formatFloor, formatNeeded, formatNum, parseDecimal, todayIso } from '../../domain/dates';
import { notaFromAcertos } from '../../domain/simulado';
import type { GradeSlot, SlotState, Subject, SubjectGrades } from '../../domain/types';
import { importNotas, setGradeSlot, state } from '../../state/store';
import { Upload } from '../Upload';
import { Info } from '../Info';
import { keysFor, labelFor, OutlookTiles, Progress } from '../GradeTiles';
import type { Key } from '../GradeTiles';

const STATE_TEXT: Record<SlotState, string> = { completa: 'completa', incompleta: 'incompleta', nao_feita: 'não feita' };
const STATE_CLASS: Record<SlotState, string> = { completa: 'c', incompleta: 'i', nao_feita: 'n' };
const BADGE: Record<Outlook['status'], [string, string]> = {
  aprovado: ['aprovado', 'ok'], andamento: ['em andamento', 'warn'], rec: ['só com REC', 'bad'], reprovado: ['reprovado', 'bad'],
};

const emptySlot = (): GradeSlot => ({ state: 'nao_feita', value: null });
const fmtInput = (v: number | null) => (v === null ? '' : String(v).replace('.', ','));

/** Text input for a slot value: commits on blur/Enter; comma decimals; empty clears; garbage reverts. */
function GradeInput({ value, label, readOnly, onCommit }: {
  value: number | null; label: string; readOnly: boolean; onCommit(n: number | null): void;
}) {
  const [text, setText] = useState(fmtInput(value));
  useEffect(() => setText(fmtInput(value)), [value]);
  const commit = () => {
    if (readOnly) return;
    if (text.trim() === '') { onCommit(null); return; }
    const n = parseDecimal(text);
    if (n !== null) onCommit(n);
    else setText(fmtInput(value));
  };
  return (
    <input
      class="num grade-input" type="text" inputMode="decimal" aria-label={label} value={text} readOnly={readOnly}
      placeholder="—"
      onInput={(e) => setText(e.currentTarget.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    />
  );
}

/** The simulado is all-or-nothing (no incompleta); every other grade cycles through all three states. */
function nextState(simulado: boolean, st: SlotState): SlotState {
  if (st === 'completa') return simulado ? 'nao_feita' : 'incompleta';
  if (st === 'incompleta') return 'nao_feita';
  return 'completa';
}

function Prova({ s, k, kind, slot, linked }: { s: Subject; k: Key; kind: GradingKind; slot: GradeSlot; linked: boolean }) {
  const onValue = (n: number | null) => {
    if (n === null) setGradeSlot(s.id, k, { state: slot.state === 'incompleta' ? 'incompleta' : 'nao_feita', value: null, potencial: slot.potencial });
    else setGradeSlot(s.id, k, { state: slot.state === 'nao_feita' ? 'completa' : slot.state, value: n, potencial: slot.potencial });
  };
  const onTap = () => {
    const st = nextState(k === 'p3' && kind === 'normal', slot.state);
    setGradeSlot(s.id, k, { state: st, value: st === 'nao_feita' ? null : slot.value, potencial: slot.potencial });
  };
  const low = slot.state === 'completa' && slot.value !== null && slot.value < 7;
  return (
    <div class="pv inner">
      <div class="l">{labelFor(kind, k)}</div>
      <div class={`v${low ? ' low' : ''}`}>
        <GradeInput value={slot.value} label={`${k.toUpperCase()} de ${s.nome}`} readOnly={linked} onCommit={onValue} />
      </div>
      {linked ? (
        <a class="st link-st" href={`#/calculadora?m=${s.id}&p=${k}`}>via calculadora</a>
      ) : (
        <button type="button" class={`st ${STATE_CLASS[slot.state]}`} aria-label={`Estado da ${k.toUpperCase()} de ${s.nome}`} onClick={onTap}>
          {STATE_TEXT[slot.state]}
        </button>
      )}
      {slot.state === 'incompleta' && <small class="earn" title="ainda pode ganhar">+{formatFloor(capacity(slot))}</small>}
    </div>
  );
}

function SubjectCard({ s }: { s: Subject }) {
  const { grades, composites } = state.value;
  const g: SubjectGrades = grades[s.id] ?? { p1: emptySlot(), p2: emptySlot(), p3: emptySlot() };
  const kind = gradingKind(s.nome);
  const o = gradeOutlook(g, kind);
  const [badge, cls] = BADGE[o.status];
  const detail: Key = kind === 'normal' && g.p2.state === 'completa' && g.p1.state !== 'completa' ? 'p1' : (kind === 'extensao' ? 'p1' : 'p2');
  return (
    <section class="card glass nota-card">
      <div class="nota-hd">
        <h3 title={s.nome}>{s.nome}</h3>
        <span class={`badge ${cls}`}>{badge}</span>
      </div>
      <div class={`provas${kind === 'extensao' ? ' two' : ''}`}>
        {keysFor(kind).map((k) => (
          <Prova key={k} s={s} k={k} kind={kind} slot={g[k]} linked={`${s.id}:${k}` in composites} />
        ))}
      </div>
      <Progress atual={o.atual} />
      <OutlookTiles g={g} o={o} kind={kind} />
      <a class="link detail" href={`#/calculadora?m=${s.id}&p=${detail}`}>Calculadora ›</a>
    </section>
  );
}

export function Notas() {
  const { subjects, notasPrintDate } = state.value;

  async function onNotas(f: File) {
    const [{ runOcr }, { parseNotas }] = await Promise.all([import('../../ocr/ocr'), import('../../ocr/parseNotas')]);
    const rows = parseNotas(await runOcr(f));
    if (rows.length === 0) throw new Error('nenhuma linha');
    importNotas(rows, todayIso());
  }

  return (
    <div class="notas-page">
      <section class="card glass upl">
        <span class="upl-t">
          {notasPrintDate ? <>Print de <b>{formatBrFull(notasPrintDate)}</b></> : 'Envie o print de notas do portal'}
          {notasPrintDate && <Info text="Toque no selo de cada nota para marcar completa, incompleta ou não feita." />}
        </span>
        <Upload
          label={notasPrintDate ? 'Enviar novo print de notas' : 'Enviar print de notas'} accept="image/*" onFile={onNotas}
          hint="Tire o print com a tabela de notas completa visível."
        />
      </section>
      {subjects.length === 0 && (
        <section class="card glass">
          <p class="empty-note">Envie o print de notas do portal (ou o print de faltas) para ver suas matérias aqui.</p>
        </section>
      )}
      <div class="nota-grid">{subjects.map((s) => <SubjectCard key={s.id} s={s} />)}</div>
    </div>
  );
}
