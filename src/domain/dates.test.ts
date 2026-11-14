import { describe, it, expect } from 'vitest';
import { addDays, weekdayOf, formatBr, formatNum, formatNeeded, formatFloor, todayIso, parseDecimal } from './dates';

describe('dates', () => {
  it('weekdayOf', () => {
    expect(weekdayOf('2026-11-01')).toBe(0);
    expect(weekdayOf('2026-11-17')).toBe(2);
  });
  it('addDays', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('formatBr', () => {
    expect(formatBr('2026-12-10')).toBe('10/12');
  });
  it('formatNum', () => {
    expect(formatNum(7.15)).toBe('7,15');
    expect(formatNum(7, 1)).toBe('7,0');
  });
  it('formatFloor never rounds a guaranteed or achievable figure up', () => {
    expect(formatFloor(10 / 3)).toBe('3,33');
    expect(formatFloor(2 / 3)).toBe('0,66');
    expect(formatFloor(4.3)).toBe('4,30');
    expect(formatFloor(0.976)).toBe('0,97');
    expect(formatFloor(9.999)).toBe('9,99');
    expect(formatFloor(21)).toBe('21,00');
    expect(formatFloor(Number.NaN)).toBe('—');
  });
  it('formatNeeded never rounds in the student favor', () => {
    expect(formatNeeded(10 / 3)).toBe('3,34');
    expect(formatNeeded(4.3)).toBe('4,30');
    expect(formatNeeded(8.6 / 2)).toBe('4,30');
    expect(formatNeeded(5.551)).toBe('5,56');
    expect(formatNeeded(0)).toBe('0,00');
    expect(formatNeeded(-1)).toBe('0,00');
    expect(formatNeeded(Number.NaN)).toBe('—');
  });
  it('todayIso is ISO shaped', () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('parseDecimal accepts comma decimals and rejects non-finite input', () => {
    expect(parseDecimal('7,5')).toBe(7.5);
    expect(parseDecimal(' 12 ')).toBe(12);
    expect(parseDecimal('8.25')).toBe(8.25);
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('1,2,3')).toBeNull();
    expect(parseDecimal('Infinity')).toBeNull();
  });
});
