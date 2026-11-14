# icevbooster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A free static web app where ICEV students upload portal screenshots and see how many classes they can still miss (with a "maximum use" skip plan and a calendar) and what grades they need to pass, plus a grade calculator.

**Architecture:** Pure TypeScript domain modules (absences, skip plan, calendar, grades, simulado table) with unit tests carry all the rules. OCR (Tesseract.js) and PDF text (pdf.js) run in the browser and feed parsers that turn word boxes into editable rows. A Preact UI with signals persisted to `localStorage` renders four tabs (Faltas, Calendário, Notas, Calculadora) in a liquid-glass theme, deployed as a static site on Vercel.

**Tech Stack:** Vite 6, TypeScript 5 (strict), Preact 10 + `@preact/signals`, Vitest 3 + `@testing-library/preact` + jsdom, `tesseract.js` 6 (lang `por`), `pdfjs-dist` 4, Vercel (static, no functions).

**Spec:** `docs/superpowers/specs/2026-11-14-icevbooster-design.md` — read it before any task.

## Global Constraints

- No backend, no paid API, no serverless functions; nothing the student uploads or types leaves the browser.
- All persisted data lives in `localStorage` under key `icevbooster:v1`; a "Apagar meus dados" button clears it.
- UI copy is Brazilian Portuguese. Dates shown as `DD/MM`; numbers with comma decimals (`7,15`).
- Do not use the ICEV logo. Footer text: `Ferramenta não oficial — confira sempre no portal do ICEV.`
- Colors: magenta `#C8215D`, purple `#45226B`, night `#1E1230`; glass is neutral white translucent (`backdrop-filter: blur(22px) saturate(170%)`), never tinted. Light and dark themes; follow `prefers-color-scheme` by default, toggle ☾/☀ overrides and persists.
- Navigation: Faltas · Calendário · Notas · Calculadora. Desktop: floating glass pill at top. Mobile (< 768px): iOS-style glass tab bar fixed at bottom with icon + label.
- Each class lasts 1h40 and counts **2 faltas**. Limit = 25% of CH; **only above 25% fails** (exactly 25% passes).
- Conservative rounding everywhere: never round in the student's favor.
- Simulado grade comes **only** from the hard-coded table (Task 2), never a formula.
- Approved mockups for look and layout: `.superpowers/brainstorm/1302-1794685265/content/calendar-v2.html` and `notas-v1.html`.
- Commit after each task. The repo has no commits yet; Task 1 makes the first.

## Review Focus

1. **Simulado date missing, in the past, or before today** → skip plan shows "Informe a data do simulado" / "A data do simulado já passou" instead of crashing or showing nonsense dates. Tested in Task 5.
2. **Subject whose saldo is smaller than its last class day** (e.g. Gestão with 2 classes on Thursday and saldo 1 aula) → excluded from "pode faltar tudo" as an exception, never a half day. Tested in Task 5.
3. **OCR misreads a percentage or number** (`1111%`, `11,11%`, `O` for `0`) → parser tolerates comma/dot and O→0; an inferred CH that isn't close to 36 or 72 comes back `null` so the student is asked. Tested in Tasks 4 and 9.
4. **Already-passed or impossible grades** (sum ≥ 21 before the simulado; typed value > 10) → status "aprovado", no negative shares; inputs clamp to 0–10. Tested in Task 6.
5. **Similar subject names with different numerals** ("Eletiva VI" vs "Eletiva II") → never auto-matched. Tested in Task 8.

---

## File Structure

```
index.html  vite.config.ts  tsconfig.json  package.json  vercel.json
scripts/ocr-fixtures.ts            # node script: OCR examples/ → tests/fixtures/*.json
tests/fixtures/                    # OCR word-box fixtures (committed)
src/
  main.tsx  app.tsx  router.ts
  domain/
    types.ts         # shared types (below)
    dates.ts         # ISO date helpers
    simulado.ts      # table, notaFromAcertos, acertosFor
    holidays.ts      # easter, holidaysFor
    calendar.ts      # classDays
    absences.ts      # limit, saldo, inferCh, resolveCh
    maxPlan.ts       # planSubject, planAll
    dayStatus.ts     # dayStatus
    grades.ts        # splitEqual, gradeOutlook
    composite.ts     # compositeSummary, compositeNeeds, compositeToSlot
    nameMatch.ts     # normalizeName, namesMatch, matchSubjects
  ocr/
    ocr.ts           # browser OCR wrapper → OcrWord[]
    rows.ts          # groupRows, columnOf
    parseFaltas.ts  parseHistorico.ts  parseNotas.ts  parseHorario.ts
    pdfCalendar.ts   # pdf text → CalendarCandidate[]
  state/store.ts     # signals + persistence + derived values
  ui/
    theme.css
    Nav.tsx  ThemeToggle.tsx  Upload.tsx  MonthGrid.tsx  SimuladoTable.tsx  Footer.tsx
    pages/Faltas.tsx  pages/Calendario.tsx  pages/Notas.tsx  pages/Calculadora.tsx
```
Tests live next to sources as `*.test.ts(x)`.

### Shared types (`src/domain/types.ts`, created in Task 1, extended by later tasks only where noted)

