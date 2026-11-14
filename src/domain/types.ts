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
