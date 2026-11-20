// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatEntryDates, presentLabel } from './dates';

const date = (year: number, month: number | null = null) => ({ kind: 'date' as const, year, month });
const present = { kind: 'present' as const };
const entry = (start: ReturnType<typeof date> | null, end: ReturnType<typeof date> | typeof present | null, dateText = '') => ({ start, end, dateText });

describe('formatEntryDates', () => {
  const range = entry(date(2023, 2), date(2025, 6));
  it('A01 four formats in English (§5.6)', () => {
    expect(formatEntryDates(range, 'en', 'MonthYearLong')).toBe('February 2023 - June 2025');
    expect(formatEntryDates(range, 'en', 'MonthYearShort')).toBe('Feb 2023 - Jun 2025');
    expect(formatEntryDates(range, 'en', 'Numeric')).toBe('02/2023 - 06/2025');
    expect(formatEntryDates(range, 'en', 'YearOnly')).toBe('2023 - 2025');
  });
  it('A02 Spanish month names', () => {
    expect(formatEntryDates(range, 'es', 'MonthYearLong')).toBe('febrero 2023 - junio 2025');
    expect(formatEntryDates(range, 'es', 'MonthYearShort')).toBe('feb 2023 - jun 2025');
  });
  it('A03 Ukrainian month names', () => {
    expect(formatEntryDates(range, 'uk', 'MonthYearLong')).toBe('лютий 2023 - червень 2025');
    expect(formatEntryDates(range, 'uk', 'MonthYearShort')).toBe('лют 2023 - чер 2025');
  });
  it('A04 numeric and year formats do not depend on the language', () => {
    for (const language of ['en', 'es', 'uk'] as const) {
      expect(formatEntryDates(range, language, 'Numeric')).toBe('02/2023 - 06/2025');
      expect(formatEntryDates(range, language, 'YearOnly')).toBe('2023 - 2025');
    }
  });
  it('A05 a date with only a year prints the year in every format', () => {
    const only = entry(date(2016), date(2019));
    for (const format of ['MonthYearLong', 'MonthYearShort', 'Numeric', 'YearOnly'] as const) expect(formatEntryDates(only, 'en', format)).toBe('2016 - 2019');
  });
  it('A06 Present follows the language (FR-LAY-09)', () => {
    expect(formatEntryDates(entry(date(2025, 10), present), 'en', 'MonthYearLong')).toBe('October 2025 - Present');
    expect(formatEntryDates(entry(date(2025, 10), present), 'es', 'MonthYearLong')).toBe('octubre 2025 - Actualidad');
    expect(formatEntryDates(entry(date(2025, 10), present), 'uk', 'MonthYearLong')).toBe('жовтень 2025 - дотепер');
    expect(presentLabel('en')).toBe('Present');
  });
  it('A07 a date text override wins (§5.6)', () => {
    expect(formatEntryDates(entry(date(2019, 6), date(2019, 8), 'Summer 2019'), 'en', 'Numeric')).toBe('Summer 2019');
  });
  it('A08 missing parts leave no separator', () => {
    expect(formatEntryDates(entry(null, null), 'en', 'MonthYearLong')).toBe('');
    expect(formatEntryDates(entry(date(2020, 1), null), 'en', 'MonthYearLong')).toBe('January 2020');
    expect(formatEntryDates(entry(null, date(2020, 1)), 'en', 'MonthYearLong')).toBe('January 2020');
    expect(formatEntryDates(entry(null, present), 'en', 'MonthYearLong')).toBe('Present');
  });
  it('A09 uses no runtime locale data (ADR-010 §7)', () => {
    const source = readFileSync(resolve(import.meta.dirname, 'dates.ts'), 'utf8');
    expect(source).not.toMatch(/Intl\.|toLocale|localeCompare|\.normalize\(/);
  });
});
