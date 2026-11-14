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

/** All dates of the month containing `month` ('YYYY-MM-DD'). */
function monthDays(month: Iso): Iso[] {
  const first = `${month.slice(0, 7)}-01`;
  const days: Iso[] = [];
  for (let d = first; d.slice(0, 7) === first.slice(0, 7); d = addDays(d, 1)) days.push(d);
  return days;
}

/**
 * Month calendar colored by `dayStatus`. Compact mode (Faltas tab) shows colors and day numbers only.
 * The full mode (labels, dots, selection) is built in the Calendário task; `filter`, `selected`
 * and `onSelect` are part of the API for it.
 */
export function MonthGrid({ month, compact = false, filter, selected, onSelect }: {
  month: Iso; compact?: boolean; filter?: string; selected?: Iso; onSelect?(d: Iso): void;
}) {
  const p = plan.value;
  const s = state.value;
  const ok = typeof p === 'object';
  const ctx = {
    plan: ok ? p : NO_PLAN,
    schedule: s.schedule, ov: s.overrides,
    // Without a valid plan only weekends and holidays are colored.
    simulado: ok && s.simulado ? s.simulado : '9999-12-31',
    filter,
    saldo: ok ? Object.fromEntries(p.subjects.map((x) => [x.subjectId, x.saldoAulas])) : {},
  };
  const today = todayIso();
  const days = monthDays(month);
  const lead = weekdayOf(days[0]);

  return (
    <div class={`grid${compact ? ' compact' : ''}`}>
      {DOW_SHORT.map((d, i) => <div key={`h${i}`} class="dow" aria-hidden="true">{d}</div>)}
      {Array.from({ length: lead }, (_, i) => <div key={`e${i}`} class="d empty" />)}
      {days.map((d) => {
        const st = dayStatus(d, ctx);
        const cls = `d ${CLASS[st.kind]}${d === today ? ' today' : ''}${d === selected ? ' sel' : ''}`;
        const n = Number(d.slice(8));
        const content = st.kind === 'holiday' ? <b>{n}</b> : n;
        return onSelect
          ? <button key={d} type="button" class={cls} onClick={() => onSelect(d)}>{content}</button>
          : <div key={d} class={cls}>{content}</div>;
      })}
    </div>
  );
}
