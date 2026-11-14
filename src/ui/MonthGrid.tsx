import { addDays, todayIso, weekdayOf } from '../domain/dates';
import { dayStatus, type DayKind } from '../domain/dayStatus';
import type { OverallPlan } from '../domain/maxPlan';
import type { Iso } from '../domain/types';
import { plan, state } from '../state/store';

export const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DOW_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const CLASS: Record<DayKind, string> = {
  weekend: 'wk', holiday: 'hol', simulado: 'sim', after: 'after', none: 'n', normal: 'n', ok: 'ok', no: 'no',
};

const NO_PLAN: OverallPlan = { subjects: [], skipAllFrom: null, exceptions: [] };

const DOW_FULL = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const PALETTE = ['#f59e0b', '#60a5fa', '#a78bfa', '#34d399', '#f472b6', '#facc15', '#fb923c', '#2dd4bf', '#f87171'];

/** Stable dot color per subject: its position in the subject list picks from a fixed palette. */
export function subjectColor(id: string): string {
  const i = state.value.subjects.findIndex((x) => x.id === id);
  return PALETTE[(i < 0 ? 0 : i) % PALETTE.length];
}

/** `dayStatus` context built from the store (shared by the grid and the detail panel). */
export function dayContext(filter?: string) {
  const p = plan.value;
  const s = state.value;
  const ok = typeof p === 'object';
  return {
    plan: ok ? p : NO_PLAN,
    schedule: s.schedule, ov: s.overrides,
    // Without a valid plan only weekends and holidays are colored.
    simulado: ok && s.simulado ? s.simulado : '9999-12-31',
    filter,
    saldo: ok ? Object.fromEntries(p.subjects.map((x) => [x.subjectId, x.saldoAulas])) : {},
  };
}

const KIND_TEXT: Record<DayKind, string> = {
  weekend: 'fim de semana', holiday: 'feriado', simulado: 'dia do simulado', after: 'depois do simulado',
  none: 'sem aulas', normal: 'aula normal', ok: 'pode faltar', no: 'não pode faltar',
};

/** All dates of the month containing `month` ('YYYY-MM-DD'). */
function monthDays(month: Iso): Iso[] {
  const first = `${month.slice(0, 7)}-01`;
  const days: Iso[] = [];
  for (let d = first; d.slice(0, 7) === first.slice(0, 7); d = addDays(d, 1)) days.push(d);
  return days;
}

/**
 * Month calendar colored by `dayStatus`. Compact mode (Faltas tab) shows colors and day numbers only;
 * the full mode adds labels, subject dots and accessible names, and selection when `onSelect` is given.
 */
export function MonthGrid({ month, compact = false, filter, selected, onSelect }: {
  month: Iso; compact?: boolean; filter?: string; selected?: Iso; onSelect?(d: Iso): void;
}) {
  const ctx = dayContext(filter);
  const names = new Map(state.value.subjects.map((x) => [x.id, x.nome]));
  const today = todayIso();
  const days = monthDays(month);
  const lead = weekdayOf(days[0]);

  return (
    <div class={`grid${compact ? ' compact' : ' full'}`}>
      {(compact ? DOW_SHORT : DOW_FULL).map((d, i) => <div key={`h${i}`} class="dow" aria-hidden="true">{d}</div>)}
      {Array.from({ length: lead }, (_, i) => <div key={`e${i}`} class="d empty" />)}
      {days.map((d) => {
        const st = dayStatus(d, ctx);
        const cls = `d ${CLASS[st.kind]}${d === today ? ' today' : ''}${d === selected ? ' sel' : ''}`;
        const n = Number(d.slice(8));
        if (compact) {
          const content = st.kind === 'holiday' ? <b>{n}</b> : n;
          return onSelect
            ? <button key={d} type="button" class={cls} onClick={() => onSelect(d)}>{content}</button>
            : <div key={d} class={cls}>{content}</div>;
        }
        const ids = [...new Set(st.subjects.map((x) => x.id))];
        const flagged = st.subjects.find((x) => x.status === 'no') ?? st.subjects[0];
        const small = st.kind === 'holiday' ? st.label
          : st.kind === 'simulado' ? 'Simulado'
          : (st.kind === 'ok' || st.kind === 'no') && flagged ? names.get(flagged.id) : undefined;
        const aria = `${n} de ${MONTHS[Number(d.slice(5, 7)) - 1].toLowerCase()}, ${KIND_TEXT[st.kind]}${st.kind === 'holiday' && st.label ? `: ${st.label}` : ''}${d === today ? ', hoje' : ''}`;
        const body = (
          <>
            <b>{n}</b>
            {small && <small>{small}</small>}
            {st.kind === 'normal' && ids.length > 0 && (
              <span class="dots" aria-hidden="true">{ids.map((id) => <i key={id} style={{ background: subjectColor(id) }} />)}</span>
            )}
          </>
        );
        const title = st.kind === 'holiday' ? st.label : undefined;
        return onSelect
          ? <button key={d} type="button" class={cls} title={title} aria-label={aria} aria-pressed={d === selected} onClick={() => onSelect(d)}>{body}</button>
          : <div key={d} class={cls} title={title} aria-label={aria}>{body}</div>;
      })}
    </div>
  );
}