```ts
export type Iso = string;                       // 'YYYY-MM-DD'
export type Weekday = 1 | 2 | 3 | 4 | 5;        // seg..sex
export type ChSource = 'historico' | 'percentual' | 'fixo' | 'manual';
export interface Subject {
  id: string; nome: string; turma?: string;
  faltas: number;            // TOTAL FALTAS from the faltas print (hours; blank → 0)
  pendentes: number;         // faltas not yet posted, typed by the student (default 0)
  percentual: number | null; // e.g. 11.11
  ch: number | null; chSource: ChSource | null;
}
export type Schedule = Record<Weekday, [string | null, string | null]>; // [18:20 slot, 20:20 slot] → subject id
export interface CalendarOverrides {
  noClass: Record<Iso, string>;       // extra no-class days (PDF/manual) → label
  removedHolidays: Iso[];             // auto holidays that DO have class
  extraDays: Record<Iso, Weekday>;    // make-up day → weekday whose schedule it follows
}
export interface ClassDay { date: Iso; aulas: 1 | 2 }
export type SlotState = 'completa' | 'incompleta' | 'nao_feita';
export interface GradeSlot { state: SlotState; value: number | null; potencial?: number }
export interface SubjectGrades { p1: GradeSlot; p2: GradeSlot; p3: GradeSlot }  // p3 = simulado; uses completa|nao_feita only
export interface OcrWord { text: string; x0: number; y0: number; x1: number; y1: number }
```

---

### Task 1: Scaffold, theme, navigation shell

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `vercel.json`, `src/main.tsx`, `src/app.tsx`, `src/router.ts`, `src/domain/types.ts`, `src/domain/dates.ts`, `src/ui/theme.css`, `src/ui/Nav.tsx`, `src/ui/ThemeToggle.tsx`, `src/ui/Footer.tsx`
- Test: `src/router.test.ts`, `src/domain/dates.test.ts`

**Interfaces:**
- Produces: `type Route = 'faltas'|'calendario'|'notas'|'calculadora'`; `routeFromHash(hash: string): Route` (default `'faltas'`); `addDays(d: Iso, n: number): Iso`; `weekdayOf(d: Iso): 0..6` (0 = domingo, local-time-safe: parse as UTC); `todayIso(): Iso`; `formatBr(d: Iso): string` → `'DD/MM'`; `formatNum(n: number, decimals = 2): string` → `'7,15'`; all shared types above.

- [ ] **Step 1:** `npm create vite@latest . -- --template preact-ts`, then `npm i @preact/signals tesseract.js pdfjs-dist` and `npm i -D vitest jsdom @testing-library/preact tsx`. Add script `"test": "vitest run"`; Vitest `environment: 'jsdom'` in `vite.config.ts`. Add `.superpowers/`, `node_modules/`, `dist/`, `.vercel/` to `.gitignore` (keep `examples`).
- [ ] **Step 2: Write failing tests**

```ts
// router.test.ts
expect(routeFromHash('')).toBe('faltas');
expect(routeFromHash('#/notas')).toBe('notas');
expect(routeFromHash('#/xyz')).toBe('faltas');
// dates.test.ts
expect(weekdayOf('2026-11-01')).toBe(0);           // domingo
expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
expect(formatBr('2026-12-10')).toBe('10/12');
expect(formatNum(7.15)).toBe('7,15');
```
- [ ] **Step 3:** Run `npm test` → FAIL (modules missing).
- [ ] **Step 4:** Implement `router.ts`, `dates.ts`, `types.ts`. Build the shell: `app.tsx` listens to `hashchange` and renders the page placeholder for the route; `Nav.tsx` renders the 4 tabs as top pill (≥ 768px) and bottom tab bar (< 768px) with inline SVG icons (Faltas: clock, Calendário: calendar, Notas: bar chart, Calculadora: calculator); `ThemeToggle` sets `data-theme` on `<html>` and persists `'light'|'dark'` in `localStorage` key `icevbooster:theme` (absent → follow `prefers-color-scheme`). `theme.css` defines tokens for both themes plus `.glass` exactly as in the mockups (gradient blobs on `body`, `background-attachment: fixed`). `vercel.json`: `{ "framework": "vite", "buildCommand": "npm run build", "outputDirectory": "dist" }`.
- [ ] **Step 5:** `npm test` → PASS; `npm run build` → succeeds; `npm run dev` and check the nav at 1280px and 375px in both themes against `calendar-v2.html`.
- [ ] **Step 6:** `git add -A && git commit -m "feat: scaffold app shell, theme and navigation"`

---

### Task 2: Simulado table

**Files:** Create `src/domain/simulado.ts`; Test `src/domain/simulado.test.ts`

**Interfaces:**
- Produces: `SIMULADO_TABLE: readonly number[]` (index = acertos 0..60); `notaFromAcertos(a: number): number`; `acertosFor(nota: number): number | null` (smallest acertos with table value ≥ nota − 1e-9; `null` if nota > 10; `0` if nota ≤ 0).

- [ ] **Step 1: Failing tests**

