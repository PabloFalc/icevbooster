import { useState } from 'preact/hooks';
import { formatBr, todayIso, weekdayOf } from '../../domain/dates';
import { dayStatus } from '../../domain/dayStatus';
import type { Iso, Subject, Weekday } from '../../domain/types';
import type { CalendarCandidate } from '../../ocr/pdfCalendar';
import { addNoClassDays, plan, setExtraDay, setNoClass, setSimulado, state } from '../../state/store';
import { dayContext, MONTHS, MonthGrid, subjectColor } from '../MonthGrid';
import { Upload } from '../Upload';

const WEEKDAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const SLOT_TIMES = ['18:20', '20:20'];
const WEEKDAY_OPTIONS: [Weekday, string][] = [[1, 'Segunda'], [2, 'Terça'], [3, 'Quarta'], [4, 'Quinta'], [5, 'Sexta']];

const firstOf = (d: Iso): Iso => `${d.slice(0, 7)}-01`;

function shiftMonth(month: Iso, delta: number): Iso {
  const t = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + delta;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-01`;
}

const monthTitle = (month: Iso) => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

const TAG_TEXT = { ok: 'Pode faltar', no: 'Não pode faltar', normal: 'Aula normal' } as const;

// ---------- detail panel ----------

function Detail({ date }: { date: Iso }) {
  const p = plan.value;
  const { subjects, overrides } = state.value;
  const ctx = dayContext();
  const st = dayStatus(date, ctx);
  const byId = new Map(subjects.map((s) => [s.id, s]));
  const name = (id: string) => byId.get(id)?.nome ?? id;
  const extra = overrides.extraDays[date];
  const isWeekend = [0, 6].includes(weekdayOf(date));
  const simuladoOk = typeof p === 'object';

  const rows = st.subjects;
  const ids = [...new Set(rows.map((r) => r.id))];
  const obs: string[] = [];
  if (st.kind === 'holiday' && st.label) obs.push(`${st.label} — sem aula.`);
  if (st.kind === 'simulado') obs.push('Dia do simulado — sem falta.');
  for (const id of ids) {
    const mine = rows.filter((r) => r.id === id);
    const saldo = ctx.saldo[id];
    if (saldo === 0) obs.push(`${name(id)} está sem saldo: qualquer falta reprova.`);
    else if (mine[0].status === 'normal') {
      obs.push(`${name(id)}: vá a esta aula — o saldo é guardado para as últimas aulas antes do simulado.`);
    }
    if (mine.length === 2) obs.push(`${name(id)} tem 2 aulas neste dia: falte o dia todo ou nenhum.`);
  }

  const sub = st.kind === 'holiday' ? (st.label ?? 'Sem aula')
    : st.kind === 'simulado' ? 'Dia do simulado'
    : st.kind === 'weekend' ? 'Fim de semana'
    : st.kind === 'after' ? 'Depois do simulado'
    : rows.length === 0 ? 'Sem aulas neste dia'
    : `${rows.length} ${rows.length === 1 ? 'aula' : 'aulas'} neste dia`;

  return (
    <section class="card glass detail" aria-label="Detalhes do dia">
      <div class="date">{WEEKDAY_NAMES[weekdayOf(date)]}, {formatBr(date)}</div>
      <div class="sub">{sub}{extra ? ` · dia extra, segue a ${WEEKDAY_NAMES[extra].toLowerCase()}` : ''}</div>
      {rows.length > 0 && (
        <ul class="rows">
          {rows.map((r) => (
            <li key={r.slot}>
              <span>{name(r.id)} · {SLOT_TIMES[r.slot]}</span>
              <span class={`tag ${r.status === 'normal' ? 'nn' : r.status}`}>{TAG_TEXT[r.status]}</span>
            </li>
          ))}
        </ul>
      )}
      {ids.length > 0 && (
        <>
          <h4>Saldo das matérias do dia</h4>
          <div class="stat">
            {ids.map((id) => (
              <div key={id}>
                <b class={ctx.saldo[id] === 0 ? 'bad' : undefined}>{ctx.saldo[id]}</b>
                <span>{ctx.saldo[id] === 1 ? 'aula' : 'aulas'} · {name(id)}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {obs.length > 0 && (
        <>
          <h4>Observações</h4>
          <div class="obs">{obs.map((o) => <p key={o}>{o}</p>)}</div>
        </>
      )}
      {!simuladoOk && <p class="obs">Informe a data do simulado na aba Faltas para ver quais dias você pode faltar.</p>}
      <div class="actions">
        {st.kind === 'holiday' && (
          <button type="button" class="btn" onClick={() => setNoClass(date, false)}>Tem aula neste dia</button>
        )}
        {st.kind !== 'holiday' && (!isWeekend || extra !== undefined) && (
          <button type="button" class="btn" onClick={() => setNoClass(date, true)}>Marcar sem aula</button>
        )}
        {(isWeekend || extra !== undefined) && st.kind !== 'holiday' && (
          <label class="field">
            <span>Dia extra de aula, segue o horário de</span>
            <select
              aria-label="Dia extra segue o horário de" value={extra === undefined ? '' : String(extra)}
              onChange={(e) => setExtraDay(date, e.currentTarget.value === '' ? null : (Number(e.currentTarget.value) as Weekday))}
            >
              <option value="">Não é dia extra</option>
              {WEEKDAY_OPTIONS.map(([wd, label]) => <option key={wd} value={wd}>{label}</option>)}
            </select>
          </label>
        )}
      </div>
    </section>
  );
}

// ---------- PDF import ----------

interface Pending { items: CalendarCandidate[]; simulados: Iso[] }

/** One row per date, sem_aula preferred over outro; simulado dates are offered separately. */
function toPending(cands: CalendarCandidate[]): Pending {
  const byDate = new Map<Iso, CalendarCandidate>();
  for (const c of cands) {
    if (c.kind === 'simulado') continue;
    const cur = byDate.get(c.date);
    if (!cur || (cur.kind !== 'sem_aula' && c.kind === 'sem_aula')) byDate.set(c.date, c);
  }
  const items = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const simulados = [...new Set(cands.filter((c) => c.kind === 'simulado').map((c) => c.date))].sort();
  return { items, simulados };
}

function PdfImport() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [checked, setChecked] = useState<Set<Iso>>(new Set());

  async function onPdf(f: File) {
    const { pdfToText, extractCalendarCandidates } = await import('../../ocr/pdfCalendar');
    const text = await pdfToText(f);
    const next = toPending(extractCalendarCandidates(text, Number(todayIso().slice(0, 4))));
    if (next.items.length === 0 && next.simulados.length === 0) throw new Error('nenhuma data');
    setPending(next);
    setChecked(new Set(next.items.filter((c) => c.kind === 'sem_aula').map((c) => c.date)));
  }

  function toggle(d: Iso) {
    const n = new Set(checked);
    if (n.has(d)) n.delete(d); else n.add(d);
    setChecked(n);
  }

  function confirm() {
    if (!pending) return;
    addNoClassDays(Object.fromEntries(
      pending.items.filter((c) => checked.has(c.date)).map((c) => [c.date, c.label.slice(0, 60)]),
    ));
    setPending(null);
  }

  return (
    <section class="card glass prints">
      <h3>Calendário acadêmico (PDF)</h3>
      <Upload
        label="Enviar PDF do calendário" accept="application/pdf" onFile={onPdf}
        hint="O PDF é lido aqui no navegador. Você confirma cada data antes de importar."
        errorText="Não consegui ler esse PDF. Marque os dias sem aula manualmente."
      />
      {pending && (
        <div class="pdf-confirm">
          {pending.simulados.map((d) => (
            <button key={d} type="button" class="btn" onClick={() => setSimulado(d)}>Usar {formatBr(d)} como data do simulado</button>
          ))}
          {pending.items.length > 0 && (
            <>
              <p class="sub">Marque os dias sem aula para importar:</p>
              <ul class="cands">
                {pending.items.map((c) => (
                  <li key={c.date}>
                    <label>
                      <input type="checkbox" checked={checked.has(c.date)} onChange={() => toggle(c.date)} />
                      <span><b>{formatBr(c.date)}</b> {c.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <button type="button" class="btn primary" onClick={confirm}>Importar dias marcados</button>
            </>
          )}
          <button type="button" class="link-btn" onClick={() => setPending(null)}>Fechar</button>
        </div>
      )}
    </section>
  );
}

// ---------- page ----------

export function Calendario() {
  const today = todayIso();
  const [month, setMonth] = useState<Iso>(firstOf(today));
  const [selected, setSelected] = useState<Iso>(today);
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const { subjects, schedule } = state.value;

  const scheduled = new Set(Object.values(schedule).flat().filter((x): x is string => x !== null));
  const chips: Subject[] = subjects.filter((s) => scheduled.has(s.id));
  const active = filter !== undefined && chips.some((c) => c.id === filter) ? filter : undefined;

  return (
    <div class="cal-page">
      <section class="card glass">
        <h3>
          Calendário de faltas
          <div class="seg" role="group" aria-label="Filtrar por matéria">
            <button type="button" class={active === undefined ? 'on' : ''} aria-pressed={active === undefined} onClick={() => setFilter(undefined)}>Todas</button>
            {chips.map((c) => (
              <button key={c.id} type="button" class={active === c.id ? 'on' : ''} aria-pressed={active === c.id} onClick={() => setFilter(c.id)}>
                <i class="swatch" style={{ background: subjectColor(c.id) }} />{c.nome}
              </button>
            ))}
          </div>
        </h3>
        <div class="mnav">
          <div class="m" aria-live="polite">{monthTitle(month)}</div>
          <div class="arrows">
            <button type="button" aria-label="Mês anterior" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
            <button type="button" class="hoje" onClick={() => { setMonth(firstOf(today)); setSelected(today); }}>Hoje</button>
            <button type="button" aria-label="Próximo mês" onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
          </div>
        </div>
        <MonthGrid month={month} filter={active} selected={selected} onSelect={setSelected} />
        <div class="legend">
          <span><i class="lg-ok" />Pode faltar</span>
          <span><i class="lg-no" />Não pode faltar (sem saldo)</span>
          <span><i class="lg-n" />Aula normal</span>
          <span><i class="lg-hol" />Feriado / recesso</span>
          <span><i class="lg-sim" />Simulado</span>
        </div>
      </section>
      <div class="col">
        <Detail date={selected} />
        <PdfImport />
      </div>
    </div>
  );
}
