import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState, type Ref } from 'react';
import { clampCodePoints, conversionOptions, convertSection, LIMITS, moveWithin, newListItem, updateSection, type ListItem, type Section, type SectionType } from '../../../entities/resume/operations';
import type { components } from '../../../shared/api/generated/schema';
import { Button, CONTROL, FieldError, Input, Select } from '../../../shared/ui';
import { MoveButtons, ROW_ACTION } from '../controls';
import { RichTextField } from '../rich-text/RichTextField';
import type { EditorSession, Reveal } from '../session';
import { EntriesForm } from './EntriesForm';

type Inline = components['schemas']['Inline'];
type ListSection = Extract<Section, { type: 'list' }>;
const TYPE_NAMES: Record<SectionType, string> = { text: 'Text', list: 'List', entries: 'Entries', inline: 'Inline' };
const COLUMN_CHOICES = [{ value: '', label: 'Template default' }, { value: '1', label: '1 column' }, { value: '2', label: '2 columns' }];

function ListForm({ section, revealId, onItems }: { section: ListSection; revealId: string | null; onItems: (items: ListItem[], label: string, coalesce?: string | null) => void }) {
  const items = section.content.items;
  const list = useRef<HTMLOListElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const moveTo = (from: number, to: number) => onItems(moveWithin(items, from, to), 'item move');
  useEffect(() => { if (revealId) list.current?.querySelector('.is-revealed')?.scrollIntoView?.({ block: 'nearest' }); }, [revealId]);
  const addAfter = (index: number) => {
    if (items.length >= LIMITS.items) return;
    const item = newListItem();
    onItems([...items.slice(0, index + 1), item, ...items.slice(index + 1)], 'item add');
    setFocusId(item.id);
  };
  const paste = (index: number, lines: Inline[][]) => {
    const room = LIMITS.items - items.length;
    const current = items[index] as ListItem;
    // Pasted lines become items. Only an empty item is replaced, and the first line takes its place.
    const added = lines.slice(0, current.text.length === 0 ? room + 1 : room).map(line => newListItem(line));
    if (!added.length) return;
    const before = items.slice(0, index);
    const merged = current.text.length === 0 ? added : [current, ...added];
    onItems([...before, ...merged, ...items.slice(index + 1)], 'paste');
  };
  return <section className="form-group" aria-label="List items">
    <h3>Items</h3>
    <ol ref={list} className="edit-rows">
      {items.map((item, index) => {
        const number = index + 1;
        return <li key={item.id} className={`edit-row ${revealId === item.id ? 'is-revealed' : ''}`}>
          <div className="edit-row-body">
            <RichTextField label={`Item ${number}`} variant="line" autoFocus={focusId === item.id}
              value={[{ kind: 'paragraph', inlines: item.text }]}
              onChange={(blocks, change) => onItems(items.map(other => other.id === item.id ? { ...other, text: blocks[0]?.kind === 'paragraph' ? blocks[0].inlines : [] } : other), change.label, change.coalesce ? `item:${item.id}` : null)}
              onEnter={() => addAfter(index)} onPasteLines={lines => paste(index, lines)} />
            <div className="row-actions">
              <MoveButtons index={index} count={items.length} name={`item ${number}`} onMove={to => moveTo(index, to)} />
              <Button variant="secondary" type="button" size="icon-sm" className={ROW_ACTION} title="Delete" aria-label={`Delete item ${number}`} onClick={() => { onItems(items.filter(other => other.id !== item.id), 'item delete'); addButton.current?.focus(); }}><Trash2 aria-hidden="true" /></Button>
            </div>
          </div>
        </li>;
      })}
    </ol>
    <Button variant="secondary" ref={addButton} type="button" disabled={items.length >= LIMITS.items} onClick={() => addAfter(items.length - 1)}><Plus aria-hidden="true" />Add item</Button>
  </section>;
}