```ts
expect(SIMULADO_TABLE).toHaveLength(61);
expect(notaFromAcertos(3)).toBe(0.62);
expect(notaFromAcertos(34)).toBe(7.08);
expect(notaFromAcertos(48)).toBe(10);
expect(notaFromAcertos(60)).toBe(10);
expect(acertosFor(5)).toBe(24);
expect(acertosFor(5.55)).toBe(27);
expect(acertosFor(6.3)).toBe(31);
expect(acertosFor(7.15)).toBe(35);
expect(acertosFor(9.5)).toBe(46);
expect(acertosFor(10)).toBe(48);
expect(acertosFor(10.01)).toBeNull();
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Copy the 61 values **verbatim** from spec §7 "Tabela do simulado" (48..60 = 10).
- [ ] **Step 4:** Run → PASS. **Step 5:** Commit `feat: simulado table`.

---

### Task 3: Holidays and class days

**Files:** Create `src/domain/holidays.ts`, `src/domain/calendar.ts`; Tests alongside.

**Interfaces:**
- Consumes: `addDays`, `weekdayOf` (Task 1); `Schedule`, `CalendarOverrides`, `ClassDay`.
- Produces: `easter(year: number): Iso`; `holidaysFor(year: number): Record<Iso, string>`; `noClassDays(years: number[], ov: CalendarOverrides): Record<Iso, string>` (auto holidays minus `removedHolidays`, plus `ov.noClass`); `classDays(subjectId: string, fromIso: Iso, toExclusive: Iso, schedule: Schedule, ov: CalendarOverrides): ClassDay[]` ascending.

Holidays (names as shown in UI): `01/01 Confraternização`, `13/03 Batalha do Jenipapo`, `21/04 Tiradentes`, `01/05 Dia do Trabalho`, `16/08 Aniversário de Teresina`, `07/09 Independência`, `12/10 N. Sra. Aparecida`, `19/10 Dia do Piauí`, `02/11 Finados`, `15/11 Proclamação da República`, `20/11 Consciência Negra`, `25/12 Natal`; movable: Carnaval (easter−48, −47), `Sexta-feira Santa` (−2), `Corpus Christi` (+60). Ash Wednesday is NOT a no-class day.

`classDays` rule: for each date in `[from, toExclusive)`: skip if in `noClassDays`; weekday = `ov.extraDays[date] ?? weekdayOf(date)`; skip weekends unless extra day; `aulas` = number of slots in `schedule[weekday]` equal to `subjectId`; push when > 0.

- [ ] **Step 1: Failing tests**

```ts
expect(easter(2026)).toBe('2026-04-05');
const h = holidaysFor(2026);
expect(h['2026-02-16']).toBe('Carnaval'); expect(h['2026-02-17']).toBe('Carnaval');
expect(h['2026-04-03']).toBe('Sexta-feira Santa'); expect(h['2026-06-04']).toBe('Corpus Christi');
expect(h['2026-11-20']).toBe('Consciência Negra'); expect(h['2026-02-18']).toBeUndefined();

const sched: Schedule = { 1:['eletivaVI','extensao'], 2:['eletiva','po'], 3:['estagio','po'], 4:['gestao','gestao'], 5:['marketing',null] };
const ov: CalendarOverrides = { noClass:{}, removedHolidays:[], extraDays:{} };
// Marketing is Friday; 20/11 is a holiday
expect(classDays('marketing','2026-11-16','2026-12-10',sched,ov).map(d=>d.date)).toEqual(['2026-11-27','2026-12-04']);
expect(classDays('gestao','2026-11-16','2026-12-10',sched,ov)).toEqual([
  {date:'2026-11-19',aulas:2},{date:'2026-11-26',aulas:2},{date:'2026-12-03',aulas:2}]);
// removing the holiday restores the class; extra Saturday following Friday adds one
expect(classDays('marketing','2026-11-16','2026-12-10',sched,{...ov,removedHolidays:['2026-11-20'],extraDays:{'2026-11-28':5}}).length).toBe(4);
```
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement (Meeus/Butcher Gregorian algorithm for `easter`). **Step 4:** Run → PASS. **Step 5:** Commit `feat: holidays and class days`.

---

### Task 4: Absences (limit, saldo, CH resolution)

**Files:** Create `src/domain/absences.ts`; Test alongside.

**Interfaces:**
- Produces: `limiteFaltas(ch: number): number` = `Math.floor(ch * 0.25)`; `saldoFaltas(s: Subject): number | null` (null if `ch` null; `max(0, limite − faltas − pendentes)`); `saldoAulas(s: Subject): number | null` = `floor(saldoFaltas / 2)`; `percentualUsado(s): number | null`; `inferCh(faltas: number, percentual: number | null): number | null`; `isFixed36(nome: string): boolean`; `resolveCh(s: Subject, historicoCh?: number): { ch: number | null; chSource: ChSource | null }`.

`inferCh`: null when `faltas <= 0` or `!percentual`; `raw = faltas / (percentual/100)`; return 36 or 72 when `|raw − c| / c ≤ 0.05`, else null. `isFixed36`: normalized name contains `ingles` or `extensao`. `resolveCh` priority (spec §4): historico → percentual → fixo (36) → keep existing manual value → null.

- [ ] **Step 1: Failing tests**

```ts
expect(limiteFaltas(36)).toBe(9); expect(limiteFaltas(72)).toBe(18); expect(limiteFaltas(100)).toBe(25);
const mk = (o: Partial<Subject>): Subject => ({ id:'x', nome:'X', faltas:0, pendentes:0, percentual:null, ch:null, chSource:null, ...o });
expect(saldoAulas(mk({ ch:36, faltas:4 }))).toBe(2);
expect(saldoAulas(mk({ ch:72, faltas:8 }))).toBe(5);
expect(saldoAulas(mk({ ch:36, faltas:2 }))).toBe(3);
expect(saldoAulas(mk({ ch:36, faltas:9 }))).toBe(0);       // exactly 25%: passes, but nothing left
expect(saldoAulas(mk({ ch:36, faltas:4, pendentes:2 }))).toBe(1);
expect(saldoAulas(mk({ ch:null }))).toBeNull();
expect(inferCh(4, 11.11)).toBe(36); expect(inferCh(8, 11.11)).toBe(72); expect(inferCh(2, 5.56)).toBe(36);
expect(inferCh(0, 0)).toBeNull(); expect(inferCh(4, 1111)).toBeNull();   // OCR lost the dot
expect(isFixed36('Inglês VI')).toBe(true); expect(isFixed36('Projeto de Extensão VI')).toBe(true);
expect(resolveCh(mk({ nome:'Eletiva II' }), 36)).toEqual({ ch:36, chSource:'historico' });
expect(resolveCh(mk({ nome:'Inglês VI' }))).toEqual({ ch:36, chSource:'fixo' });
expect(resolveCh(mk({ nome:'Gestão', faltas:0 }))).toEqual({ ch:null, chSource:null });
```
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat: absence limits and CH resolution`.

---

### Task 5: Maximum-use skip plan and day status

**Files:** Create `src/domain/maxPlan.ts`, `src/domain/dayStatus.ts`; Tests alongside.

