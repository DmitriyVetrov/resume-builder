import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { deriveContactUrl } from '../../../entities/resume/contact-link';
import { LIMITS, moveWithin, newContact, type ContactItem } from '../../../entities/resume/operations';
import { normalizeUrl } from '../../../entities/resume/safe-url';
import { Button, Select, TextField } from '../../../shared/ui';
import { LimitedField, MoveButtons, ROW_ACTION } from '../controls';
import type { EditorSession } from '../session';

const KINDS = [['other', 'Other'], ['email', 'E-mail'], ['phone', 'Phone'], ['location', 'Location'], ['link', 'Link']] as const;
const KIND_CHOICES = KINDS.map(([value, label]) => ({ value, label }));

/** Keeps what is being typed locally: a half-typed URL is not a `SafeUrl` and must not reach the document. */
function LinkField({ id, label, url, onUrl }: { id: string; label: string; url: string | null; onUrl: (url: string | null) => void }) {
  const [text, setText] = useState(url ?? '');
  const [error, setError] = useState('');
  const [seen, setSeen] = useState(url);
  if (seen !== url) { setSeen(url); setText(url ?? ''); setError(''); }
  const commit = () => {
    if (!text.trim()) { setError(''); setText(''); if (url !== null) onUrl(null); return; }
    const safe = normalizeUrl(text);
    if (!safe) { setError('Use a web address, an e-mail address or a phone number.'); return; }
    setError('');
    setText(safe);
    if (safe !== url) onUrl(safe);
  };
  return <TextField id={id} label={label} type="url" value={text} error={error} help="Leave empty to use the automatic link." onChange={event => setText(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commit(); } }} />;
}

export function ContactList({ session, contacts, baseId }: { session: EditorSession; contacts: ContactItem[]; baseId: string }) {
  const list = useRef<HTMLOListElement>(null);
  const focusId = useRef<string | null>(null);
  useEffect(() => {
    if (!focusId.current) return;
    list.current?.querySelector<HTMLInputElement>(`[data-contact-text="${focusId.current}"]`)?.focus();
    focusId.current = null;
  }, [contacts]);
  const change = (next: ContactItem[], label: string, coalesce: string | null = null) =>
    session.apply(document => ({ ...document, header: { ...document.header, contacts: next } }), { label, coalesce });
  const update = (id: string, patch: Partial<ContactItem>, coalesce: string | null) => change(contacts.map(contact => contact.id === id ? { ...contact, ...patch } : contact), 'contact edit', coalesce);
  const moveTo = (from: number, to: number) => {
    change(moveWithin(contacts, from, to), 'contact move');
    session.announce(`Moved contact to position ${to + 1} of ${contacts.length}`);
  };
  const add = () => {
    const contact = newContact();
    focusId.current = contact.id;
    change([...contacts, contact], 'contact add');
  };
  return <section className="form-group" aria-label="Contact items">
    <h3>Contact items</h3>
    <ol ref={list} className="edit-rows">
      {contacts.map((contact, index) => {
        const number = index + 1;
        const derived = contact.url === null ? deriveContactUrl(contact.text) : null;
        return <li key={contact.id} className={`edit-row`}>
          <div className="edit-row-body">
            <LimitedField id={`${baseId}-contact-${contact.id}`} label={`Contact ${number} text`} data-contact-text={contact.id} limit={LIMITS.contact} value={contact.text} onValue={text => update(contact.id, { text }, `contact:${contact.id}`)} help={derived ? `Links to ${derived}` : undefined} />
            <LinkField id={`${baseId}-contact-url-${contact.id}`} label={`Contact ${number} link`} url={contact.url} onUrl={url => update(contact.id, { url }, null)} />
            <div className="field">
              <label htmlFor={`${baseId}-contact-kind-${contact.id}`}>{`Contact ${number} kind`}</label>
              <Select id={`${baseId}-contact-kind-${contact.id}`} value={contact.kind} options={KIND_CHOICES} onValue={kind => update(contact.id, { kind: kind as ContactItem['kind'] }, null)} />
            </div>
            <div className="row-actions">
              <MoveButtons index={index} count={contacts.length} name={`contact ${number}`} onMove={to => moveTo(index, to)} />
              <Button variant="secondary" type="button" size="icon-sm" className={ROW_ACTION} title="Delete" aria-label={`Delete contact ${number}`} onClick={() => change(contacts.filter(item => item.id !== contact.id), 'contact delete')}><Trash2 aria-hidden="true" /></Button>
            </div>
          </div>
        </li>;
      })}
    </ol>
    <Button variant="secondary" type="button" disabled={contacts.length >= LIMITS.contacts} onClick={add}><Plus aria-hidden="true" />Add contact</Button>
    {contacts.length >= LIMITS.contacts && <p className="help">A resume can have {LIMITS.contacts} contact items.</p>}
  </section>;
}