/** The section's heading is its own text field: click the title to edit it, like the resume title in the top bar. */
function TitleField({ id, ref, value, onValue }: { id: string; ref: Ref<HTMLInputElement>; value: string; onValue: (value: string) => void }) {
  const [clamped, setClamped] = useState(false);
  return <>
    <h2 className="form-title" {...(value ? {} : { 'aria-label': 'Untitled section' })}>
      <Input ref={ref} id={id} aria-label="Section title" aria-invalid={clamped} aria-describedby={clamped ? `${id}-error` : undefined} spellCheck placeholder="Untitled section" value={value}
        className={`${CONTROL} form-title-input h-auto border-transparent px-2 py-1 text-[length:inherit] font-[inherit] hover:border-input md:text-[length:inherit]`}
        onChange={event => { const next = clampCodePoints(event.target.value, LIMITS.sectionTitle); setClamped(next.clamped); onValue(next.value); }} />
    </h2>
    {clamped && <FieldError id={`${id}-error`}>Limited to {LIMITS.sectionTitle} characters; the rest was not added.</FieldError>}
  </>;
}

export function SectionForm({ session, section, reveal, takeTitleFocus }: { session: EditorSession; section: Section; reveal: Reveal | null; takeTitleFocus: (id: string) => boolean }) {
  const baseId = useId();
  const title = useRef<HTMLInputElement>(null);
  useEffect(() => { if (takeTitleFocus(section.id)) title.current?.focus(); }, [takeTitleFocus, section.id]);
  const change = (next: (current: Section) => Section, label: string, coalesce: string | null = null) =>
    session.apply(document => updateSection(document, section.id, next), { label, coalesce: coalesce && `section:${section.id}:${coalesce}` });
  const options = conversionOptions(section);
  const showColumns = section.type === 'list' || section.type === 'entries';
  return <>
    <TitleField id={`${baseId}-title`} ref={title} value={section.title} onValue={value => change(current => ({ ...current, title: value }), 'section title edit', 'title')} />
    <div className="field-grid">
      <div className="field">
        <label htmlFor={`${baseId}-type`}>Section type</label>
        <Select id={`${baseId}-type`} value={section.type} onValue={next => { const type = next as SectionType; change(current => convertSection(current, type), 'section type change'); }}
          options={[{ value: section.type, label: TYPE_NAMES[section.type] }, ...options.map(option => ({ value: option.type, label: option.allowed ? TYPE_NAMES[option.type] : `${TYPE_NAMES[option.type]} — ${option.reason}`, disabled: !option.allowed }))]} />
      </div>
      {showColumns && <div className="field">
        <label htmlFor={`${baseId}-columns`}>List columns</label>
        <Select id={`${baseId}-columns`} value={section.listColumns == null ? '' : String(section.listColumns)} options={COLUMN_CHOICES} onValue={value => change(current => ({ ...current, listColumns: value === '' ? null : Number(value) as 1 | 2 }), 'list columns change')} />
      </div>}
    </div>
    {section.type === 'text' && <RichTextField label="Text" value={section.content.body} onChange={(body, edit) => change(current => current.type === 'text' ? { ...current, content: { body } } : current, edit.label, edit.coalesce ? 'body' : null)} />}
    {section.type === 'inline' && <RichTextField label="Text" variant="inline" value={section.content.body} onChange={(body, edit) => change(current => current.type === 'inline' ? { ...current, content: { body: body as typeof current.content.body } } : current, edit.label, edit.coalesce ? 'body' : null)} />}
    {section.type === 'list' && <ListForm key={section.id} section={section} revealId={reveal?.itemId ?? null} onItems={(items, label, coalesce) => change(current => current.type === 'list' ? { ...current, content: { items } } : current, label, coalesce ?? null)} />}
    {section.type === 'entries' && <EntriesForm key={section.id} section={section} revealId={reveal?.entryId ?? null} baseId={baseId} change={(next, label, coalesce) => change(current => current.type === 'entries' ? next(current) : current, label, coalesce ?? null)} />}
  </>;
}