**Interfaces:**
- Consumes: `ClassDay`, `classDays`, `noClassDays` (Task 3), `saldoAulas` (Task 4).
- Produces:
  ```ts
  interface SubjectPlan { subjectId: string; saldoAulas: number; skipDays: Iso[]; startDate: Iso | null; allCovered: boolean; folgaAulas: number }
  planSubject(subjectId: string, days: ClassDay[], saldoAulas: number): SubjectPlan
  type PlanError = 'sem_data' | 'data_passada';
  interface OverallPlan { subjects: SubjectPlan[]; skipAllFrom: Iso | null; exceptions: string[] }
  planAll(input: { subjects: Subject[]; schedule: Schedule; ov: CalendarOverrides; today: Iso; simulado: Iso | null }): OverallPlan | PlanError
  type DayKind = 'weekend'|'holiday'|'simulado'|'after'|'none'|'normal'|'ok'|'no';
  dayStatus(date: Iso, ctx: { plan: OverallPlan; schedule: Schedule; ov: CalendarOverrides; simulado: Iso; filter?: string; saldo: Record<string, number> }): { kind: DayKind; label?: string; subjects: { id: string; slot: 0|1; status: 'ok'|'no'|'normal' }[] }
  ```

`planSubject` algorithm (spec §5): walk `days` from last to first; add a day while `used + day.aulas ≤ saldoAulas`; stop at the first day that doesn't fit (a 2-class day is never split). `startDate` = earliest included day or null; `allCovered` = every day included; `folgaAulas = saldoAulas − used`.
`planAll`: `simulado` null → `'sem_data'`; `simulado ≤ today` → `'data_passada'`. Window is `[today, simulado)`. Only subjects with non-null `saldoAulas` that appear in the schedule are planned. `exceptions` = subjects with `skipDays.length === 0`. `skipAllFrom` = latest `startDate` among the rest (null if none).
`dayStatus` priority: weekend (no extra day) → `holiday` (label = name) → `simulado` → `after` → per-subject status (with `filter`, only that subject): a class is `no` if that subject's saldo is 0, `ok` if date ∈ its `skipDays`, else `normal`. Day kind: any `no` → `no`; all `ok` → `ok`; no classes → `none`; else `normal`.

- [ ] **Step 1: Failing tests**

```ts
const weekly = (n: number, offset = 0) => Array.from({length:n},(_,i)=>({date:addDays('2026-09-07', 7*i+offset), aulas:1 as const}));
// user's example: simulado in week 10 on Y's day (Tuesday). X Mon has 10 days, Y and Z have 9.
expect(planSubject('X', weekly(10,0), 10).allCovered).toBe(true);
expect(planSubject('Y', weekly(9,1), 2).startDate).toBe(addDays('2026-09-08', 7*7));   // week 8
expect(planSubject('Z', weekly(9,2), 6).startDate).toBe(addDays('2026-09-09', 7*3));   // week 4
// 2-class day never split
const g = planSubject('gestao', [{date:'2026-11-19',aulas:2},{date:'2026-11-26',aulas:2},{date:'2026-12-03',aulas:2}], 3);
expect(g.skipDays).toEqual(['2026-12-03']); expect(g.folgaAulas).toBe(1);
expect(planSubject('gestao', [{date:'2026-12-03',aulas:2}], 1).skipDays).toEqual([]);

expect(planAll({ ...base, simulado:null })).toBe('sem_data');
expect(planAll({ ...base, simulado:'2026-11-10' })).toBe('data_passada');
// base: today 2026-11-16, simulado 2026-12-10, schedule from Task 3, subjects with saldo: eletiva 0, marketing 2, po 5, gestao 9
const p = planAll(base) as OverallPlan;
expect(p.exceptions).toEqual(['eletiva']);
expect(p.skipAllFrom).toBe(/* latest startDate among marketing, po, gestao */ p.subjects.filter(s=>s.subjectId!=='eletiva').map(s=>s.startDate!).sort().at(-1));
expect(dayStatus('2026-11-20', ctx).kind).toBe('holiday');
expect(dayStatus('2026-11-17', ctx).kind).toBe('no');      // Eletiva has no saldo
expect(dayStatus('2026-12-10', ctx).kind).toBe('simulado');
expect(dayStatus('2026-12-11', ctx).kind).toBe('after');
expect(dayStatus('2026-11-21', ctx).kind).toBe('weekend');
```
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat: maximum-use skip plan and day status`.

---

### Task 6: Grades outlook

**Files:** Create `src/domain/grades.ts`; Test alongside.

**Interfaces:**
- Consumes: `notaFromAcertos`, `acertosFor` (Task 2); `GradeSlot`, `SubjectGrades`.
- Produces:
  ```ts
  splitEqual(needed: number, caps: number[]): number[] | null   // equal points, capped; null if sum(caps) < needed − 1e-9
  type GradeStatus = 'aprovado' | 'andamento' | 'rec' | 'reprovado';
  interface Outlook {
    atual: number; restantes: number;            // restantes = max(0, 21 − atual)
    status: GradeStatus;
    target: 21 | 12 | null;                      // which sum the shares aim for
    shares: { p1?: number; p2?: number; p3?: number };   // points still needed per open slot
    simuladoAcertos: number | null;              // for shares.p3
    recQuestoes: number | null;                  // questions needed in the 10-question REC
  }
  gradeOutlook(g: SubjectGrades): Outlook
  clampGrade(v: number): number                  // to [0, 10]
  ```

Rules (spec §7): guaranteed = `value` for completa/incompleta; capacity = 0 (completa), `potencial ?? 10 − value` (incompleta), 10 (nao_feita). `splitEqual`: water-filling — repeatedly give each open slot `remaining / openCount`, fix any slot whose cap is below that share at its cap, redistribute. Status:
- `atual ≥ 21` → aprovado (no shares).
- all capacities 0 → media = atual/3: ≥ 7 aprovado; ≥ 4 rec with `recQuestoes = ceil(12 − media − 1e-9)`; else reprovado.
- `atual + Σcaps ≥ 21` → andamento, shares of `21 − atual`.
- `atual + Σcaps ≥ 12` → rec, shares of `12 − atual`; media for REC uses the table grade for the simulado share (`notaFromAcertos(acertosFor(share))`) and exact shares otherwise; `recQuestoes = ceil(12 − media − 1e-9)`.
- else reprovado.

- [ ] **Step 1: Failing tests**

```ts
const C=(v:number):GradeSlot=>({state:'completa',value:v}), N:GradeSlot={state:'nao_feita',value:null};
const I=(v:number,p?:number):GradeSlot=>({state:'incompleta',value:v,potencial:p});
expect(splitEqual(10,[9,10])).toEqual([5,5]);
expect(splitEqual(12,[4,10])).toEqual([4,8]);
expect(splitEqual(30,[9,10])).toBeNull();
let o = gradeOutlook({p1:C(10),p2:I(1),p3:N});
expect(o.restantes).toBe(10); expect(o.shares).toEqual({p2:5,p3:5}); expect(o.simuladoAcertos).toBe(24);
o = gradeOutlook({p1:C(6.7),p2:N,p3:N});
expect(o.shares.p2).toBeCloseTo(7.15); expect(o.simuladoAcertos).toBe(35); expect(o.status).toBe('andamento');
o = gradeOutlook({p1:C(8.9),p2:I(1),p3:N});
expect(o.shares.p3).toBeCloseTo(5.55); expect(o.simuladoAcertos).toBe(27);
o = gradeOutlook({p1:C(0.5),p2:C(2),p3:N});
expect(o.status).toBe('rec'); expect(o.target).toBe(12); expect(o.simuladoAcertos).toBe(46); expect(o.recQuestoes).toBe(8);
expect(gradeOutlook({p1:C(10),p2:C(10),p3:N}).status).toBe('aprovado');
expect(gradeOutlook({p1:C(1),p2:C(1),p3:N}).status).toBe('rec');        // 2 + 10 = 12 still reaches média 4
expect(gradeOutlook({p1:C(0.5),p2:C(1),p3:N}).status).toBe('reprovado'); // max 11,5 < 12
expect(gradeOutlook({p1:C(5),p2:C(5),p3:C(5)})).toMatchObject({status:'rec', recQuestoes:7});
expect(clampGrade(12)).toBe(10); expect(clampGrade(-1)).toBe(0);
```
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat: grade outlook and equal split`.

