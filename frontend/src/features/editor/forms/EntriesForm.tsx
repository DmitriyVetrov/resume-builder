import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { isDateRangeInverted, LIMITS, moveWithin, newEntry, type Entry, type Section } from '../../../entities/resume/operations';
import type { components } from '../../../shared/api/generated/schema';
import { Button, CONTROL, Input, Select } from '../../../shared/ui';
import { LimitedField, MoveButtons, ROW_ACTION } from '../controls';
import { RichTextField } from '../rich-text/RichTextField';

type Labels = components['schemas']['EntryLabels'];
type PartialDate = components['schemas']['PartialDate'];
type EntriesSection = Extract<Section, { type: 'entries' }>;
type Change = (change: (section: EntriesSection) => EntriesSection, label: string, coalesce?: string | null) => void;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;
const MONTH_CHOICES = [{ value: '', label: 'No month' }, ...MONTHS.map((label, index) => ({ value: String(index + 1), label }))];

/** Month and year stay local while incomplete: a date needs a year to reach the document. */
function DateFields({ id, label, value, disabled, onValue }: { id: string; label: string; value: PartialDate | null; disabled?: boolean; onValue: (value: PartialDate | null) => void }) {
  const [month, setMonth] = useState(value?.month ? String(value.month) : '');
  const [year, setYear] = useState(value ? String(value.year) : '');
  // An outside change (undo) resets the fields; our own commit does not, or a half-typed year would vanish.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setMonth(value?.month ? String(value.month) : '');
    setYear(value ? String(value.year) : '');
  }
  const send = (next: PartialDate | null) => { setSeen(next); onValue(next); };
  const commit = (nextMonth: string, nextYear: string) => {
    const number = Number(nextYear);
    if (!nextYear || !Number.isInteger(number) || number < MIN_YEAR || number > MAX_YEAR) { if (value) send(null); return; }
    const parsed: PartialDate = { kind: 'date', year: number, month: nextMonth ? Number(nextMonth) : null };
    if (parsed.year !== value?.year || parsed.month !== value?.month) send(parsed);
  };
  const yearInvalid = !!year && (Number(year) < MIN_YEAR || Number(year) > MAX_YEAR);
  return <div className="date-fields">
    <div className="field">
      <label htmlFor={`${id}-month`}>{label} month</label>
      <Select id={`${id}-month`} value={month} options={MONTH_CHOICES} disabled={disabled} onValue={next => { setMonth(next); commit(next, year); }} />
    </div>
    <div className="field">
      <label htmlFor={`${id}-year`}>{label} year</label>
      <Input id={`${id}-year`} className={CONTROL} type="number" min={MIN_YEAR} max={MAX_YEAR} value={year} disabled={disabled} aria-invalid={yearInvalid} aria-describedby={yearInvalid ? `${id}-year-error` : undefined} onChange={event => { setYear(event.target.value); commit(month, event.target.value); }} />
      {yearInvalid && <p className="field-error" id={`${id}-year-error`}>Use a year from {MIN_YEAR} to {MAX_YEAR}.</p>}
    </div>
  </div>;
}

function dates(entry: Entry) {
  if (entry.dateText) return entry.dateText;
  const part = (date: PartialDate | null) => date ? `${date.month ? `${MONTHS[date.month - 1]} ` : ''}${date.year}` : '';
  const end = entry.end?.kind === 'present' ? 'Present' : part(entry.end);
  return [part(entry.start), end].filter(Boolean).join(' – ');
}
export const entrySummary = (entry: Entry) => [entry.title || 'Untitled entry', entry.organization, dates(entry)].filter(Boolean).join(' · ');

function EntryForm({ entry, labels, baseId, focus, onChange }: { entry: Entry; labels: Labels | null; baseId: string; focus: boolean; onChange: (patch: Partial<Entry>, label: string, coalesce?: string | null) => void }) {
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => { if (focus) first.current?.focus(); }, [focus]);
  const id = `${baseId}-entry-${entry.id}`;
  const text = (field: 'title' | 'organization' | 'location' | 'dateText', label: string, limit: number) =>
    <LimitedField id={`${id}-${field}`} ref={field === 'title' ? first : undefined} label={label} limit={limit} value={entry[field]} onValue={value => onChange({ [field]: value }, `${label} edit`, `entry:${entry.id}:${field}`)} />;
  const present = entry.end?.kind === 'present';
  const end = entry.end?.kind === 'date' ? entry.end : null;
  return <div className="entry-form">
    <div className="field-grid">
      {text('title', labels?.title ?? 'Role', LIMITS.entryField)}
      {text('organization', labels?.organization ?? 'Organization', LIMITS.entryField)}
      {text('location', labels?.location ?? 'Location', LIMITS.entryField)}
    </div>
    <DateFields id={`${id}-start`} label="Start" value={entry.start} onValue={start => onChange({ start }, 'start date edit')} />
    <label className="check-field"><input type="checkbox" checked={present} onChange={event => onChange({ end: event.target.checked ? { kind: 'present' } : null }, 'end date edit')} /> Present</label>
    <DateFields id={`${id}-end`} label="End" value={end} disabled={present} onValue={value => onChange({ end: value }, 'end date edit')} />
    {isDateRangeInverted(entry) && <p className="notice-inline" role="status">The start date is after the end date. You can keep it this way.</p>}
    {text('dateText', 'Date text', LIMITS.dateText)}
    <p className="help">When set, this is printed instead of the dates, for example a season.</p>
    <RichTextField label="Description" value={entry.description} onChange={(description, change) => onChange({ description }, change.label, change.coalesce ? `entry:${entry.id}:description` : null)} />
    <label className="check-field"><input type="checkbox" checked={entry.pageBreakBefore} onChange={event => onChange({ pageBreakBefore: event.target.checked }, 'page break edit')} /> Page break before</label>
  </div>;
}

