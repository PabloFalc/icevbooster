import { useEffect, useState } from 'preact/hooks';
import { percentualUsado, saldoAulas, saldoFaltas } from '../../domain/absences';
import { classDays } from '../../domain/calendar';
import { formatBr, formatNum, parseDecimal, todayIso } from '../../domain/dates';
import type { SubjectPlan } from '../../domain/maxPlan';
import type { Schedule, Subject, Weekday } from '../../domain/types';
import {
  importFaltas, importHistorico, importHorario, plan, setFaltasPrintDate, setSchedule, setSimulado, state, updateSubject,
} from '../../state/store';
import { MONTHS, MonthGrid } from '../MonthGrid';
import { Upload } from '../Upload';

const WEEKDAYS: [Weekday, string][] = [[1, 'Seg'], [2, 'Ter'], [3, 'Qua'], [4, 'Qui'], [5, 'Sex']];
const SLOTS = ['18:20', '20:20'];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const fmtInput = (v: number | null) => (v === null ? '' : String(v).replace('.', ','));

/** Display only: rounded to one decimal like the portal (4/36 → 11,1%); whole numbers without decimals. */
function fmtPct(p: number): string {
  const r = Math.round(p * 10) / 10;
  return `${Number.isInteger(r) ? String(r) : formatNum(r, 1)}%`;
}

const scheduledIds = (s: Schedule) => new Set(Object.values(s).flat().filter((x): x is string => x !== null));

// ---------- inputs ----------