---

### Task 7: Composite grades (calculator core)

**Files:** Create `src/domain/composite.ts`; Test alongside.

**Interfaces:**
- Consumes: `splitEqual` (Task 6), `GradeSlot`.
- Produces:
  ```ts
  type CompositeMode = 'pontos' | 'peso';
  interface Part { nome: string; max: number; tirei: number | null }   // pontos: max in points; peso: max = peso% (0–100), tirei = nota 0–10
  interface Composite { mode: CompositeMode; parts: Part[] }
  compositeSummary(c: Composite): { valid: boolean; garantido: number; potencial: number; complete: boolean }
  compositeNeeds(c: Composite, pointsNeeded: number): (number | null)[]   // per part: needed (points in pontos mode, nota 0–10 in peso mode); null for filled parts; whole result null-filled if impossible
  compositeToSlot(c: Composite): GradeSlot   // complete → completa; else incompleta with value=garantido, potencial
  ```
In peso mode a part is worth `peso/10` points and scores `tirei * peso/100`. `valid` = Σmax == 10 (pontos) or Σpeso == 100 (peso), tolerance 0.01.

- [ ] **Step 1: Failing tests**

```ts
const pts: Composite = { mode:'pontos', parts:[{nome:'Quiz',max:1,tirei:1},{nome:'Trabalho',max:3,tirei:2.5},{nome:'Prova',max:6,tirei:null}] };
expect(compositeSummary(pts)).toEqual({ valid:true, garantido:3.5, potencial:6, complete:false });
expect(compositeNeeds(pts, 4.3)).toEqual([null,null,4.3]);
expect(compositeToSlot(pts)).toEqual({ state:'incompleta', value:3.5, potencial:6 });
const peso: Composite = { mode:'peso', parts:[{nome:'Trabalho',max:30,tirei:8},{nome:'Prova',max:70,tirei:null}] };
expect(compositeSummary(peso).garantido).toBeCloseTo(2.4);
expect(compositeNeeds(peso, 3.5)[1]).toBeCloseTo(5);          // 3.5 of 7 points = nota 5
expect(compositeSummary({ mode:'pontos', parts:[{nome:'A',max:4,tirei:null}] }).valid).toBe(false);
```
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat: composite grade calculator core`.

---

### Task 8: Subject name matching

**Files:** Create `src/domain/nameMatch.ts`; Test alongside.

**Interfaces:**
- Produces: `normalizeName(s: string): string` (lowercase, strip accents and punctuation, expand `proj` → `projeto`, collapse spaces); `namesMatch(a: string, b: string): boolean`; `matchSubjects(base: {id: string; nome: string}[], names: string[]): Record<string, string | null>` (name → subject id or null).

`namesMatch`: roman-numeral tokens (`i v x` combos) must be identical when either side has one; otherwise true when one normalized token set is a prefix-subset of the other (every token of the shorter is a prefix of some token of the longer, ignoring stopwords `de da do das dos e`). `matchSubjects` assigns each name at most one id, each id at most once.

- [ ] **Step 1: Failing tests**

```ts
expect(namesMatch('Proj. de Extensão VI','Projeto de Extensão VI')).toBe(true);
expect(namesMatch('Gestão de Projetos','Gestão de Projetos de Software')).toBe(true);
expect(namesMatch('Estágio Supervisionado','Estágio Curricular Supervisionado - Fábrica de Software I')).toBe(true);
expect(namesMatch('Eletiva VI','Eletiva II')).toBe(false);
expect(namesMatch('Eletiva II - Gestão de Pessoas','Eletiva II')).toBe(true);
expect(namesMatch('Marketing Digital','Pesquisa Operacional')).toBe(false);
```
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat: fuzzy subject name matching`.

