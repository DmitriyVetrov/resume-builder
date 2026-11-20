import { useRef, useState, type FormEvent } from 'react';
import { Eye, EyeOff, GraduationCap, Plus, Trash2 } from 'lucide-react';
import { flushSync } from 'react-dom';
import { addSection, isSectionEmpty, LIMITS, moveSection, newSection, removeSection, updateSection, type ResumeDocument, type Section, type SectionType } from '../../entities/resume/operations';
import { Badge, Button, Dialog } from '../../shared/ui';
import { LimitedField, MoveButtons, ROW_ACTION } from './controls';
import { HEADER, type EditorSession, type Selection } from './session';

const TYPES: { type: SectionType; name: string; hint: string }[] = [
  { type: 'text', name: 'Text', hint: 'One text field, such as a summary.' },
  { type: 'list', name: 'List', hint: 'Short lines, such as skills.' },
  { type: 'entries', name: 'Entries', hint: 'Items with title and dates, such as jobs.' },
  { type: 'inline', name: 'Inline', hint: 'One flowing paragraph, such as languages.' },
];
export const sectionName = (section: { title: string }) => section.title || 'Untitled section';

export function TypeIcon({ type }: { type: SectionType | 'header' }) {
  const paths: Record<SectionType | 'header', string> = {
    header: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c0-3.3 3.1-6 7-6s7 2.7 7 6',
    text: 'M5 7h14M5 12h14M5 17h9',
    list: 'M9 7h10M9 12h10M9 17h10M5 7h.01M5 12h.01M5 17h.01',
    entries: 'M4 8h16v11H4zM9 8V5h6v3',
    inline: '',
  };
  if (type === 'inline') return <span className="type-icon type-inline" aria-hidden="true"><GraduationCap width={16} height={16} /></span>;
  return <span className={`type-icon type-${type}`} aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={paths[type]} /></svg></span>;
}

function AddSectionDialog({ onAdd, onClose }: { onAdd: (type: SectionType, title: string) => void; onClose: () => void }) {
  const [type, setType] = useState<SectionType>('text');
  const [title, setTitle] = useState('');
  const submit = (event: FormEvent) => { event.preventDefault(); onAdd(type, title); };
  return <Dialog title="Add section" onClose={onClose}>
    <form onSubmit={submit}>
      <fieldset className="resume-choices type-choices">
        <legend>Section type</legend>
        {TYPES.map(option => <label key={option.type}>
          <input type="radio" name="section-type" value={option.type} checked={type === option.type} onChange={() => setType(option.type)} />
          <span>{option.name}<small>{option.hint}</small></span>
        </label>)}
      </fieldset>
      <LimitedField id="add-section-title" label="Section title" limit={LIMITS.sectionTitle} value={title} onValue={setTitle} data-initial-focus />
      <div className="dialog-actions">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit">Add</Button>
      </div>
    </form>
  </Dialog>;
}

function SectionRow({ session, section, index, count, selected, onDelete }: { session: EditorSession; section: Section; index: number; count: number; selected: boolean; onDelete: () => void }) {
  const name = sectionName(section);
  const empty = isSectionEmpty(section);
  const typeName = TYPES.find(option => option.type === section.type)?.name;
  return <li className={`section-row ${selected ? 'selected' : ''} ${section.hidden ? 'is-hidden' : ''}`}>
    <div className="section-row-main">
      <button type="button" className="section-select" data-section-row={section.title} aria-current={selected ? 'true' : undefined} title={name} onClick={() => session.select(section.id)}>
        <TypeIcon type={section.type} />
        <span className="section-name">{name}</span>
        <span className="sr-only">{typeName} section</span>
        {section.hidden && <Badge>Hidden</Badge>}
        {empty && <Badge>Empty</Badge>}
      </button>
    </div>
    {selected && <div className="section-actions">
      <div className="row-actions">
        <MoveButtons index={index} count={count} name={name} onMove={to => {
          session.apply(document => moveSection(document, section.id, to), { label: 'section move' });
          session.announce(`Moved ${name} to position ${to + 1} of ${count}`);
        }} />
        <Button variant="secondary" type="button" size="icon-sm" className={ROW_ACTION} aria-label={`${section.hidden ? 'Show' : 'Hide'} ${name}`} title={section.hidden ? 'Show' : 'Hide'} onClick={() => session.apply(document => updateSection(document, section.id, current => ({ ...current, hidden: !current.hidden })), { label: section.hidden ? 'section show' : 'section hide' })}>{section.hidden ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</Button>
        <Button variant="secondary" type="button" size="icon-sm" className={`${ROW_ACTION} text-(--color-danger)`} aria-label={`Delete ${name}`} title="Delete" onClick={onDelete}><Trash2 aria-hidden="true" /></Button>
      </div>
    </div>}
  </li>;
}

export function SectionPanel({ session, document, selection, onSelected, onAdded }: { session: EditorSession; document: ResumeDocument; selection: Selection; onSelected: () => void; onAdded: (id: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Section | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const sections = document.sections as Section[];
  const add = (type: SectionType, title: string) => {
    const section = newSection(type, title);
    onAdded(section.id);
    session.apply(current => addSection(current, section), { label: 'section add', select: section.id });
    setAdding(false);
  };
  const confirmDelete = () => {
    if (!deleting) return;
    const section = deleting;
    const index = sections.findIndex(item => item.id === section.id);
    const neighbour = sections[index + 1]?.id ?? sections[index - 1]?.id ?? HEADER;
    // Close the modal first: while it is open the notice's Undo button, outside it, cannot take focus.
    flushSync(() => setDeleting(null));
    session.apply(current => removeSection(current, section.id), { label: 'section delete', select: neighbour });
    session.showNotice({ kind: 'deleted', title: sectionName(section) });
  };
  return <div className="section-panel">
    <h2 className="panel-title">Sections</h2>
    <ul ref={list} role="list" aria-label="Resume sections" className="section-list" onClick={event => { if ((event.target as HTMLElement).closest('.section-select')) onSelected(); }}>
      <li className={`section-row ${selection === HEADER ? 'selected' : ''}`}>
        <div className="section-row-main">
          <button type="button" className="section-select" aria-current={selection === HEADER ? 'true' : undefined} onClick={() => session.select(HEADER)}>
            <TypeIcon type="header" /><span className="section-name">Header</span>
          </button>
        </div>
      </li>
      {sections.map((section, index) => <SectionRow key={section.id} session={session} section={section} index={index} count={sections.length} selected={selection === section.id} onDelete={() => setDeleting(section)} />)}
    </ul>
    <Button variant="secondary" className="add-section w-full" disabled={sections.length >= LIMITS.sections} onClick={() => setAdding(true)}><Plus aria-hidden="true" />Add section</Button>
    {sections.length >= LIMITS.sections && <p className="help">A resume can have {LIMITS.sections} sections.</p>}
    {adding && <AddSectionDialog onAdd={add} onClose={() => setAdding(false)} />}
    {deleting && <Dialog title={`Delete ${sectionName(deleting)}?`} onClose={() => setDeleting(null)}>
      <p>This removes the section and its content from the resume. You can undo it.</p>
      <div className="dialog-actions">
        <Button variant="secondary" data-initial-focus onClick={() => setDeleting(null)}>Cancel</Button>
        <Button variant="danger" onClick={confirmDelete}>Delete</Button>
      </div>
    </Dialog>}
  </div>;
}