/** Text input for a number: commits on blur/Enter; comma decimals accepted; invalid text reverts. */
function NumInput({ value, label, accept, onCommit }: {
  value: number | null; label: string; accept(n: number): boolean; onCommit(n: number): void;
}) {
  const [text, setText] = useState(fmtInput(value));
  useEffect(() => setText(fmtInput(value)), [value]);
  const commit = () => {
    const n = parseDecimal(text);
    if (n !== null && accept(n)) {
      onCommit(n);
      setText(fmtInput(n));
    } else setText(fmtInput(value));
  };
  return (
    <input
      class="num" type="text" inputMode="decimal" aria-label={label} value={text}
      onInput={(e) => setText(e.currentTarget.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    />
  );
}

function ChCell({ s }: { s: Subject }) {
  const standard = s.ch === null || s.ch === 36 || s.ch === 72;
  const [other, setOther] = useState(!standard);
  useEffect(() => { if (!standard) setOther(true); }, [standard]);
  const value = other ? 'outra' : s.ch === null ? '' : String(s.ch);
  const onChange = (v: string) => {
    if (v === 'outra') { setOther(true); return; }
    setOther(false);
    if (v === '36' || v === '72') updateSubject(s.id, { ch: Number(v), chSource: 'manual' });
  };
  return (
    <div class="ch">
      <select aria-label={`Carga horária de ${s.nome}`} value={value} onChange={(e) => onChange(e.currentTarget.value)}>
        {s.ch === null && !other && <option value="">—</option>}
        <option value="36">36h</option>
        <option value="72">72h</option>
        <option value="outra">outra</option>
      </select>
      {other && (
        <NumInput
          value={standard ? null : s.ch} label={`Outra carga horária de ${s.nome}`} accept={(n) => n > 0}
          onCommit={(n) => updateSubject(s.id, { ch: n, chSource: 'manual' })}
        />
      )}
      {s.ch === null && !other && <small class="hint">Escolha a carga horária</small>}
    </div>
  );
}

// ---------- hero ----------

function exceptionText(s: Subject, p: SubjectPlan, simulado: string): string {
  if (p.saldoAulas === 0) return `${s.nome} (sem saldo)`;
  const st = state.value;
  if (classDays(s.id, todayIso(), simulado, st.schedule, st.overrides).length === 0) return `${s.nome} (sem aulas até o simulado)`;
  return `${s.nome} (saldo não cobre o último dia de aula)`;
}

/** Why a subject is left out of the plan; null when it is planned. */
function excludedReason(s: Subject, planned: Set<string>, scheduled: Set<string>): string | null {
  if (planned.has(s.id)) return null;
  if (s.conferir) return 'confira as faltas';
  if (s.ch === null) return 'sem carga horária';
  if (!scheduled.has(s.id)) return 'sem horário';
  return null;
}

function Hero() {
  const p = plan.value;
  const { subjects, simulado } = state.value;
  let sub: string | null = null;
  let big: string;
  let except: string | null = null;
  if (p === 'sem_data') big = 'Informe a data do simulado';
  else if (p === 'data_passada') big = 'A data do simulado já passou';
  else if (p.subjects.length === 0) {
    big = subjects.length === 0 ? 'Envie o print de faltas para começar' : 'Preencha a CH e o horário das matérias';
  } else {
    sub = `Simulado em ${formatBr(simulado!)} · aproveitamento máximo`;
    big = p.skipAllFrom ? `Pode faltar tudo a partir de ${formatBr(p.skipAllFrom)}` : 'Não dá para faltar tudo antes do simulado';
    const names = p.exceptions.map((id) => {
      const s = subjects.find((x) => x.id === id)!;
      return exceptionText(s, p.subjects.find((x) => x.subjectId === id)!, simulado!);
    });
    // Subjects the plan can't compute stay visible: never shown as free to skip.
    const planned = new Set(p.subjects.map((x) => x.subjectId));
    const scheduled = scheduledIds(state.value.schedule);
    for (const s of subjects) {
      const why = excludedReason(s, planned, scheduled);
      if (why) names.push(`${s.nome} (${why})`);
    }
    if (names.length) except = `${p.skipAllFrom ? 'exceto ' : ''}${names.join(', ')}`;
  }
  return (
    <section class="card glass hero">
      {sub && <div class="s">{sub}</div>}
      <div class="big">{big}</div>
      {except && <div class="s except">{except}</div>}
    </section>
  );
}

// ---------- table ----------

function stopCell(s: Subject, sp: SubjectPlan | undefined) {
  if (s.conferir) return '—';
  if (sp?.allCovered) return 'já';
  if (sp?.startDate) return formatBr(sp.startDate);
  if (saldoAulas(s) === 0) return <span class="bad">não pode</span>;
  return '—';
}

function Row({ s, sp }: { s: Subject; sp: SubjectPlan | undefined }) {
  const aulas = saldoAulas(s);
  const faltas = saldoFaltas(s);
  const pct = percentualUsado(s);
  return (
    <tr class={s.conferir ? 'conferir' : undefined}>
      <td class="nome">{s.nome}</td>
      <td><ChCell s={s} /></td>
      <td>
        <NumInput value={s.faltas} label={`Faltas de ${s.nome}`} accept={(n) => n >= 0} onCommit={(n) => updateSubject(s.id, { faltas: n })} />
      </td>
      <td>
        <NumInput value={s.pendentes} label={`Pendentes de ${s.nome}`} accept={(n) => n >= 0} onCommit={(n) => updateSubject(s.id, { pendentes: n })} />
      </td>
      <td>{pct === null || s.conferir ? '—' : fmtPct(pct)}</td>
      <td class={aulas === 0 && !s.conferir ? 'bad' : undefined}>
        {aulas === null || faltas === null || s.conferir ? '—' : (
          <>{plural(aulas, 'aula', 'aulas')} <small class="sub">({plural(faltas, 'falta', 'faltas')})</small></>
        )}
      </td>
      <td>
        {stopCell(s, sp)}
        {!s.conferir && sp && sp.folgaAulas > 0 && <small class="folga">+{plural(sp.folgaAulas, 'aula', 'aulas')} de folga</small>}
      </td>
    </tr>
  );
}

function Warnings() {
  const { subjects, schedule } = state.value;
  const scheduled = scheduledIds(schedule);
  const msgs: string[] = subjects.filter((s) => s.conferir).map((s) => `Não consegui ler as faltas de ${s.nome} — confira e digite o valor.`);
  if (subjects.length && scheduled.size === 0) msgs.push('Envie o print do horário ou preencha manualmente.');
  else for (const s of subjects) if (!scheduled.has(s.id)) msgs.push(`${s.nome} não aparece no horário — preencha manualmente.`);
  if (!msgs.length) return null;
  return <ul class="warnings">{msgs.map((m) => <li key={m}>{m}</li>)}</ul>;
}

function SubjectsTable() {
  const p = plan.value;
  const { subjects } = state.value;
  const byId = new Map(typeof p === 'object' ? p.subjects.map((x) => [x.subjectId, x]) : []);
  return (
    <section class="card glass">
      <h3>Faltas por matéria</h3>
      {subjects.length === 0 ? (
        <p class="empty-note">Envie o print de faltas para ver suas matérias aqui.</p>
      ) : (
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Disciplina</th><th>CH</th><th>Faltas</th><th>Pendentes</th><th>%</th><th>Restam</th><th>Parar a partir de</th></tr>
            </thead>
            <tbody>{subjects.map((s) => <Row key={s.id} s={s} sp={byId.get(s.id)} />)}</tbody>
          </table>
        </div>
      )}
      <Warnings />
    </section>
  );
}

// ---------- schedule ----------

function ScheduleGrid() {
  const { subjects, schedule } = state.value;
  const set = (wd: Weekday, slot: 0 | 1, id: string) => {
    const next = { ...schedule, [wd]: [...schedule[wd]] } as Schedule;
    next[wd][slot] = id === '' ? null : id;
    setSchedule(next);
  };
  return (
    <section class="card glass">
      <h3>Horário</h3>
      {subjects.length === 0 && <p class="empty-note">Envie primeiro o print de faltas.</p>}
      <div class="sched">
        <div />
        {SLOTS.map((h) => <div key={h} class="sched-h">{h}</div>)}
        {WEEKDAYS.map(([wd, dia]) => [
          <div key={`d${wd}`} class="sched-d">{dia}</div>,
          ...([0, 1] as const).map((slot) => (
            <select key={`${wd}-${slot}`} aria-label={`${dia} ${SLOTS[slot]}`} value={schedule[wd][slot] ?? ''}
              onChange={(e) => set(wd, slot, e.currentTarget.value)}>
              <option value="">—</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          )),
        ])}
      </div>
    </section>
  );
}

// ---------- page ----------

export function Faltas() {
  const [manual, setManual] = useState(false);
  const { faltasPrintDate, simulado } = state.value;
  const today = todayIso();

  async function onFaltas(f: File) {
    const [{ runOcr }, { parseFaltas }] = await Promise.all([import('../../ocr/ocr'), import('../../ocr/parseFaltas')]);
    const rows = parseFaltas(await runOcr(f));
    if (rows.length === 0) throw new Error('nenhuma linha');
    importFaltas(rows, todayIso());
  }

  async function onHistorico(f: File) {
    const [{ runOcr }, { parseHistorico }] = await Promise.all([import('../../ocr/ocr'), import('../../ocr/parseHistorico')]);
    const rows = parseHistorico(await runOcr(f));
    if (rows.length === 0) throw new Error('nenhuma linha');
    importHistorico(rows);
  }

  async function onHorario(f: File) {
    const [{ runOcr, HORARIO_OCR }, { parseHorario }] = await Promise.all([import('../../ocr/ocr'), import('../../ocr/parseHorario')]);
    const { cells, ok } = parseHorario(await runOcr(f, HORARIO_OCR));
    if (cells.length) importHorario(cells);
    const scheduled = scheduledIds(state.value.schedule);
    if (!ok || state.value.subjects.some((s) => !scheduled.has(s.id))) setManual(true);
    if (cells.length === 0) throw new Error('nenhuma aula');
  }

  return (
    <div class="faltas-page">
      <Hero />
      <div class="col main-col">
        <SubjectsTable />
        {manual && <ScheduleGrid />}
      </div>
      <div class="col side-col">
        <section class="card glass prints">
          <h3>Prints e datas</h3>
          <Upload label="Print de faltas (obrigatório)" accept="image/*" onFile={onFaltas} />
          {faltasPrintDate && (
            <label class="field">
              <span>Data do print de faltas</span>
              <input type="date" aria-label="Data do print de faltas" value={faltasPrintDate}
                onChange={(e) => setFaltasPrintDate(e.currentTarget.value)} />
            </label>
          )}
          {faltasPrintDate && faltasPrintDate !== today && <p class="warn">Confira se o portal já lançou todas as faltas.</p>}
          <Upload label="Print do histórico (opcional)" accept="image/*" onFile={onHistorico} />
          <Upload label="Print do horário" accept="image/*" onFile={onHorario} />
          <button type="button" class="link-btn" onClick={() => setManual(true)}>Preencher manualmente</button>
          <label class="field">
            <span>Data do simulado</span>
            <input type="date" aria-label="Data do simulado" value={simulado ?? ''}
              onChange={(e) => setSimulado(e.currentTarget.value || null)} />
          </label>
        </section>
        <section class="card glass mini">
          <h3>{MONTHS[Number(today.slice(5, 7)) - 1]} <a class="link" href="#/calendario">Abrir calendário ›</a></h3>
          <MonthGrid month={today} compact />
        </section>
      </div>
    </div>
  );
}