---

### Task 9: OCR wrapper, fixtures, faltas and histórico parsers

**Files:** Create `src/ocr/ocr.ts`, `src/ocr/rows.ts`, `src/ocr/parseFaltas.ts`, `src/ocr/parseHistorico.ts`, `scripts/ocr-fixtures.ts`, `tests/fixtures/faltas.json`, `tests/fixtures/historico.json`, `tests/fixtures/notas.json`, `tests/fixtures/horario.json`; Tests `src/ocr/parseFaltas.test.ts`, `src/ocr/parseHistorico.test.ts`.

**Interfaces:**
- Produces:
  ```ts
  runOcr(file: Blob, opts?: { upscale?: number }): Promise<OcrWord[]>   // browser; tesseract.js 'por', blocks output flattened to words; canvas upscale (default 2)
  groupRows(words: OcrWord[]): OcrWord[][]          // cluster by vertical center, rows sorted top→bottom, words left→right
  columnOf(word: OcrWord, headers: { key: string; x: number }[]): string  // nearest header center
  parseNumber(s: string): number | null             // accepts '8,90' '8.90' '11.11%' 'O'→0; null otherwise
  interface FaltasRow { nome: string; turma?: string; faltas: number; percentual: number | null }
  parseFaltas(words: OcrWord[]): FaltasRow[]
  interface HistoricoRow { nome: string; codigo?: string; faltas: number | null; ch: number | null }
  parseHistorico(words: OcrWord[]): HistoricoRow[]
  ```

`scripts/ocr-fixtures.ts` (run with `npx tsx scripts/ocr-fixtures.ts`): OCR the four `examples/*.png` in Node with tesseract.js and write word boxes to `tests/fixtures/*.json`. Mapping: `151505` → faltas, `153848` → historico, `151516` → notas, `153714` → horario. Parsers locate header words ("Disciplina", "TOTAL", "Percentual", "CH", …) to get column x-centers, then read each data row with `columnOf`. Rows without a disciplina are skipped; "Ver faltas"/"Ver avaliações" ignored; disciplina text may wrap onto a second visual row (Estágio in historico) — merge a row with no numeric cells into the previous one's name.

- [ ] **Step 1:** Write `ocr.ts`, `rows.ts`, the fixtures script; run it; commit fixtures.
- [ ] **Step 2: Failing tests**

```ts
const f = parseFaltas(faltasFixture);
expect(f).toHaveLength(7);
expect(f.find(r=>r.nome==='Marketing Digital')).toMatchObject({ faltas:4, percentual:11.11, turma:'036C' });
expect(f.find(r=>r.nome==='Pesquisa Operacional')).toMatchObject({ faltas:8, percentual:11.11 });
expect(f.find(r=>r.nome.startsWith('Estágio'))).toMatchObject({ faltas:0, percentual:0 });
expect(f.find(r=>r.nome==='Projeto de Extensão VI')).toMatchObject({ faltas:2, percentual:5.56 });
const h = parseHistorico(historicoFixture);
expect(h.find(r=>r.nome==='Gestão de Projetos de Software')?.ch).toBe(72);
expect(h.find(r=>r.nome.startsWith('Estágio'))).toMatchObject({ ch:100, faltas:null });
expect(parseNumber('11.11%')).toBe(11.11); expect(parseNumber('8,90')).toBe(8.9); expect(parseNumber('O')).toBe(0);
```
- [ ] **Step 3–5:** FAIL → implement parsers → PASS (if OCR text of a name is slightly off, assert with `namesMatch` from Task 8 rather than equality). **Step 6:** Commit `feat: OCR and faltas/historico parsers`.

---

### Task 10: Notas and horário parsers

**Files:** Create `src/ocr/parseNotas.ts`, `src/ocr/parseHorario.ts`; Tests alongside.

**Interfaces:**
- Consumes: `groupRows`, `columnOf`, `parseNumber` (Task 9); `namesMatch` (Task 8).
- Produces:
  ```ts
  interface NotasRow { nome: string; p1: number | null; p2: number | null; p3: number | null; media: number | null; rec: number | null; mediaFinal: number | null }
  parseNotas(words: OcrWord[]): NotasRow[]
  interface HorarioCell { weekday: Weekday; slot: 0 | 1; nome: string }
  parseHorario(words: OcrWord[]): { cells: HorarioCell[]; ok: boolean }   // ok=false when < 5 cells found → UI falls back to manual grid
  ```
Notas columns by header keys `P1`, `P2`, `P3`, `MÉDIA SEMEST`, `REC FINAL`, `MÉDIA FINAL`; a grade belongs to the column whose header center is nearest. Horário: day columns from `Segunda`…`Sexta` header x; slots from rows containing `18:20` and `20:20` y; cell text = words in that column/slot area minus the professor line (last line of the cell).

- [ ] **Step 1: Failing tests**

