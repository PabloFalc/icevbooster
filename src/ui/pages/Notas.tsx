import { useEffect, useState } from 'preact/hooks';
import { capacity, gradeOutlook } from '../../domain/grades';
import type { Outlook } from '../../domain/grades';
import { formatBr, formatFloor, formatNeeded, formatNum, parseDecimal, todayIso } from '../../domain/dates';
import { notaFromAcertos } from '../../domain/simulado';
import type { GradeSlot, SlotState, Subject, SubjectGrades } from '../../domain/types';
import { importNotas, setGradeSlot, state } from '../../state/store';
import { Upload } from '../Upload';

type Key = 'p1' | 'p2' | 'p3';
const KEYS: Key[] = ['p1', 'p2', 'p3'];
const LABEL: Record<Key, string> = { p1: 'P1', p2: 'P2', p3: 'P3 · simulado' };
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

function nextState(k: Key, st: SlotState): SlotState {
  if (st === 'completa') return k === 'p3' ? 'nao_feita' : 'incompleta';
  if (st === 'incompleta') return 'nao_feita';
  return 'completa';
}

function Prova({ s, k, slot, linked }: { s: Subject; k: Key; slot: GradeSlot; linked: boolean }) {
  const onValue = (n: number | null) => {
    if (n === null) setGradeSlot(s.id, k, { state: slot.state === 'incompleta' ? 'incompleta' : 'nao_feita', value: null, potencial: slot.potencial });
    else setGradeSlot(s.id, k, { state: slot.state === 'nao_feita' ? 'completa' : slot.state, value: n, potencial: slot.potencial });
  };
  const onTap = () => {
    const st = nextState(k, slot.state);
    setGradeSlot(s.id, k, { state: st, value: st === 'nao_feita' ? null : slot.value, potencial: slot.potencial });
  };
  const low = slot.state === 'completa' && slot.value !== null && slot.value < 7;
  return (
    <div class="pv inner">
      <div class="l">{LABEL[k]}</div>
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
      {slot.state === 'incompleta' && <small class="earn">pode ganhar mais {formatFloor(capacity(slot))}</small>}
    </div>
  );
}

const acertosText = (n: number | null) => (n === null ? '' : ` → ${n} ${n === 1 ? 'acerto' : 'acertos'} (${formatNum(notaFromAcertos(n))})`);

function Need({ g, o }: { g: SubjectGrades; o: Outlook }) {
  if (o.status === 'aprovado') {
    return <div class="need inner">{o.atual >= 21 - 1e-9 ? 'Aprovado: já tem os 21 pontos.' : 'Aprovado: média 7 ou mais.'}</div>;
  }
  if (o.status === 'reprovado') {
    const closed = KEYS.every((k) => capacity(g[k]) === 0);
    return (
      <div class="need inner">
        {closed ? 'Reprovado por nota: média abaixo de 4.' : 'Reprovado por nota: nem com 10 em tudo chega a média 4.'}
      </div>
    );
  }
  const open = KEYS.filter((k) => o.shares[k] !== undefined);
  const lines = open.map((k, i) => {
    const x = <b>{formatNeeded(o.shares[k] as number)}</b>;
    const lead = i === 0 ? (o.status === 'rec' ? '' : 'Tire ') : 'e ';
    if (k === 'p3') return <span key={k}>{lead}{x} no simulado<span class="acc">{acertosText(o.simuladoAcertos)}</span></span>;
    const where = g[k].state === 'incompleta' ? ` no que falta da ${k.toUpperCase()} (de ${formatFloor(capacity(g[k]))})` : ` na ${k.toUpperCase()}`;
    return <span key={k}>{lead}{x}{where}</span>;
  });
  const body = lines.flatMap((l, i) => (i ? [<br key={`b${i}`} />, l] : [l]));
  if (o.status === 'andamento') return <div class="need inner">{body}</div>;
  const max = o.atual + KEYS.reduce((sum, k) => sum + capacity(g[k]), 0);
  return (
    <div class="need inner">
      {open.length > 0 ? (
        <>
          {max < 21 && <>Passar direto não é possível (máx. {formatFloor(max)}).<br /></>}
          Para ir à REC (média ≥ 4): {body}<br />
        </>
      ) : <>Média {formatFloor(o.atual / 3)}: vai para a REC.<br /></>}
      Aí precisaria de <b>{o.recQuestoes}/10</b> questões na REC.
    </div>
  );
}

function SubjectCard({ s }: { s: Subject }) {
  const { grades, composites } = state.value;
  const g: SubjectGrades = grades[s.id] ?? { p1: emptySlot(), p2: emptySlot(), p3: emptySlot() };
  const o = gradeOutlook(g);
  const [badge, cls] = BADGE[o.status];
  const remaining = KEYS.filter((k) => capacity(g[k]) > 0).length;
  const detail: Key = g.p2.state === 'completa' && g.p1.state !== 'completa' ? 'p1' : 'p2';
  return (
    <section class="card glass nota-card">
      <span class={`badge ${cls}`}>{badge}</span>
      <h3>{s.nome}</h3>
      <div class="meta">{s.ch ? `${s.ch}h · ` : ''}meta 21 pontos</div>
      <div class="provas">
        {KEYS.map((k) => <Prova key={k} s={s} k={k} slot={g[k]} linked={k !== 'p3' && `${s.id}:${k}` in composites} />)}
      </div>
      <div class="three">
        <div><b>{formatFloor(o.atual)}</b><span>pontos atuais</span></div>
        <div><b>{formatNeeded(o.restantes)}</b><span>faltam p/ 21</span></div>
        <div><b>{remaining}</b><span>{remaining === 1 ? 'prova restante' : 'provas restantes'}</span></div>
      </div>
      <Need g={g} o={o} />
      <a class="link detail" href={`#/calculadora?m=${s.id}&p=${detail}`}>Detalhar na calculadora ›</a>
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
        <span>{notasPrintDate ? `Notas lidas do print de ${formatBr(notasPrintDate)}` : 'Envie o print de notas do portal'}</span>
        {notasPrintDate && <small>confira e marque se cada nota está completa</small>}
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
      {subjects.map((s) => <SubjectCard key={s.id} s={s} />)}
    </div>
  );
}
