import { useId } from 'react';
import { LIMITS, type ResumeDocument } from '../../../entities/resume/operations';
import type { PhotoInfo } from '../api';
import { LimitedField } from '../controls';
import { PhotoPanel } from '../PhotoPanel';
import type { EditorSession } from '../session';
import { ContactList } from './ContactList';

export function HeaderForm({ session, document, photo }: { session: EditorSession; document: ResumeDocument; photo: PhotoInfo | null }) {
  const baseId = useId();
  const { header } = document;
  const set = (patch: Partial<ResumeDocument['header']>, field: string) =>
    session.apply(current => ({ ...current, header: { ...current.header, ...patch } }), { label: `${field} edit`, coalesce: `header:${field}` });
  return <>
    <h2 className="form-title">Header</h2>
    <p className="help">Always first in the resume. It cannot be moved or hidden.</p>
    <PhotoPanel session={session} photo={photo} showPhoto={header.showPhoto} />
    <LimitedField id={`${baseId}-name`} label="Full name" limit={LIMITS.fullName} value={header.fullName} onValue={fullName => set({ fullName }, 'name')} />
    <LimitedField id={`${baseId}-headline`} label="Headline" limit={LIMITS.headline} value={header.headline} onValue={headline => set({ headline }, 'headline')} />
    <ContactList session={session} contacts={header.contacts} baseId={baseId} />
  </>;
}