```ts
const n = parseNotas(notasFixture);
expect(n.find(r=>r.nome==='Marketing Digital')).toMatchObject({ p1:8.9, p2:null, p3:null });
expect(n.find(r=>r.nome==='Inglês VI')?.p1).toBe(6);
expect(n.find(r=>r.nome==='Projeto de Extensão VI')?.p1).toBeNull();
const hz = parseHorario(horarioFixture);
// tolerant: the horario OCR may be weak; if ok, the known cells must be right
if (hz.ok) {
  expect(hz.cells.some(c=>c.weekday===4 && c.slot===0 && namesMatch(c.nome,'Gestão de Projetos'))).toBe(true);
  expect(hz.cells.some(c=>c.weekday===5 && c.slot===0 && namesMatch(c.nome,'Marketing Digital'))).toBe(true);
}
expect(parseHorario([]).ok).toBe(false);
```
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat: notas and horario parsers`.

---

### Task 11: Academic calendar PDF extraction

**Files:** Create `src/ocr/pdfCalendar.ts`; Test alongside.

**Interfaces:**
- Produces: `interface CalendarCandidate { date: Iso; label: string; kind: 'sem_aula' | 'simulado' | 'outro' }`; `extractCalendarCandidates(text: string, year: number): CalendarCandidate[]`; `pdfToText(file: Blob): Promise<string>` (pdfjs-dist, browser; worker via `?url` import).

Generic rules until the real ICEV PDF arrives (spec §5 "Calendário acadêmico"): find `DD/MM` or `DD/MM/YYYY` (and ranges `DD a DD/MM`, `DD/MM a DD/MM`) on each line; kind `sem_aula` when the line contains `feriado|recesso|sem aula|não haverá aula|ponto facultativo`; `simulado` when it contains `simulado`; else `outro` (not imported by default). Ranges expand to each day.

- [ ] **Step 1: Failing tests**

```ts
const c = extractCalendarCandidates('20/11 - Feriado Consciência Negra\n24 a 26/12 Recesso acadêmico\n10/12 Simulado\n05/12 Entrega de notas', 2026);
expect(c.filter(x=>x.kind==='sem_aula').map(x=>x.date)).toEqual(['2026-11-20','2026-12-24','2026-12-25','2026-12-26']);
expect(c.find(x=>x.kind==='simulado')?.date).toBe('2026-12-10');
expect(c.find(x=>x.date==='2026-12-05')?.kind).toBe('outro');
```
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat: academic calendar text extraction`.

---

### Task 12: App state and persistence

**Files:** Create `src/state/store.ts`; Test `src/state/store.test.ts`.

**Interfaces:**
- Consumes: everything in `src/domain`.
- Produces (signals unless noted):
  ```ts
  interface AppState {
    subjects: Subject[]; faltasPrintDate: Iso | null;
    schedule: Schedule; simulado: Iso | null; overrides: CalendarOverrides;
    grades: Record<string, SubjectGrades>; notasPrintDate: Iso | null;
    composites: Record<string, Composite>;   // key `${subjectId}:p1|p2`, or 'livre'
  }
  state: Signal<AppState>
  loadState(storage: Storage): AppState; saveState(storage: Storage, s: AppState): void; clearState(storage: Storage): void
  importFaltas(rows: FaltasRow[], printDate: Iso): void        // upsert by namesMatch, resolveCh, keep manual ch/pendentes
  importHistorico(rows: HistoricoRow[]): void                  // only sets ch (source 'historico')
  importHorario(cells: HorarioCell[]): void                    // matchSubjects → schedule
  importNotas(rows: NotasRow[], printDate: Iso): void          // filled → completa, empty → nao_feita; never overwrites a composite-linked slot
  setComposite(key: string, c: Composite): void                // also writes compositeToSlot into grades
  plan: ReadonlySignal<OverallPlan | PlanError>                // computed with todayIso()
  outlooks: ReadonlySignal<Record<string, Outlook>>
  ```
Persist on every change (effect) to `icevbooster:v1`; ignore and reset on JSON parse error or unknown shape.

- [ ] **Step 1: Failing tests** (use a `Map`-backed fake `Storage`)

```ts
importFaltas([{nome:'Marketing Digital',faltas:4,percentual:11.11},{nome:'Inglês VI',faltas:0,percentual:0}], '2026-11-14');
expect(state.value.subjects.find(s=>s.nome==='Marketing Digital')).toMatchObject({ ch:36, chSource:'percentual' });
expect(state.value.subjects.find(s=>s.nome==='Inglês VI')).toMatchObject({ ch:36, chSource:'fixo' });
importHistorico([{nome:'Marketing Digital',faltas:4,ch:36}]);
expect(state.value.subjects.find(s=>s.nome==='Marketing Digital')?.chSource).toBe('historico');
saveState(fake, state.value); expect(loadState(fake)).toEqual(state.value);
fake.setItem('icevbooster:v1','{broken'); expect(loadState(fake).subjects).toEqual([]);
```
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat: app state and persistence`.

---

### Task 13: Upload component and Faltas page

**Files:** Create `src/ui/Upload.tsx`, `src/ui/pages/Faltas.tsx`, `src/ui/MonthGrid.tsx` (compact mode only here); Test `src/ui/pages/Faltas.test.tsx`.

**Interfaces:**
- Consumes: store (Task 12), `runOcr`, parsers (Tasks 9–10), `dayStatus` (Task 5).
- Produces: `<Upload label: string; accept: string; onFile(f: File): Promise<void> />` showing the warning `Tire o print com a tabela completa visível — todas as linhas e colunas.` and a progress state; `<MonthGrid month: Iso; compact?: boolean; filter?: string; selected?: Iso; onSelect?(d: Iso) />` (full mode completed in Task 14).

Page content (match `calendar-v2.html` "Aba Faltas"): uploads for faltas (required), histórico (optional), horário (with "Preencher manualmente" fallback: a 5×2 grid of selects listing subjects; shown automatically when `parseHorario().ok` is false); simulado date input; print date (editable, default today) with warning when ≠ today `Confira se o portal já lançou todas as faltas.`; hero `Pode faltar tudo a partir de DD/MM` plus `exceto <nomes> (sem saldo)` line, or the `sem_data`/`data_passada` messages; editable table (Disciplina · CH select 36/72/outra · Faltas · Pendentes · % · Restam "N aulas (M faltas)" · Parar a partir de `DD/MM` | `já` | `não pode`, plus `+N aulas de folga`); warnings for subjects missing from the schedule; compact `MonthGrid` with link `Abrir calendário ›` to `#/calendario`.

