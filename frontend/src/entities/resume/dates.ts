import type { Entry, ResumeDocument } from './operations';

type Language = ResumeDocument['language'];
type Format = ResumeDocument['dateFormat'];
type PartialDate = NonNullable<Entry['start']>;

/** FR-LAY-09, §5.6. Bundled tables, never `Intl`: the output must be the same in every runtime (ADR-010 §7). */
const LABELS: Record<Language, { months: readonly string[]; short: readonly string[]; present: string }> = {
  en: {
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    short: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    present: 'Present',
  },
  es: {
    months: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    short: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
    present: 'Actualidad',
  },
  uk: {
    months: ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'],
    short: ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'],
    present: 'дотепер',
  },
};

export const presentLabel = (language: Language) => LABELS[language].present;

function formatDate(date: PartialDate, language: Language, format: Format) {
  if (!date.month || format === 'YearOnly') return String(date.year);
  const index = date.month - 1;
  switch (format) {
    case 'MonthYearLong': return `${LABELS[language].months[index]} ${date.year}`;
    case 'MonthYearShort': return `${LABELS[language].short[index]} ${date.year}`;
    case 'Numeric': return `${String(date.month).padStart(2, '0')}/${date.year}`;
  }
}

/** The one date formatter of preview, PDF and TXT (fixes RG T6). A date text override wins. */
export function formatEntryDates(entry: Pick<Entry, 'start' | 'end' | 'dateText'>, language: Language, format: Format): string {
  if (entry.dateText) return entry.dateText;
  const start = entry.start ? formatDate(entry.start, language, format) : '';
  const end = !entry.end ? '' : entry.end.kind === 'present' ? presentLabel(language) : formatDate(entry.end, language, format);
  return [start, end].filter(Boolean).join(' - ');
}