function LabelEditor({ labels, baseId, onChange }: { labels: Labels | null; baseId: string; onChange: (labels: Labels | null) => void }) {
  const fields = [['title', 'Title', 'Role'], ['organization', 'Organization', 'Organization'], ['location', 'Location', 'Location']] as const;
  const set = (field: keyof Labels, value: string) => {
    const next = { title: labels?.title ?? null, organization: labels?.organization ?? null, location: labels?.location ?? null, [field]: value || null };
    onChange(next.title === null && next.organization === null && next.location === null ? null : next);
  };
  return <details className="form-group">
    <summary>Customize field names</summary>
    <p className="help">Renames the fields of the entry form, for example Degree instead of Title. Not printed on the resume.</p>
    <div className="field-grid">
      {fields.map(([field, name, fallback]) => <LimitedField key={field} id={`${baseId}-label-${field}`} label={`Field name for ${name}`} placeholder={fallback} limit={LIMITS.label} value={labels?.[field] ?? fallback} onValue={value => set(field, value)} />)}
    </div>
  </details>;
}

export function EntriesForm({ section, baseId, change, revealId }: { section: EntriesSection; baseId: string; change: Change; revealId: string | null }) {
  const { entries, labels } = section.content;
  const [openId, setOpenId] = useState<string | null>(revealId ?? entries[0]?.id ?? null);
  const [revealed, setRevealed] = useState(revealId);
  if (revealId !== revealed) { setRevealed(revealId); if (revealId) setOpenId(revealId); }
  const [focusNew, setFocusNew] = useState<string | null>(null);
  const list = useRef<HTMLOListElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const setEntries = (next: Entry[], label: string, coalesce?: string | null) => change(current => ({ ...current, content: { ...current.content, entries: next } }), label, coalesce);
  const moveTo = (from: number, to: number) => setEntries(moveWithin(entries, from, to), 'entry move');
  useEffect(() => { if (revealId) list.current?.querySelector('.is-revealed')?.scrollIntoView?.({ block: 'nearest' }); }, [revealId]);
  const add = () => {
    const entry = newEntry();
    setEntries([...entries, entry], 'entry add');
    setOpenId(entry.id);
    setFocusNew(entry.id);
  };
  return <>
    <section className="form-group" aria-label="Entries">
      <h3>Entries</h3>
      <ol ref={list} className="edit-rows">
        {entries.map((entry, index) => {
          const number = index + 1;
          const open = openId === entry.id;
          return <li key={entry.id} className={`edit-row ${revealId === entry.id ? 'is-revealed' : ''}`}>
            <div className="edit-row-body">
              <button type="button" className="entry-toggle wrap-text" aria-expanded={open} onClick={() => setOpenId(open ? null : entry.id)} aria-label={`Edit entry ${number}: ${entrySummary(entry)}`}>{entrySummary(entry)}</button>
              <div className="row-actions">
                <MoveButtons index={index} count={entries.length} name={`entry ${number}`} onMove={to => moveTo(index, to)} />
                <Button variant="secondary" type="button" size="icon-sm" className={ROW_ACTION} title="Delete" aria-label={`Delete entry ${number}`} onClick={() => { setEntries(entries.filter(item => item.id !== entry.id), 'entry delete'); addButton.current?.focus(); }}><Trash2 aria-hidden="true" /></Button>
              </div>
              {open && <EntryForm entry={entry} labels={labels} baseId={baseId} focus={focusNew === entry.id} onChange={(patch, label, coalesce) => setEntries(entries.map(item => item.id === entry.id ? { ...item, ...patch } : item), label, coalesce)} />}
            </div>
          </li>;
        })}
      </ol>
      <Button variant="secondary" ref={addButton} type="button" disabled={entries.length >= LIMITS.entries} onClick={add}><Plus aria-hidden="true" />Add entry</Button>
    </section>
    <LabelEditor labels={labels} baseId={baseId} onChange={next => change(current => ({ ...current, content: { ...current.content, labels: next } }), 'field label edit', 'labels')} />
  </>;
}