- [ ] **Step 1: Failing test:** seed store with the Task 5 `base` data; render `<Faltas />`; expect text `Pode faltar tudo a partir de`, `exceto Eletiva II`, and a row containing `Marketing Digital` and `2 aulas`; with `simulado: null` expect `Informe a data do simulado`.
- [ ] **Step 2–4:** FAIL → implement → PASS. Manually upload each `examples/` print in `npm run dev` and check the table. **Step 5:** Commit `feat: faltas page with uploads and skip plan`.

---

### Task 14: Calendário page

**Files:** Modify `src/ui/MonthGrid.tsx`; Create `src/ui/pages/Calendario.tsx`; Test `src/ui/pages/Calendario.test.tsx`.

**Interfaces:** Consumes `dayStatus`, store, `formatBr`.

Match `calendar-v2.html` "Aba Calendário": month header with ‹ › and `Hoje`; subject filter chips (`Todas` + each subject); day cells — `normal` white with colored dots per subject, `ok` green, `no` red, `holiday` grey low-opacity with diagonal stripes and struck-through number + name, `simulado` magenta, `after`/`weekend` faded, today underlined; legend; detail panel for the selected day: classes with time (`18:20`/`20:20`) and status tag, saldo of each subject that day, observations (`<Nome> está sem saldo: qualquer falta reprova.`; for 2-class days `<Nome> tem 2 aulas neste dia: falte o dia todo ou nenhum.`; holiday name). Detail panel also lets the student toggle "sem aula" / "tem aula" (writes `noClass` / `removedHolidays`) and mark an extra class day with its weekday; PDF upload here imports `sem_aula` candidates after a confirm list and offers the `simulado` date.

- [ ] **Step 1: Failing test:** seeded store; render at November 2026; cell `20` has class `hol` and title `Consciência Negra`; clicking `17` shows `Eletiva II está sem saldo`; clicking › shows `Dezembro 2026` and cell `10` has class `sim`.
- [ ] **Step 2–4:** FAIL → implement → PASS; check both themes and 375px. **Step 5:** Commit `feat: calendar page`.

---

### Task 15: Notas page

**Files:** Create `src/ui/pages/Notas.tsx`; Test `src/ui/pages/Notas.test.tsx`.

**Interfaces:** Consumes `gradeOutlook`, `formatNum`, store `importNotas`, `runOcr`, `parseNotas`.

Match `notas-v1.html` "Aba Notas": upload strip `Notas lidas do print de DD/MM`; one card per subject: P1/P2/P3 boxes with value (editable, clamped 0–10) and state tag cycling completa → incompleta → não feita on tap (P3 only completa/não feita; incompleta shows "pode ganhar mais N"); three numbers (pontos atuais · faltam p/ 21 · provas restantes); need box `Tire X na P2 … e Y no simulado → N acertos (nota)`; REC path text `Para ir à REC (média ≥ 4): …` and `Aí precisaria de Q/10 questões na REC.`; status badge (`aprovado`, `em andamento`, `só com REC`, `reprovado`); link `Detalhar na calculadora ›` → `#/calculadora?m=<id>&p=p2`.

- [ ] **Step 1: Failing test:** grades `{p1:8.9 completa, p2:1 incompleta, p3:nao_feita}` → card shows `11,10`, `5,55`, `27 acertos`; grades `{p1:0.5, p2:2 completa}` → `só com REC` and `8/10`.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat: notas page`.

---

### Task 16: Calculadora page and simulado table

**Files:** Create `src/ui/pages/Calculadora.tsx`, `src/ui/SimuladoTable.tsx`; Test `src/ui/pages/Calculadora.test.tsx`.

**Interfaces:** Consumes `compositeSummary`, `compositeNeeds`, `setComposite`, `gradeOutlook`, `SIMULADO_TABLE`. `<SimuladoTable highlight?: number />` (all 61 rows, 4 columns, highlighted acertos row scrolled into view).

Match `notas-v1.html` "Aba Calculadora": link selector (matéria + P1/P2, or `Cálculo livre`), read from the `?m=&p=` query of the hash; mode toggle `Por pontos` / `Por peso`; part rows (nome, vale/peso, tirei — blank = ainda não) with add/remove; validation message when Σ ≠ 10 / 100%; result `Garantido na P2: X · ainda dá para ganhar: Y` and, when linked, the subject's outlook with per-part needs and simulado acertos; SimuladoTable beside it highlighting `simuladoAcertos`.

- [ ] **Step 1: Failing test:** link Marketing P2 with parts Quiz 1/1, Trabalho 3/2,5, Prova 6/blank, P1 8,90 completa → shows `3,50`, `6,00`, `4,30`, `21 acertos`; table row `21` has the highlight class.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat: calculator page and simulado table`.

---

### Task 17: Final pass and Vercel deploy

**Files:** Modify `src/ui/Footer.tsx`, `index.html` (title `icevbooster`, meta description, theme-color `#1E1230`), `README.md` (create: how to run, test, deploy).

- [ ] **Step 1:** Add `Apagar meus dados` (confirm dialog → `clearState`) and the footer text from Global Constraints.
- [ ] **Step 2:** `npm test` → all PASS; `npm run build` → no errors; `npx vite preview` and walk all four tabs at 1280px and 375px, both themes, uploading every `examples/` print.
- [ ] **Step 3:** Commit `chore: footer, data reset and readme`.
- [ ] **Step 4:** Deploy: the user runs `npx vercel login` themselves (account sign-in is theirs), then `npx vercel --prod` from the repo root, accepting the detected Vite settings. Expected: a `*.vercel.app` production URL. Open it and confirm the four tabs load and OCR works on one example.
